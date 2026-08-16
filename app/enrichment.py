from __future__ import annotations

import re
from typing import Iterable

from app.config import Settings
from app.schemas import ListingAnalysis

SALE_TERMS = re.compile(
    r"\b(for\s*sale|selling|available|price|ksh|kes|million|m\b|negotiable|mileage|km\b|cc\b|automatic|manual|diesel|petrol|hybrid|unit|sold|reserved)\b",
    re.IGNORECASE,
)
VEHICLE_TERMS = re.compile(
    r"\b(toyota|volkswagen|vw|mazda|subaru|mercedes|benz|bmw|audi|nissan|honda|lexus|ford|isuzu|mitsubishi|suzuki|volvo|peugeot|land\s*rover|range\s*rover|passat|prado|harrier|forester|cx-5|cx5|vitz|fit|note|hilux)\b",
    re.IGNORECASE,
)


def should_enrich(text: str, image_urls: Iterable[str]) -> bool:
    images = list(image_urls)
    if images:
        return True
    return bool(SALE_TERMS.search(text) and VEHICLE_TERMS.search(text))


class VehicleEnricher:
    def __init__(self, settings: Settings):
        self.settings = settings
        if not settings.openai_api_key:
            raise RuntimeError("OPENAI_API_KEY is not configured")
        from openai import OpenAI

        self.client = OpenAI(api_key=settings.openai_api_key)

    def analyze(self, text: str, image_urls: list[str]) -> ListingAnalysis:
        content: list[dict[str, str]] = [
            {
                "type": "input_text",
                "text": (
                    "Analyze this public vehicle-seller X post. Categorize the post and extract each vehicle offered. "
                    "Treat seller text as a claim, visible details as observations, and uncertain trim/specification guesses as AI inference. "
                    "Never claim mechanical condition, accident history, authenticity, or ownership from images. "
                    "Do not invent missing values. Normalize money to an integer amount and mileage to kilometres when explicitly stated.\n\n"
                    f"POST TEXT:\n{text}"
                ),
            }
        ]
        for url in image_urls[:8]:
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
