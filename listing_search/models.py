from __future__ import annotations

from dataclasses import asdict, dataclass, field


@dataclass(slots=True)
class VehicleQuery:
    make: str
    model: str
    year: int
    trim: str = ""
    body: str = ""
    engine: str = ""
    transmission: str = ""
    drivetrain: str = ""

    @classmethod
    def from_dict(cls, payload: dict) -> "VehicleQuery":
        return cls(
            make=str(payload.get("make", "")).strip(),
            model=str(payload.get("model", "")).strip(),
            year=int(payload.get("year")),
            trim=str(payload.get("trim", "")).strip(),
            body=str(payload.get("body", "")).strip(),
            engine=str(payload.get("engine", "")).strip(),
            transmission=str(payload.get("transmission", "")).strip(),
            drivetrain=str(payload.get("drivetrain", "")).strip(),
        )

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass(slots=True)
class ListingResult:
    site: str
    title: str
    url: str
    price_rub: int | None = None
    price_text: str = ""
    image_url: str = ""
    photos: list[str] = field(default_factory=list)
    summary: str = ""
    search_url: str = ""
    matched_via: str = ""
    year: int | None = None
    mileage_km: int | None = None
    city: str = ""
    trim: str = ""
    engine: str = ""
    power_hp: int | None = None
    transmission: str = ""
    drivetrain: str = ""
    color: str = ""
    owners_count: int | None = None
    steering_wheel: str = ""
    generation: str = ""
    score: int = 0

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass(slots=True)
class ProviderRunResult:
    site: str
    ok: bool
    listings: list[ListingResult] = field(default_factory=list)
    search_urls: list[str] = field(default_factory=list)
    error: str = ""

    def to_dict(self) -> dict:
        return {
            "site": self.site,
            "ok": self.ok,
            "search_urls": list(self.search_urls),
            "error": self.error,
            "results": [item.to_dict() for item in self.listings],
        }
