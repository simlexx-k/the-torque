from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


EvidenceSource = Literal[
    "seller_text",
    "seller_image",
    "ocr",
    "visual_inference",
    "reference_data",
    "ai_inference",
    "unknown",
]


class StringEvidence(BaseModel):
    value: str | None = None
    source: EvidenceSource = "unknown"
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)


class IntegerEvidence(BaseModel):
    value: int | None = None
    source: EvidenceSource = "unknown"
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)


class FeatureEvidence(BaseModel):
    name: str
    source: EvidenceSource
    confidence: float = Field(ge=0.0, le=1.0)


class VehicleCandidate(BaseModel):
    make: StringEvidence = Field(default_factory=StringEvidence)
    model: StringEvidence = Field(default_factory=StringEvidence)
    generation: StringEvidence = Field(default_factory=StringEvidence)
    variant: StringEvidence = Field(default_factory=StringEvidence)
    year: IntegerEvidence = Field(default_factory=IntegerEvidence)
    body_type: StringEvidence = Field(default_factory=StringEvidence)
    fuel: StringEvidence = Field(default_factory=StringEvidence)
    engine_cc: IntegerEvidence = Field(default_factory=IntegerEvidence)
    transmission: StringEvidence = Field(default_factory=StringEvidence)
    drivetrain: StringEvidence = Field(default_factory=StringEvidence)
    colour: StringEvidence = Field(default_factory=StringEvidence)
    mileage_km: IntegerEvidence = Field(default_factory=IntegerEvidence)
    price: IntegerEvidence = Field(default_factory=IntegerEvidence)
    currency: StringEvidence = Field(default_factory=lambda: StringEvidence(value="KES", source="ai_inference", confidence=0.5))
    location: StringEvidence = Field(default_factory=StringEvidence)
    status: Literal["available", "reserved", "sold", "unknown"] = "unknown"
    features: list[FeatureEvidence] = Field(default_factory=list)
    observations: list[str] = Field(default_factory=list)


class ListingAnalysis(BaseModel):
    classification: Literal[
        "new_listing",
        "listing_update",
        "price_drop",
        "sold",
        "reserved",
        "relisted",
        "multiple_vehicles",
        "general_automotive_post",
        "advertisement",
        "non_vehicle",
        "unknown",
    ]
    is_vehicle_listing: bool
    vehicles: list[VehicleCandidate] = Field(default_factory=list)
    summary: str
