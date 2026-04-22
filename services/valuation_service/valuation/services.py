"""
Valuation Service — Core Business Logic.

Implements the vehicle valuation formula:
    age = current_year - vehicle_year
    depreciation_rate = depreciation[yearN_perc]
    avg_mileage = mileage_cat.maileage_per_year × age
    mileage_delta = actual_mileage - avg_mileage

    if mileage_delta > 0:
        mileage_adjustment = cpkm_plus × mileage_delta
    else:
        mileage_adjustment = cpkm_minus × abs(mileage_delta)

    medium = today_price × (1 - depreciation_rate / 100) - mileage_adjustment
    high   = medium × 1.10
    low    = medium × 0.90

Separation of concerns (promt.md §7):
    Views handle HTTP → Services handle math → Models handle DB.
"""

import logging
import re
from datetime import date
from typing import Optional

from .models import ModelDB, Depreciation, MileageCategory
from .damage_catalog import summarize_damage

logger = logging.getLogger(__name__)


def _parse_key(raw_value: str) -> str:
    """
    Extract the lookup key from model_db fields that may contain extra info.

    Examples:
        'F (24000)' → 'F'
        'D1'        → 'D1'
        'D1 (10%)'  → 'D1'
    """
    return raw_value.strip().split('(')[0].strip().split()[0]


def _normalize_text(value: Optional[str]) -> str:
    if value is None:
        return ""
    return re.sub(r"\s+", " ", str(value).strip().lower())


def _normalize_compact(value: Optional[str]) -> str:
    return re.sub(r"\s+", "", _normalize_text(value))


def _normalize_engine(value: Optional[str]) -> str:
    normalized = _normalize_text(value)
    normalized = re.sub(r"\b(l|liter|liters)\b", " ", normalized)
    normalized = re.sub(r"\s+", " ", normalized).strip()
    return normalized


def _extract_engine_displacement(value: Optional[str]) -> str:
    match = re.search(r"\d+(?:[.,]\d+)?", str(value or ""))
    return match.group(0).replace(",", ".") if match else ""


def _normalize_trim(value: Optional[str]) -> str:
    normalized = _normalize_text(value)
    normalized = re.sub(
        r"\b(4m|4matic|4 motion|xdrive|quattro|awd|fwd|rwd|4wd|2wd|4x4|4x2)\b",
        " ",
        normalized,
    )
    return re.sub(r"\s+", " ", normalized).strip()


def _drivetrain_aliases(value: Optional[str]) -> set[str]:
    normalized = _normalize_text(value)
    aliases = {normalized, normalized.replace(" ", "")}

    if re.search(r"(awd|all wheel drive|4wd|4x4|four wheel drive)", normalized):
        aliases.update({"awd", "4wd", "4x4", "all wheel drive"})
    if re.search(r"(fwd|front wheel drive)", normalized):
        aliases.update({"fwd", "front wheel drive", "2wd", "4x2"})
    if re.search(r"(rwd|rear wheel drive)", normalized):
        aliases.update({"rwd", "rear wheel drive", "2wd", "4x2"})
    if re.search(r"(2wd|4x2|two wheel drive)", normalized):
        aliases.update({"2wd", "4x2", "fwd", "rwd", "awd"})

    return {alias for alias in aliases if alias}


class ValuationError(Exception):
    """Raised when valuation cannot be computed due to missing data."""
    pass


