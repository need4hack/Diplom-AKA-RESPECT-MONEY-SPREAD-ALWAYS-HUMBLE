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

from django.core.exceptions import FieldDoesNotExist
from django.db.models import Count
from django.db.models import QuerySet
from django.db import models

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
    MASTER_FIELD_ORDER = [
        'id', 'region', 'year', 'logo', 'make', 'model', 'trim', 'body',
        'engine', 'transmission', 'cylinder', 'doors', 'seats', 'axle',
        'mileage', 'depreciation', 'category', 'fuel', 'drivetrain',
        'new_price', 'today_price', 'is_active',
    ]
    NON_CREATABLE_MASTER_FIELDS = {'id', 'is_active'}
    MASTER_RECORD_REQUIRED_FIELDS = {
        'region',
        'year',
        'make',
        'model',
        'trim',
        'body',
        'engine',
        'transmission',
    }

    @staticmethod
    def _active_vehicles() -> QuerySet:
        """Base queryset: only active vehicles."""
        return ModelDB.objects.filter(is_active=True)

    @staticmethod
    def _get_model_field(field_name: str):
        try:
            return ModelDB._meta.get_field(field_name)
        except FieldDoesNotExist as exc:
            raise ValueError(f'Unsupported field: {field_name}') from exc

    @staticmethod
    def list_master_fields() -> list[dict[str, Any]]:
        """Return model_db columns for the masters sidebar."""
        field_map = {field.name: field for field in ModelDB._meta.fields}
        fields: list[dict[str, Any]] = []

        for field_name in VehicleCatalogService.MASTER_FIELD_ORDER:
            field = field_map.get(field_name)
            if field is None:
                continue

            fields.append({
                'name': field.name,
                'label': field.verbose_name.replace('_', ' ').title(),
                'data_type': field.get_internal_type(),
                'editable': field.name not in VehicleCatalogService.NON_CREATABLE_MASTER_FIELDS,
            })

        return fields

    @staticmethod
    def get_master_values(
        field_name: str,
        *,
        search: str | None = None,
        page: int = 1,
        page_size: int = 50,
    ) -> dict[str, Any]:
        """Return paginated unique values and occurrence counts for a model_db field."""
        field = VehicleCatalogService._get_model_field(field_name)

        queryset = ModelDB.objects.exclude(**{f'{field_name}__isnull': True})
        if isinstance(field, models.CharField):
            queryset = queryset.exclude(**{field_name: ''})

        cleaned_search = (search or '').strip()
        if cleaned_search:
            if isinstance(field, models.CharField):
                queryset = queryset.filter(**{f'{field_name}__icontains': cleaned_search})
            elif isinstance(field, (models.IntegerField, models.AutoField)):
                try:
                    queryset = queryset.filter(**{field_name: int(cleaned_search)})
                except ValueError:
                    return {'count': 0, 'results': []}
            elif isinstance(field, models.BooleanField):
                normalized = cleaned_search.lower()
                if normalized in {'true', '1', 'yes'}:
                    queryset = queryset.filter(**{field_name: True})
                elif normalized in {'false', '0', 'no'}:
                    queryset = queryset.filter(**{field_name: False})
                else:
                    return {'count': 0, 'results': []}

        grouped = queryset.values(field_name).annotate(occurrences=Count(field_name))
        ordering = f'-{field_name}' if field_name in {'id', 'year'} else field_name
        grouped = grouped.order_by(ordering)

        total_count = grouped.count()
        start_index = max(page - 1, 0) * page_size
        end_index = start_index + page_size

        results = [
            {
                'value': row[field_name],
                'display_value': str(row[field_name]),
                'occurrences': row['occurrences'],
            }
            for row in grouped[start_index:end_index]
        ]

        return {'count': total_count, 'results': results}

    @staticmethod
    def _normalize_model_value(field_name: str, raw_value: Any) -> Any:
        field = VehicleCatalogService._get_model_field(field_name)

        if raw_value is None:
            return None

        if isinstance(field, models.BooleanField):
            if isinstance(raw_value, bool):
                return raw_value

            normalized = str(raw_value).strip().lower()
            if normalized in {'true', '1', 'yes'}:
                return True
            if normalized in {'false', '0', 'no'}:
                return False
            raise ValueError(f'Field "{field_name}" expects true/false.')

        value = str(raw_value).strip()
        if value == '':
            return None

        if isinstance(field, (models.IntegerField, models.AutoField)):
            try:
                return int(value)
            except ValueError as exc:
                raise ValueError(f'Field "{field_name}" expects an integer.') from exc

        return value

    @staticmethod
    def create_master_value(field_name: str, raw_value: str) -> ModelDB:
        """
        Create a placeholder model_db row carrying a new distinct value for one column.

        This lets admins gradually build up future vehicle configurations from the masters page.
        Placeholder rows are stored as inactive until the full vehicle is assembled.
        """
        if field_name in VehicleCatalogService.NON_CREATABLE_MASTER_FIELDS:
            raise ValueError(f'Field "{field_name}" cannot be created directly.')

        parsed_value = VehicleCatalogService._normalize_model_value(field_name, raw_value)
        if parsed_value is None:
            raise ValueError(f'Field "{field_name}" cannot be empty.')

        if ModelDB.objects.filter(**{field_name: parsed_value}).exists():
            raise ValueError(f'Value "{parsed_value}" already exists in "{field_name}".')

        return ModelDB.objects.create(is_active=False, **{field_name: parsed_value})

    @staticmethod
    def create_master_record(payload: dict[str, Any]) -> ModelDB:
        """
        Create a full vehicle configuration in model_db from assembled master values.

        Required fields ensure the record is identifiable in cascading filters,
        while optional fields let admins enrich the entry gradually.
        """
        cleaned_data: dict[str, Any] = {}

        for field_name in VehicleCatalogService.MASTER_FIELD_ORDER:
            if field_name == 'id' or field_name not in payload:
                continue

            cleaned_data[field_name] = VehicleCatalogService._normalize_model_value(
                field_name,
                payload[field_name],
            )

        missing_fields = []
        for field_name in VehicleCatalogService.MASTER_RECORD_REQUIRED_FIELDS:
            value = cleaned_data.get(field_name)
            if value is None or value == '':
                missing_fields.append(field_name)

        if missing_fields:
            missing = ', '.join(sorted(missing_fields))
            raise ValueError(f'Missing required fields: {missing}.')

        cleaned_data.setdefault('is_active', True)

        duplicate_filter = {
            'region': cleaned_data.get('region'),
            'year': cleaned_data.get('year'),
            'make': cleaned_data.get('make'),
            'model': cleaned_data.get('model'),
            'trim': cleaned_data.get('trim'),
            'body': cleaned_data.get('body'),
            'engine': cleaned_data.get('engine'),
            'transmission': cleaned_data.get('transmission'),
        }

        if ModelDB.objects.filter(**duplicate_filter).exists():
            raise ValueError(
                'A vehicle with the same region/year/make/model/trim/body/engine/transmission already exists.'
            )

        return ModelDB.objects.create(**cleaned_data)

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
