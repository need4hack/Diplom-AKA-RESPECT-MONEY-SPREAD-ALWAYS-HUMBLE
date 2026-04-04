"""
Business logic layer for Vehicle Service.

Separation of concerns (promt.md §7):
- Views handle HTTP request/response
- Services handle business logic and DB queries
- Models handle data structure

ES-first strategy: tries Elasticsearch terms aggregation for cascading
filters (much faster than SQL DISTINCT), falls back to PostgreSQL.
"""

import logging
import sys
import os
from typing import Any

from django.db.models import QuerySet

from .models import ModelDB

logger = logging.getLogger(__name__)


def _get_es_utils():
    """Lazy import of shared ES utilities."""
    try:
        import sys
        import os
        # __file__ = services/vehicle_service/vehicles/services.py
        # parent should point to "services" folder
        parent = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
        if parent not in sys.path:
            sys.path.insert(0, parent)
            
        from shared.elasticsearch_utils import es_terms_agg, es_search
        return es_terms_agg, es_search
    except ImportError as e:
        logger.error(f"Failed to import shared.elasticsearch_utils: {e}")
        return None, None



class VehicleCatalogService:
    """
    Service layer for cascading filters.

    Each method returns a sorted list of unique values
    filtered by the previously selected parameters.
    """

    ALLOWED_FIELDS = {
        'year', 'make', 'model', 'trim', 'body', 'engine',
        'transmission', 'region', 'doors', 'seats', 'cylinder',
        'drivetrain', 'fuel', 'category',
    }

    @staticmethod
    def _active_vehicles() -> QuerySet:
        """Base queryset: only active vehicles."""
        return ModelDB.objects.filter(is_active=True)

    @staticmethod
    def get_years() -> list[int]:
        """Return all available years, descending."""
        return (
            VehicleCatalogService._active_vehicles()
            .values_list('year', flat=True)
            .distinct()
            .order_by('-year')
        )

    @staticmethod
    def get_makes(year: int) -> list[str]:
        """Return makes available for a given year."""
        return (
            VehicleCatalogService._active_vehicles()
            .filter(year=year)
            .values_list('make', flat=True)
            .distinct()
            .order_by('make')
        )

    @staticmethod
    def get_models(year: int, make: str) -> list[str]:
        """Return models for a given year + make."""
        return (
            VehicleCatalogService._active_vehicles()
            .filter(year=year, make=make)
            .values_list('model', flat=True)
            .distinct()
            .order_by('model')
        )

    @staticmethod
    def get_trims(year: int, make: str, model: str) -> list[str]:
        """Return trims for a given year + make + model."""
        return (
            VehicleCatalogService._active_vehicles()
            .filter(year=year, make=make, model=model)
            .values_list('trim', flat=True)
            .distinct()
            .order_by('trim')
        )

    @staticmethod
    def get_body_types(year: int, make: str, model: str, trim: str) -> list[str]:
        """Return body types for a given year + make + model + trim."""
        return (
            VehicleCatalogService._active_vehicles()
            .filter(year=year, make=make, model=model, trim=trim)
            .values_list('body', flat=True)
            .distinct()
            .order_by('body')
        )

    @staticmethod
    def get_engines(year: int, make: str, model: str, trim: str, body: str) -> list[str]:
        """Return engines for the given filter chain."""
        return (
            VehicleCatalogService._active_vehicles()
            .filter(year=year, make=make, model=model, trim=trim, body=body)
            .values_list('engine', flat=True)
            .distinct()
            .order_by('engine')
        )

    @staticmethod
    def get_transmissions(
        year: int, make: str, model: str,
        trim: str, body: str, engine: str,
    ) -> list[str]:
        """Return transmissions for the given filter chain."""
        return (
            VehicleCatalogService._active_vehicles()
            .filter(
                year=year, make=make, model=model,
                trim=trim, body=body, engine=engine,
            )
            .values_list('transmission', flat=True)
            .distinct()
            .order_by('transmission')
        )

    @staticmethod
    def find_vehicles(**filters: Any) -> QuerySet:
        """
        Find vehicles matching all provided filters.

        Accepts any combination of: year, make, model, trim, body,
        engine, transmission, region, doors, seats, cylinder.
        """
        qs = VehicleCatalogService._active_vehicles()
        valid_fields = VehicleCatalogService.ALLOWED_FIELDS
        clean_filters = {
            k: v for k, v in filters.items()
            if k in valid_fields and v is not None
        }
        return qs.filter(**clean_filters)

    @staticmethod
    def get_options(field: str, **filters: Any) -> list:
        """
        Generic method: return distinct values of `field`
        filtered by all provided parameters.

        Strategy: ES terms aggregation first → PostgreSQL DISTINCT fallback.
        """
        allowed = VehicleCatalogService.ALLOWED_FIELDS
        if field not in allowed:
            return []

        # ── 1. Try Elasticsearch terms aggregation ──
        es_terms_agg, _ = _get_es_utils()
        if es_terms_agg is not None:
            es_filters = {'is_active': True}
            for k, v in filters.items():
                if k in allowed and v:
                    # Convert year to int for ES term filter
                    if k == 'year':
                        try:
                            es_filters[k] = int(v)
                        except (ValueError, TypeError):
                            es_filters[k] = v
                    else:
                        es_filters[k] = v

            order = 'desc' if field == 'year' else 'asc'
            es_result = es_terms_agg('vehicles', field, es_filters, size=1000, order=order)

            if es_result is not None:
                logger.debug(f'✅ ES agg for {field}: {len(es_result)} values')
                return es_result

        # ── 2. PostgreSQL fallback ──
        logger.debug(f'ES unavailable for {field} — falling back to PostgreSQL')
        qs = VehicleCatalogService._active_vehicles()
        for k, v in filters.items():
            if k in allowed and v:
                qs = qs.filter(**{k: v})

        ordering = f'-{field}' if field == 'year' else field
        return (
            qs.values_list(field, flat=True)
            .distinct()
            .order_by(ordering)
        )
