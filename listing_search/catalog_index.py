from __future__ import annotations

import json
import re
import threading
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlparse

from .models import VehicleQuery


PROJECT_ROOT = Path(__file__).resolve().parents[1]
CATALOG_DIRS = (
    PROJECT_ROOT / "autoru_fast_scraper" / "autoru_fast_data_v2" / "parsed",
    PROJECT_ROOT / "autoru_fast_scraper" / "autoru_fast_data" / "parsed",
    PROJECT_ROOT / "autoru" / "catalog_scraper" / "autoru_data",
)

MODEL_KEYS = ("Модель", "РњРѕРґРµР»СЊ")
BODY_KEYS = ("Тип кузова", "РўРёРї РєСѓР·РѕРІР°")
YEAR_KEYS = ("Год", "Р“РѕРґ")
MODIFICATION_KEYS = ("Модификация", "РњРѕРґРёС„РёРєР°С†РёСЏ")
ENGINE_GROUP_KEYS = ("Двигатель", "Р”РІРёРіР°С‚РµР»СЊ", "General")
TRANSMISSION_GROUP_KEYS = ("Трансмиссия", "РўСЂР°РЅСЃРјРёСЃСЃРёСЏ")
ENGINE_VOLUME_KEYS = ("Объем двигателя", "РћР±СЉРµРј РґРІРёРіР°С‚РµР»СЏ")
ENGINE_POWER_KEYS = ("Максимальная мощность", "РњР°РєСЃРёРјР°Р»СЊРЅР°СЏ РјРѕС‰РЅРѕСЃС‚СЊ")
TRANSMISSION_KEYS = ("Коробка передач", "РљРѕСЂРѕР±РєР° РїРµСЂРµРґР°С‡")
DRIVETRAIN_KEYS = ("Тип привода", "РўРёРї РїСЂРёРІРѕРґР°")


def normalize_text(value: str | None) -> str:
    if not value:
        return ""
    value = str(value).replace("\xa0", " ").strip().lower()
    value = value.replace("\u0451", "\u0435")
    return re.sub(r"\s+", " ", value)


def normalize_compact(value: str | None) -> str:
    return re.sub(r"[\s\-_./]+", "", normalize_text(value))


def pick_value(payload: dict, aliases: tuple[str, ...]) -> str:
    for alias in aliases:
        if alias in payload and payload[alias]:
            return str(payload[alias]).strip()
    return ""


def pick_nested_value(payload: dict, group_aliases: tuple[str, ...], value_aliases: tuple[str, ...]) -> str:
    for alias in group_aliases:
        group = payload.get(alias)
        if not isinstance(group, dict):
            continue
        for value_alias in value_aliases:
            if value_alias in group and group[value_alias]:
                return str(group[value_alias]).strip()
    return ""


def parse_year_range(raw_value: str) -> tuple[int | None, int | None]:
    years = [int(item) for item in re.findall(r"\d{4}", raw_value or "")]
    if not years:
        return None, None
    if len(years) == 1:
        return years[0], years[0]
    return years[0], years[1]


def build_used_offers_url(source_url: str) -> str:
    if not source_url:
        return ""
    parsed = urlparse(source_url)
    parts = parsed.path.strip("/").split("/")
    if len(parts) < 6:
        return ""
    if parts[0] != "catalog" or parts[1] != "cars":
        return ""
    return f"{parsed.scheme}://{parsed.netloc}/cars/{parts[2]}/{parts[3]}/{parts[4]}/{parts[5]}/used/"


