from __future__ import annotations

import base64
import re
from typing import Iterable, Protocol

import httpx

from app.config import Settings
from app.schemas import ListingAnalysis

SALE_TERMS = re.compile(
    r"\b(for\s*sale|selling|available|price|ksh|kes|million|m\b|negotiable|mileage|km\b|cc\b|automatic|manual|diesel|petrol|hybrid|unit|sold|reserved)\b",
    re.IGNORECASE,
)
VEHICLE_TERMS = re.compile(
    r"\b(toyota|volkswagen|vw|mazda|subaru|mercedes|benz|bmw|audi|nissan|honda|lexus|ford|isuzu|mitsubishi|suzuki|volvo|peugeot|land\s*rover|range\s*rover|passat|prado|harrier|forester|cx-5|cx5|vitz|fit|note|tiida|premio|pajero|hilux)\b",
    re.IGNORECASE,
)


def should_enrich(text: str, image_urls: Iterable[str]) -> bool:
    images = list(image_urls)
    if images:
        return True
    return bool(SALE_TERMS.search(text) and VEHICLE_TERMS.search(text))


def _analysis_prompt(text: str) -> str:
    return (
        "Analyze this public vehicle-seller X post. Categorize the post and extract every distinct vehicle offered. "
        "When one post lists several vehicles and prices, return a separate vehicle candidate for each one. "
        "Treat seller text as a seller claim, visible details as observations, and uncertain trim/specification guesses as AI inference. "
        "Never claim mechanical condition, accident history, authenticity, ownership, or hidden facts from images. "
        "Do not invent missing values. Normalize money to an integer amount and mileage to kilometres only when explicitly stated. "
        "Use KES for Kenyan-shilling prices when the post uses KSh/KES or an unambiguous shorthand such as '390k'.\n\n"
        f"POST TEXT:\n{text}"
    )


class EnrichmentBackend(Protocol):
    provider: str
    model: str

    def analyze(self, text: str, image_urls: list[str]) -> ListingAnalysis: ...


class GeminiVehicleEnricher:
    provider = "gemini"

    def __init__(self, settings: Settings):
        self.settings = settings
        self.model = settings.gemini_model
        if not settings.gemini_api_key:
            raise RuntimeError("GEMINI_API_KEY is not configured")

    def _image_part(self, client: httpx.Client, url: str) -> dict | None:
        response = client.get(url)
        response.raise_for_status()
        mime_type = response.headers.get("content-type", "image/jpeg").split(";", 1)[0].strip().lower()
        if not mime_type.startswith("image/"):
            return None
        # Avoid unexpectedly huge upstream media payloads. X listing photos are
        # normally well below this threshold.
        if len(response.content) > 12 * 1024 * 1024:
            return None
        return {
            "inline_data": {
                "mime_type": mime_type,
                "data": base64.b64encode(response.content).decode("ascii"),
            }
        }

    def analyze(self, text: str, image_urls: list[str]) -> ListingAnalysis:
        parts: list[dict] = [{"text": _analysis_prompt(text)}]
        with httpx.Client(
            timeout=httpx.Timeout(20.0, connect=8.0),
            follow_redirects=True,
            headers={"User-Agent": "TheTorque/0.4 vehicle-intelligence"},
        ) as media_client:
            for url in image_urls[: self.settings.ai_max_images]:
                try:
                    part = self._image_part(media_client, url)
                    if part is not None:
                        parts.append(part)
                except httpx.HTTPError:
                    # One unavailable seller image should not prevent analysis of
                    # the remaining text/media.
                    continue

        endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent"
        payload = {
            "contents": [{"role": "user", "parts": parts}],
            "generationConfig": {
                "temperature": 0.1,
                "responseMimeType": "application/json",
                "responseJsonSchema": ListingAnalysis.model_json_schema(),
            },
        }
        with httpx.Client(timeout=httpx.Timeout(75.0, connect=10.0)) as client:
            response = client.post(
                endpoint,
                headers={
                    "x-goog-api-key": self.settings.gemini_api_key,
                    "content-type": "application/json",
                },
                json=payload,
            )
            response.raise_for_status()
            body = response.json()

        candidates = body.get("candidates") or []
        if not candidates:
            feedback = body.get("promptFeedback") or body.get("prompt_feedback") or {}
            raise RuntimeError(f"Gemini returned no candidates: {feedback}")

        content = candidates[0].get("content") or {}
        response_parts = content.get("parts") or []
        output_text = "".join(part.get("text", "") for part in response_parts if isinstance(part, dict)).strip()
        if not output_text:
            raise RuntimeError("Gemini response did not contain structured text output")
        return ListingAnalysis.model_validate_json(output_text)


class OpenAIVehicleEnricher:
    provider = "openai"

    def __init__(self, settings: Settings):
        self.settings = settings
        self.model = settings.openai_model
        if not settings.openai_api_key:
            raise RuntimeError("OPENAI_API_KEY is not configured")
        from openai import OpenAI

        self.client = OpenAI(api_key=settings.openai_api_key)

    def analyze(self, text: str, image_urls: list[str]) -> ListingAnalysis:
        content: list[dict[str, str]] = [{"type": "input_text", "text": _analysis_prompt(text)}]
        for url in image_urls[: self.settings.ai_max_images]:
            content.append(
                {
                    "type": "input_image",
                    "image_url": url,
                    "detail": self.settings.openai_image_detail,
                }
            )

        response = self.client.responses.parse(
            model=self.settings.openai_model,
            input=[{"role": "user", "content": content}],
            text_format=ListingAnalysis,
            store=False,
        )

        parsed = getattr(response, "output_parsed", None)
        if parsed is not None:
            return parsed

        for output in response.output:
            if getattr(output, "type", None) != "message":
                continue
            for item in output.content:
                candidate = getattr(item, "parsed", None)
                if candidate is not None:
                    return candidate
        raise RuntimeError("OpenAI response did not contain parsed structured output")


class VehicleEnricher:
    """Provider-neutral multimodal vehicle extractor."""

    def __init__(self, settings: Settings):
        self.settings = settings
        if settings.ai_provider == "gemini":
            self.backend: EnrichmentBackend = GeminiVehicleEnricher(settings)
        elif settings.ai_provider == "openai":
            self.backend = OpenAIVehicleEnricher(settings)
        else:  # guarded by Settings validation, retained defensively
            raise RuntimeError(f"Unsupported AI provider: {settings.ai_provider}")

    @property
    def provider(self) -> str:
        return self.backend.provider

    @property
    def model(self) -> str:
        return self.backend.model

    def analyze(self, text: str, image_urls: list[str]) -> ListingAnalysis:
        return self.backend.analyze(text, image_urls)
