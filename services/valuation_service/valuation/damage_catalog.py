"""
Damage repair cost catalog based on damage-repair-costs-by-make.json.

Provides one indexed source of truth for:
  - make-specific part repair pricing
  - part-value percentages
  - per-part metadata for UI and valuation adjustments
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

DEFAULT_DAMAGE_MARKET = "GCC"
DEFAULT_DAMAGE_SEVERITY = "replace"

DAMAGE_SEVERITY_FACTORS: dict[str, dict[str, float | str]] = {
    "scratch": {
        "label": "Scratch",
        "price_multiplier": 0.35,
        "pct_multiplier": 0.2,
    },
    "dent": {
        "label": "Dent",
        "price_multiplier": 0.65,
        "pct_multiplier": 0.55,
    },
    "replace": {
        "label": "Replace",
        "price_multiplier": 1.0,
        "pct_multiplier": 1.0,
    },
}

DATASET_PATH = (
    Path(__file__).resolve().parents[3]
    / "promts"
    / "damage-repair-costs-by-make.json"
)


def _normalize_make(make: str | None) -> str:
    return " ".join((make or "").upper().split())


def _normalize_damage_selections(
    selected_damage: list[dict[str, Any]] | list[str] | tuple[str, ...] | None,
) -> list[dict[str, str]]:
    normalized: list[dict[str, str]] = []

    if not selected_damage:
        return normalized

    for item in selected_damage:
        if isinstance(item, str):
            part_id = item.strip()
            severity = DEFAULT_DAMAGE_SEVERITY
        elif isinstance(item, dict):
            part_id = str(
                item.get("id")
                or item.get("source_part_id")
                or item.get("part_id")
                or ""
            ).strip()
            severity = str(item.get("severity") or DEFAULT_DAMAGE_SEVERITY).strip().lower()
        else:
            continue

        if not part_id:
            continue

        if severity not in DAMAGE_SEVERITY_FACTORS:
            severity = DEFAULT_DAMAGE_SEVERITY

        normalized.append(
            {
                "id": part_id,
                "severity": severity,
            }
        )

    return normalized


@lru_cache(maxsize=1)
def _load_dataset() -> dict[str, Any]:
    with DATASET_PATH.open("r", encoding="utf-8") as file:
        return json.load(file)


@lru_cache(maxsize=1)
def _build_index() -> dict[str, Any]:
    dataset = _load_dataset()

    part_families: dict[str, dict[str, Any]] = {}
    source_id_to_family: dict[str, str] = {}
    make_profiles: dict[str, dict[str, Any]] = {}
    records_by_key: dict[tuple[str, str, str], dict[str, Any]] = {}

    for family in dataset["part_families"]:
        part_families[family["part_family"]] = family
        for source_id in family["source_part_ids"]:
            source_id_to_family[source_id] = family["part_family"]

    for profile in dataset["make_profiles"]:
        make_profiles[_normalize_make(profile["make"])] = profile

    for record in dataset["records"]:
        records_by_key[
            (
                _normalize_make(record["make"]),
                record["market"],
                record["part_family"],
            )
        ] = record

    return {
        "dataset": dataset,
        "part_families": part_families,
        "source_id_to_family": source_id_to_family,
        "make_profiles": make_profiles,
        "records_by_key": records_by_key,
    }


def _build_fallback_record(
    *,
    normalized_make: str,
    market: str,
    part_family: str,
    index: dict[str, Any],
) -> dict[str, Any] | None:
    profile = index["make_profiles"].get(normalized_make)
    market_baseline = index["dataset"]["market_baselines"].get(market, {})
    part_baseline = market_baseline.get("parts", {}).get(part_family)
    pct_baseline = index["dataset"]["part_share_baselines_pct"].get(part_family)
    family_meta = index["part_families"].get(part_family)

    if not profile or not part_baseline or not pct_baseline or not family_meta:
        return None

    multiplier = float(profile.get("make_multiplier") or 1)
    reference_price = float(profile.get("reference_price_aed") or 0)

    return {
        "market": market,
        "currency": market_baseline.get("currency", "AED"),
        "make": profile["make"],
        "vehicle_reference_price_aed": reference_price,
        "part_family": part_family,
        "source_part_ids": family_meta["source_part_ids"],
        "repair_scope": part_baseline["repair_scope"],
        "pricing_mode": "baseline_scaled_fallback",
        "min_price": round(float(part_baseline["min_price"]) * multiplier),
        "max_price": round(float(part_baseline["max_price"]) * multiplier),
        "typical_price": round(float(part_baseline["typical_price"]) * multiplier),
        "part_value_pct_of_vehicle_min": float(pct_baseline["min_pct"]),
        "part_value_pct_of_vehicle_max": float(pct_baseline["max_pct"]),
        "part_value_pct_of_vehicle_typical": float(pct_baseline["typical_pct"]),
        "part_value_pct_notes": pct_baseline["notes"],
        "confidence": "fallback",
        "source_count": len(part_baseline.get("source_ids", [])),
        "sources": [],
        "notes": part_baseline["notes"],
    }


def get_damage_profile(make: str, market: str = DEFAULT_DAMAGE_MARKET) -> dict[str, Any]:
    index = _build_index()
    normalized_make = _normalize_make(make)
    profile = index["make_profiles"].get(normalized_make)

    parts: list[dict[str, Any]] = []

    for family_name, family_meta in index["part_families"].items():
        record = index["records_by_key"].get((normalized_make, market, family_name))
        if record is None:
            record = _build_fallback_record(
                normalized_make=normalized_make,
                market=market,
                part_family=family_name,
                index=index,
            )

        if record is None:
            continue

        for source_part_id in family_meta["source_part_ids"]:
            parts.append(
                {
                    "source_part_id": source_part_id,
                    "part_family": family_name,
                    "part_family_label": family_meta["label"],
                    "market": record["market"],
                    "currency": record["currency"],
                    "vehicle_reference_price_aed": record["vehicle_reference_price_aed"],
                    "repair_scope": record["repair_scope"],
                    "pricing_mode": record["pricing_mode"],
                    "min_price": record["min_price"],
                    "max_price": record["max_price"],
                    "typical_price": record["typical_price"],
                    "part_value_pct_of_vehicle_min": record["part_value_pct_of_vehicle_min"],
                    "part_value_pct_of_vehicle_max": record["part_value_pct_of_vehicle_max"],
                    "part_value_pct_of_vehicle_typical": record["part_value_pct_of_vehicle_typical"],
                    "part_value_pct_notes": record["part_value_pct_notes"],
                    "confidence": record["confidence"],
                    "source_count": record["source_count"],
                    "sources": record.get("sources", []),
                    "notes": record["notes"],
                }
            )

    parts.sort(key=lambda item: (item["part_family_label"], item["source_part_id"]))

    return {
        "generated_at": index["dataset"]["generated_at"],
        "source_document": index["dataset"]["source_document"],
        "market": market,
        "currency": index["dataset"]["market_baselines"][market]["currency"],
        "make": profile["make"] if profile else normalized_make,
        "make_profile": profile,
        "parts": parts,
    }


def summarize_damage(
    *,
    make: str,
    selected_damage: list[dict[str, Any]] | list[str] | tuple[str, ...] | None,
    market: str = DEFAULT_DAMAGE_MARKET,
) -> dict[str, Any] | None:
    normalized_selections = _normalize_damage_selections(selected_damage)

    if not normalized_selections:
        return None

    profile = get_damage_profile(make, market)
    parts_by_id = {part["source_part_id"]: part for part in profile["parts"]}

    selected_parts: list[dict[str, Any]] = []
    selected_entries: list[dict[str, Any]] = []
    missing_part_ids: list[str] = []
    severity_breakdown = {
        severity: 0 for severity in DAMAGE_SEVERITY_FACTORS
    }

    for selection in normalized_selections:
        part_id = selection["id"]
        part = parts_by_id.get(part_id)
        if part is None:
            missing_part_ids.append(part_id)
            continue

        severity = selection["severity"]
        severity_profile = DAMAGE_SEVERITY_FACTORS[severity]
        price_multiplier = float(severity_profile["price_multiplier"])
        pct_multiplier = float(severity_profile["pct_multiplier"])

        selected_parts.append(part)
        severity_breakdown[severity] += 1
        selected_entries.append(
            {
                **part,
                "severity": severity,
                "severity_label": str(severity_profile["label"]),
                "severity_price_multiplier": price_multiplier,
                "severity_pct_multiplier": pct_multiplier,
                "adjusted_min_price": round(int(part["min_price"]) * price_multiplier),
                "adjusted_max_price": round(int(part["max_price"]) * price_multiplier),
                "adjusted_typical_price": round(int(part["typical_price"]) * price_multiplier),
                "adjusted_part_value_pct_min": round(
                    float(part["part_value_pct_of_vehicle_min"]) * pct_multiplier,
                    4,
                ),
                "adjusted_part_value_pct_max": round(
                    float(part["part_value_pct_of_vehicle_max"]) * pct_multiplier,
                    4,
                ),
                "adjusted_part_value_pct_typical": round(
                    float(part["part_value_pct_of_vehicle_typical"]) * pct_multiplier,
                    4,
                ),
            }
        )

    if not selected_parts:
        return None

    total_min_price = sum(int(part["adjusted_min_price"]) for part in selected_entries)
    total_max_price = sum(int(part["adjusted_max_price"]) for part in selected_entries)
    total_typical_price = sum(
        int(part["adjusted_typical_price"]) for part in selected_entries
    )

    total_pct_min = round(
        sum(float(part["adjusted_part_value_pct_min"]) for part in selected_entries),
        4,
    )
    total_pct_max = round(
        sum(float(part["adjusted_part_value_pct_max"]) for part in selected_entries),
        4,
    )
    total_pct_typical = round(
        sum(
            float(part["adjusted_part_value_pct_typical"])
            for part in selected_entries
        ),
        4,
    )

    return {
        "market": profile["market"],
        "currency": profile["currency"],
        "make": profile["make"],
        "generated_at": profile["generated_at"],
        "source_document": profile["source_document"],
        "selected_part_count": len(selected_parts),
        "unique_part_families": sorted({part["part_family"] for part in selected_parts}),
        "selected_parts": selected_parts,
        "selected_entries": selected_entries,
        "missing_part_ids": missing_part_ids,
        "severity_breakdown": severity_breakdown,
        "total_min_price": total_min_price,
        "total_max_price": total_max_price,
        "total_typical_price": total_typical_price,
        "total_pct_min": total_pct_min,
        "total_pct_max": total_pct_max,
        "total_pct_typical": total_pct_typical,
    }