class ValuationService:
    """
    Stateless service class for vehicle valuation calculations.

    All methods are @staticmethod — no instance state needed (SOLID / SRP).
    """

    HIGH_MULTIPLIER = 1.10
    LOW_MULTIPLIER = 0.90

    @staticmethod
    def _apply_damage_adjustment(base_value: int, repair_cost: int, damage_pct: float) -> int:
        if base_value <= 0:
            return 0

        pct_adjustment = round(base_value * max(damage_pct, 0) / 100)
        requested_adjustment = max(repair_cost, pct_adjustment)
        capped_adjustment = min(requested_adjustment, round(base_value * 0.95))
        return max(capped_adjustment, 0)

    @staticmethod
    def get_vehicle(vehicle_id: int) -> ModelDB:
        """Fetch a vehicle by its primary key and validate required fields."""
        try:
            vehicle = ModelDB.objects.get(pk=vehicle_id, is_active=True)
        except ModelDB.DoesNotExist:
            raise ValuationError(f'Vehicle with ID {vehicle_id} not found.')

        if not vehicle.today_price:
            raise ValuationError(
                f'Vehicle {vehicle} has no today_price — cannot valuate.'
            )
        if not vehicle.year:
            raise ValuationError(
                f'Vehicle {vehicle} has no year — cannot calculate age.'
            )
        return vehicle

    @staticmethod
    def _field_score(expected: Optional[str], actual: Optional[str], *, mode: str = "text") -> int:
        if not expected:
            return 0

        if mode == "engine":
            expected_norm = _normalize_engine(expected)
            actual_norm = _normalize_engine(actual)
            expected_num = _extract_engine_displacement(expected)
            actual_num = _extract_engine_displacement(actual)

            if expected_norm and expected_norm == actual_norm:
                return 5
            if expected_num and expected_num == actual_num:
                return 4
            if expected_num and actual_norm and expected_num in actual_norm:
                return 2
            return -4

        if mode == "trim":
            expected_norm = _normalize_trim(expected)
            actual_norm = _normalize_trim(actual)
            if expected_norm and expected_norm == actual_norm:
                return 5
            if expected_norm and actual_norm and (
                expected_norm in actual_norm or actual_norm in expected_norm
            ):
                return 3
            return -3

        if mode == "drivetrain":
            expected_aliases = _drivetrain_aliases(expected)
            actual_aliases = _drivetrain_aliases(actual)
            if expected_aliases and expected_aliases.intersection(actual_aliases):
                return 4
            return -2

        expected_norm = _normalize_text(expected)
        actual_norm = _normalize_text(actual)
        if expected_norm and expected_norm == actual_norm:
            return 4
        if expected_norm and actual_norm and (
            expected_norm in actual_norm or actual_norm in expected_norm
        ):
            return 1
        return -2

    @staticmethod
    def resolve_vehicle(
        *,
        year: int,
        make: str,
        model: str,
        trim: Optional[str] = None,
        body: Optional[str] = None,
        engine: Optional[str] = None,
        transmission: Optional[str] = None,
        drivetrain: Optional[str] = None,
        region: Optional[str] = None,
        category: Optional[str] = None,
    ) -> ModelDB:
        """
        Resolve a vehicle from model_db using a constrained, deterministic lookup.

        Required fields:
        - year
        - make
        - model

        Optional fields improve ranking. We do not allow completely broad lookup
        because that would be ambiguous and unsafe for external clients.
        """
        queryset = ModelDB.objects.filter(
            is_active=True,
            year=year,
            make__iexact=make,
            model__iexact=model,
        )

        if region:
            queryset = queryset.filter(region__iexact=region)
        if body:
            queryset = queryset.filter(body__iexact=body)
        if transmission:
            queryset = queryset.filter(transmission__iexact=transmission)
        if category:
            queryset = queryset.filter(category__iexact=category)

        candidates = list(queryset[:200])
        if not candidates:
            raise ValuationError(
                "Vehicle lookup did not match any active model_db record. "
                "Provide a valid vehicle_id or refine year/make/model."
            )

        if len(candidates) == 1 and not any([trim, engine, drivetrain]):
            return candidates[0]

        scored_candidates: list[tuple[int, int, ModelDB]] = []
        for candidate in candidates:
            score = 0
            score += ValuationService._field_score(trim, candidate.trim, mode="trim")
            score += ValuationService._field_score(engine, candidate.engine, mode="engine")
            score += ValuationService._field_score(drivetrain, candidate.drivetrain, mode="drivetrain")
            score += ValuationService._field_score(body, candidate.body)
            score += ValuationService._field_score(transmission, candidate.transmission)
            score += ValuationService._field_score(region, candidate.region)
            score += ValuationService._field_score(category, candidate.category)
            scored_candidates.append((score, candidate.id, candidate))

        scored_candidates.sort(key=lambda item: (-item[0], item[1]))
        best_score, _, best_candidate = scored_candidates[0]

        if len(scored_candidates) > 1 and best_score == scored_candidates[1][0]:
            raise ValuationError(
                "Vehicle lookup is ambiguous. Refine the request with trim, engine, "
                "drivetrain, or use an explicit vehicle_id."
            )

        if best_score < 0:
            raise ValuationError(
                "Vehicle lookup did not produce a confident match. Provide a vehicle_id "
                "or refine trim/engine/drivetrain."
            )

        return best_candidate

    @staticmethod
    def get_depreciation_schedule(vehicle: ModelDB) -> Depreciation:
        """Fetch the depreciation schedule linked to the vehicle."""
        raw = vehicle.depreciation
        if not raw:
            raise ValuationError(
                f'Vehicle {vehicle} has no depreciation schedule assigned.'
            )
        dep_name = _parse_key(raw)
        try:
            return Depreciation.objects.get(depreciation_name=dep_name)
        except Depreciation.DoesNotExist:
            raise ValuationError(
                f'Depreciation schedule "{dep_name}" (raw: "{raw}") not found in database.'
            )

    @staticmethod
    def get_mileage_category(vehicle: ModelDB) -> MileageCategory:
        """Fetch the mileage category linked to the vehicle."""
        raw = vehicle.mileage
        if not raw:
            raise ValuationError(
                f'Vehicle {vehicle} has no mileage category assigned.'
            )
        cat_key = _parse_key(raw)
        try:
            return MileageCategory.objects.get(category=cat_key)
        except MileageCategory.DoesNotExist:
            raise ValuationError(
                f'Mileage category "{cat_key}" (raw: "{raw}") not found in database.'
            )

    @staticmethod
    def calculate_age(vehicle_year: int, valuation_year: Optional[int] = None) -> int:
        """
        Calculate vehicle age in whole years.

        If valuation_year is not provided, uses the current calendar year.
        Returns at least 0 (for brand-new vehicles).
        """
        reference_year = valuation_year or date.today().year
        return max(0, reference_year - vehicle_year)

    @staticmethod
    def calculate(
        vehicle_id: Optional[int],
        actual_mileage: int,
        is_new: bool = False,
        valuation_year: Optional[int] = None,
        damage_part_ids: Optional[list[str]] = None,
        damage_selections: Optional[list[dict]] = None,
        vehicle_lookup: Optional[dict] = None,
    ) -> dict:
        """
        Main valuation pipeline.

        Args:
            vehicle_id: PK of the vehicle in model_db.
            actual_mileage: Odometer reading in km.
            is_new: If True, skip depreciation (vehicle is brand new on the lot).
            valuation_year: Override year for age calculation (default: current year).

        Returns:
            dict with keys: vehicle_id, today_price, new_price, age,
            depreciation_rate, avg_mileage, mileage_delta,
            mileage_adjustment, high, medium, low, currency.
        """
        # 1. Fetch vehicle
        resolved_by = "vehicle_id"
        if vehicle_id is not None:
            vehicle = ValuationService.get_vehicle(vehicle_id)
        elif vehicle_lookup:
            vehicle = ValuationService.resolve_vehicle(**vehicle_lookup)
            vehicle_id = vehicle.id
            resolved_by = "lookup"
        else:
            raise ValuationError("Provide either vehicle_id or vehicle lookup fields.")

        today_price = vehicle.today_price
        new_price = vehicle.new_price or 0

        # 2. Calculate age
        age = ValuationService.calculate_age(vehicle.year, valuation_year)

        # 3. Depreciation
        if is_new or age == 0:
            depreciation_rate = 0
        else:
            dep_schedule = ValuationService.get_depreciation_schedule(vehicle)
            rate = dep_schedule.get_rate_for_year(age)
            depreciation_rate = rate if rate is not None else 0

        # 4. Mileage adjustment
        if is_new:
            avg_mileage = 0
            actual_mileage = 0
            mileage_delta = 0
            mileage_adjustment = 0
        else:
            mileage_cat = ValuationService.get_mileage_category(vehicle)

            avg_yearly_str = mileage_cat.maileage_per_year or '0'
            digits_only = re.sub(r'[^\d]', '', str(avg_yearly_str))
            avg_yearly = int(digits_only) if digits_only else 0

            avg_mileage = avg_yearly * max(age, 1)
            mileage_delta = actual_mileage - avg_mileage

            if mileage_delta > 0:
                cpkm = mileage_cat.cpkm_plus or 0
            else:
                cpkm = mileage_cat.cpkm_minus or 0

            mileage_adjustment = round(cpkm * abs(mileage_delta))

        # 5. Core formula
        depreciated_price = today_price * (1 - depreciation_rate / 100)

        if is_new:
            medium = depreciated_price
        elif mileage_delta > 0:
            # High mileage penalty cap (car retains at least 10% of depreciated value)
            max_penalty = depreciated_price * 0.90
            mileage_adjustment = min(mileage_adjustment, max_penalty)
            medium = depreciated_price - mileage_adjustment
        else:
            # Low mileage reward cap (reward max 30% of depreciated value)
            max_reward = depreciated_price * 0.30
            mileage_adjustment = min(mileage_adjustment, max_reward)
            medium = depreciated_price + mileage_adjustment

        mileage_adjustment = round(mileage_adjustment)
        medium = max(round(medium), 0)
        high = max(round(medium * ValuationService.HIGH_MULTIPLIER), 0)
        low = max(round(medium * ValuationService.LOW_MULTIPLIER), 0)

        base_medium = medium
        base_high = high
        base_low = low

        damage_summary = summarize_damage(
            make=vehicle.make or "",
            selected_damage=damage_selections or damage_part_ids,
        )

        if damage_summary:
            high_adjustment = ValuationService._apply_damage_adjustment(
                base_high,
                int(damage_summary["total_min_price"]),
                float(damage_summary["total_pct_min"]),
            )
            medium_adjustment = ValuationService._apply_damage_adjustment(
                base_medium,
                int(damage_summary["total_typical_price"]),
                float(damage_summary["total_pct_typical"]),
            )
            low_adjustment = ValuationService._apply_damage_adjustment(
                base_low,
                int(damage_summary["total_max_price"]),
                float(damage_summary["total_pct_max"]),
            )

            high = max(base_high - high_adjustment, 0)
            medium = max(base_medium - medium_adjustment, 0)
            low = max(base_low - low_adjustment, 0)

            damage_summary = {
                **damage_summary,
                "high_adjustment": high_adjustment,
                "medium_adjustment": medium_adjustment,
                "low_adjustment": low_adjustment,
            }

        logger.info(
            f"Valuation: vehicle_id={vehicle_id}, age={age}, "
            f"dep_rate={depreciation_rate}%, mileage_delta={mileage_delta}km, "
            f"adj={mileage_adjustment}, H/M/L={high}/{medium}/{low}"
        )

        return {
            'vehicle_id': vehicle_id,
            'vehicle_name': str(vehicle),
            'today_price': today_price,
            'new_price': new_price,
            'year': vehicle.year,
            'age': age,
            'depreciation_name': vehicle.depreciation,
            'depreciation_rate': depreciation_rate,
            'mileage_category': vehicle.mileage,
            'avg_mileage': avg_mileage,
            'actual_mileage': actual_mileage,
            'mileage_delta': mileage_delta,
            'mileage_adjustment': mileage_adjustment,
            'base_high': base_high,
            'base_medium': base_medium,
            'base_low': base_low,
            'high': high,
            'medium': medium,
            'low': low,
            'currency': 'AED',
            'damage_summary': damage_summary,
            'resolved_by': resolved_by,
        }
