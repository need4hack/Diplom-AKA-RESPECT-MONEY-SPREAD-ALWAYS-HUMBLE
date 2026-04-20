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
        vehicle_id: int,
        actual_mileage: int,
        is_new: bool = False,
        valuation_year: Optional[int] = None,
        damage_part_ids: Optional[list[str]] = None,
        damage_selections: Optional[list[dict]] = None,
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
        vehicle = ValuationService.get_vehicle(vehicle_id)
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
        }