@dataclass(slots=True)
class AutoruCatalogRecord:
    file_path: str
    source_url: str
    used_offers_url: str
    make_slug: str
    model_slug: str
    model_title: str
    body: str
    modification: str
    year_from: int | None
    year_to: int | None
    engine_volume: str
    engine_power: str
    transmission: str
    drivetrain: str

    def score(self, query: VehicleQuery) -> int:
        score = 0
        make_expected = normalize_compact(query.make)
        model_expected = normalize_compact(query.model)
        trim_expected = normalize_text(query.trim)
        body_expected = normalize_text(query.body)
        transmission_expected = normalize_text(query.transmission)
        drivetrain_expected = normalize_text(query.drivetrain)
        engine_expected = normalize_compact(query.engine)

        if make_expected == normalize_compact(self.make_slug):
            score += 40

        title_compact = normalize_compact(self.model_title)
        slug_compact = normalize_compact(self.model_slug)
        if model_expected and (model_expected == slug_compact or model_expected in title_compact):
            score += 70
        elif model_expected:
            return -1

        if self.year_from is not None and self.year_to is not None:
            if self.year_from <= query.year <= self.year_to:
                score += 25
            elif abs(self.year_from - query.year) <= 1 or abs(self.year_to - query.year) <= 1:
                score += 5

        if trim_expected:
            modification_text = normalize_text(self.modification)
            if trim_expected == modification_text:
                score += 35
            elif trim_expected and trim_expected in modification_text:
                score += 20

        if body_expected:
            body_text = normalize_text(self.body)
            if body_expected == body_text:
                score += 12
            elif body_expected in body_text or body_text in body_expected:
                score += 6

        if transmission_expected:
            transmission_text = normalize_text(self.transmission)
            if transmission_expected == transmission_text:
                score += 10
            elif transmission_expected in transmission_text:
                score += 5

        if drivetrain_expected:
            drivetrain_text = normalize_text(self.drivetrain)
            if drivetrain_expected == drivetrain_text:
                score += 10
            elif drivetrain_expected in drivetrain_text:
                score += 5

        if engine_expected:
            engine_text = normalize_compact(" ".join((self.engine_volume, self.engine_power)))
            if engine_expected in engine_text:
                score += 8

        return score


class AutoruCatalogIndex:
    _records: list[AutoruCatalogRecord] | None = None
    _lock = threading.Lock()

    @classmethod
    def _iter_catalog_files(cls) -> list[Path]:
        files: list[Path] = []
        for directory in CATALOG_DIRS:
            if directory.exists():
                files.extend(sorted(directory.rglob("*_specs_parsed.json")))
        return files

    @classmethod
    def _build_record(cls, file_path: Path, payload: dict) -> AutoruCatalogRecord | None:
        source_url = str(payload.get("source_url", "")).strip()
        if not source_url:
            return None

        parsed = urlparse(source_url)
        parts = parsed.path.strip("/").split("/")
        if len(parts) < 6:
            return None

        model_title = pick_value(payload, MODEL_KEYS)
        body = pick_value(payload, BODY_KEYS)
        modification = pick_value(payload, MODIFICATION_KEYS)
        year_from, year_to = parse_year_range(pick_value(payload, YEAR_KEYS))
        engine_volume = pick_nested_value(payload, ENGINE_GROUP_KEYS, ENGINE_VOLUME_KEYS)
        engine_power = pick_nested_value(payload, ENGINE_GROUP_KEYS, ENGINE_POWER_KEYS)
        transmission = pick_nested_value(payload, TRANSMISSION_GROUP_KEYS, TRANSMISSION_KEYS)
        drivetrain = pick_nested_value(payload, TRANSMISSION_GROUP_KEYS, DRIVETRAIN_KEYS)

        return AutoruCatalogRecord(
            file_path=str(file_path),
            source_url=source_url,
            used_offers_url=build_used_offers_url(source_url),
            make_slug=parts[2],
            model_slug=parts[3],
            model_title=model_title,
            body=body,
            modification=modification,
            year_from=year_from,
            year_to=year_to,
            engine_volume=engine_volume,
            engine_power=engine_power,
            transmission=transmission,
            drivetrain=drivetrain,
        )

    @classmethod
    def load(cls) -> list[AutoruCatalogRecord]:
        if cls._records is not None:
            return cls._records

        with cls._lock:
            if cls._records is not None:
                return cls._records

            records: list[AutoruCatalogRecord] = []
            for file_path in cls._iter_catalog_files():
                try:
                    payload = json.loads(file_path.read_text(encoding="utf-8"))
                except Exception:
                    continue
                record = cls._build_record(file_path, payload)
                if record:
                    records.append(record)

            cls._records = records
            return cls._records

    @classmethod
    def find_best_matches(cls, query: VehicleQuery, limit: int = 5) -> list[AutoruCatalogRecord]:
        scored: list[tuple[int, AutoruCatalogRecord]] = []
        for record in cls.load():
            score = record.score(query)
            if score > 0 and record.used_offers_url:
                scored.append((score, record))

        scored.sort(
            key=lambda item: (
                -item[0],
                abs((item[1].year_from or query.year) - query.year),
                item[1].file_path,
            )
        )

        results: list[AutoruCatalogRecord] = []
        seen_urls: set[str] = set()
        for score, record in scored:
            if record.used_offers_url in seen_urls:
                continue
            seen_urls.add(record.used_offers_url)
            results.append(record)
            if len(results) >= limit:
                break
        return results
