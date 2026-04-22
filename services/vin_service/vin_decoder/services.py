"""
Business logic layer for VIN Service.

Separation of concerns (promt.md §7):
- Views: HTTP concerns only
- Services: VIN decoding logic, DB routing, external API fallback
- Models: data structure

VIN structure (17 characters):
  Positions 1-3:   WMI (World Manufacturer Identifier) → manufacturer
  Positions 4-8:   VDS (Vehicle Descriptor Section) → model/body/engine
  Position 9:      Check digit
  Position 10:     Model year code → year from model_year table
  Position 11:     Assembly plant
  Positions 12-17: Serial number
"""

import re
import logging
from typing import Optional

from django.conf import settings  # noqa: F401 — used elsewhere

from .models import (
    VinBase, VinBase2000_2010, VinBase2010_2020,
    VinBaseBefore2000, VinBaseModern, VinBaseUnknownYears,
    ModelYear, WmiVds,
)

logger = logging.getLogger(__name__)


class VinValidationService:
    """Validates VIN format according to ISO 3779."""

    INVALID_CHARS = set('IOQ')  # Letters not used in VIN
    VIN_PATTERN = re.compile(r'^[A-HJ-NPR-Z0-9]{17}$')

    @staticmethod
    def validate(vin: str) -> tuple[bool, list[str]]:
        """
        Validate VIN format. Returns (is_valid, list_of_errors).
        """
        errors = []
        vin_upper = vin.upper().strip()

        if len(vin_upper) != 17:
            errors.append(f'VIN must be exactly 17 characters (got {len(vin_upper)}).')

        invalid_found = VinValidationService.INVALID_CHARS.intersection(set(vin_upper))
        if invalid_found:
            errors.append(f'VIN must not contain letters: {", ".join(sorted(invalid_found))}.')

        if not VinValidationService.VIN_PATTERN.match(vin_upper):
            errors.append('VIN contains invalid characters. Only A-Z (except I, O, Q) and 0-9 are allowed.')

        return len(errors) == 0, errors


class VinDecoderService:
    """
    Core VIN decoding service.

    Strategy:
    1. Validate VIN format
    2. Decode year from 10th character (model_year table)
    3. Decode manufacturer from WMI (wmi_vds table)
    4. Route to the correct vin_base partition based on year
    5. Search for the VIN in the partition
    6. If not found locally — fallback to NHTSA API
    """

    # Map year ranges to partition models for optimized search
    PARTITION_MAP = [
        (lambda y: y is not None and y >= 2020, VinBaseModern),
        (lambda y: y is not None and 2010 <= y < 2020, VinBase2010_2020),
        (lambda y: y is not None and 2000 <= y < 2010, VinBase2000_2010),
        (lambda y: y is not None and y < 2000, VinBaseBefore2000),
    ]

    @staticmethod
    def decode_year_from_vin(vin: str) -> Optional[int]:
        """
        Decode the model year from the 10th character of the VIN.

        Uses the model_year lookup table.
        """
        if len(vin) < 10:
            return None

        char_10th = vin[9].upper()

        try:
            entry = ModelYear.objects.filter(vin_10th=char_10th).first()
            if entry:
                return entry.actual_year
        except Exception as e:
            logger.warning(f'Error decoding year from VIN char "{char_10th}": {e}')

        return None

    @staticmethod
    def decode_manufacturer(vin: str) -> Optional[str]:
        """
        Decode the manufacturer from the WMI (first 3 characters of VIN).
        """
        if len(vin) < 3:
            return None

        wmi_code = vin[:3].upper()

        try:
            entry = WmiVds.objects.filter(wmi=wmi_code).first()
            if entry:
                return entry.manufacturer
        except Exception as e:
            logger.warning(f'Error decoding WMI "{wmi_code}": {e}')

        return None

    @staticmethod
    def _get_partition_model(year: Optional[int]):
        """Return the correct vin_base partition model based on year."""
        for condition, model_class in VinDecoderService.PARTITION_MAP:
            if condition(year):
                return model_class
        return None

    # Columns we actually need from vin_base (avoids SELECT * on wide table)
    LOCAL_FIELDS = ('vin', 'type', 'make', 'model_name', 'modelyear', 'power_hp', 'cubic')

    # All partition models in search priority order (most recent first)
    ALL_PARTITIONS = [VinBaseModern, VinBase2010_2020, VinBase2000_2010, VinBaseBefore2000]

    @staticmethod
    def _search_es_exact(vin: str) -> Optional[dict]:
        """
        Search for an exact VIN in Elasticsearch.
        Returns a dict matching LOCAL_FIELDS structure, or None if ES unavailable.
        """
        try:
            import sys, os
            parent = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
            if parent not in sys.path:
                sys.path.insert(0, parent)
            from shared.elasticsearch_utils import es_search

            results = es_search(
                'vin_records',
                {'term': {'vin': vin}},
                size=1,
                source_fields=['vin', 'type', 'make', 'model_name', 'modelyear', 'power_hp', 'cubic']
            )
            if results and len(results) > 0:
                logger.info(f'✅ VIN {vin} found in Elasticsearch')
                return results[0]
            return None

        except Exception as e:
            logger.debug(f'ES exact search failed for {vin}: {e}')
            return None

    @staticmethod
    def _search_es_vds(vin: str) -> Optional[dict]:
        """
        Search for VDS (first 8 chars) match in Elasticsearch.
        Much faster than PostgreSQL regex across 5 partitions.
        """
        if len(vin) < 8:
            return None

        try:
            import sys, os
            parent = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
            if parent not in sys.path:
                sys.path.insert(0, parent)
            from shared.elasticsearch_utils import es_search

            vds_part = vin[:8]
            results = es_search(
                'vin_records',
                {'term': {'vin_prefix8': vds_part}},
                size=100,
                source_fields=['vin', 'type', 'make', 'model_name', 'modelyear', 'power_hp', 'cubic']
            )

            if not results:
                return None

            # If only one match, return it
            if len(results) == 1:
                return results[0]

            # Pick the most common configuration (same logic as PostgreSQL VDS search)
            from collections import Counter
            counts = Counter()
            for r in results:
                key = (r.get('type'), r.get('make'), r.get('model_name'),
                       r.get('modelyear'), r.get('power_hp'))
                counts[key] += 1

            best_key = counts.most_common(1)[0][0]
            for r in results:
                if (r.get('type'), r.get('make'), r.get('model_name'),
                    r.get('modelyear'), r.get('power_hp')) == best_key:
                    return r

            return results[0]

        except Exception as e:
            logger.debug(f'ES VDS search failed for {vin}: {e}')
            return None

    @staticmethod
    def search_local(vin: str, year: Optional[int] = None) -> Optional[dict]:
        """
        Search for a VIN in the local database.

        Strategy (ES-first with PostgreSQL fallback):
        1. Try Elasticsearch exact match (single query, ~2ms)
        2. If ES unavailable → fall back to partition-based PostgreSQL search
        """
        vin_upper = vin.upper().strip()

        # ── 1. Try Elasticsearch first ──
        es_result = VinDecoderService._search_es_exact(vin_upper)
        if es_result is not None:
            return es_result

        # ── 2. PostgreSQL fallback (partition-based) ──
        logger.debug(f'ES miss/unavailable for {vin_upper} — falling back to PostgreSQL')
        fields = VinDecoderService.LOCAL_FIELDS

        tried = set()
        if year is not None:
            partition_model = VinDecoderService._get_partition_model(year)
            if partition_model:
                tried.add(partition_model)
                record = (
                    partition_model.objects
                    .filter(vin=vin_upper)
                    .only(*fields)
                    .first()
                )
                if record:
                    return record

        for model_class in VinDecoderService.ALL_PARTITIONS:
            if model_class in tried:
                continue
            record = (
                model_class.objects
                .filter(vin=vin_upper)
                .only(*fields)
                .first()
            )
            if record:
                return record

        record = (
            VinBaseUnknownYears.objects
            .filter(vin=vin_upper)
            .only(*fields)
            .first()
        )
        return record

    @staticmethod
    def search_nhtsa(vin: str) -> Optional[dict]:
        """
        Fallback: query NHTSA vPIC API via the vpic-api library.

        Uses vpic.Client (raw dict mode) — returns a flat dict with
        PascalCase keys from the NHTSA response. We map them to our
        standardized snake_case field names for the frontend.
        """
        try:
            from vpic import Client

            client = Client()
            result = client.decode_vin(vin)

            # vpic.Client returns a dict with PascalCase keys
            # Check if we got useful data
            make = result.get('Make')
            if not make or not str(make).strip():
                return None

            def _safe(key: str) -> Optional[str]:
                """Get value from result, return None if empty/missing."""
                val = result.get(key)
                if val is None:
                    return None
                val_str = str(val).strip()
                if not val_str or val_str.lower() == 'not applicable':
                    return None
                return val_str

            def _safe_int(key: str) -> Optional[int]:
                """Get integer value from result."""
                val = result.get(key)
                if val is None:
                    return None
                try:
                    return int(val)
                except (ValueError, TypeError):
                    return None

            nhtsa_data = {
                # Core vehicle identity
                'make':          _safe('Make'),
                'model_name':    _safe('Model'),
                'modelyear':     _safe_int('ModelYear'),
                'trim':          _safe('Trim'),
                'series':        _safe('Series'),

                # Body & chassis
                'body':          _safe('BodyClass'),
                'body_class':    _safe('BodyClass'),
                'doors':         _safe('Doors'),
                'gvwr':          _safe('GVWRFrom'),

                # Powertrain
                'engine':        _safe('DisplacementL'),
                'displacement_l': _safe('DisplacementL'),
                'engine_cylinders': _safe('EngineCylinders'),
                'fuel_type':     _safe('FuelTypePrimary'),
                'engine_model':  _safe('EngineModel'),
                'engine_hp':     _safe('EngineHP'),
                'power_hp':      _safe('EngineHP'),

                # Transmission & drivetrain
                'transmission':       _safe('TransmissionStyle'),
                'transmission_style': _safe('TransmissionStyle'),
                'drivetrain':         _safe('DriveType'),
                'drive_type':         _safe('DriveType'),

                # Classification
                'type':           _safe('VehicleType'),
                'vehicle_type':   _safe('VehicleType'),
                'category':       _safe('VehicleType'),

                # Manufacturer info
                'manufacturer':   _safe('Manufacturer'),
                'plant_country':  _safe('PlantCountry'),
                'plant_city':     _safe('PlantCity'),

                # Additional fields useful for frontend
                'year_from_vin':  _safe_int('ModelYear'),
                'vin':            _safe('VIN'),
            }

            # Remove None values to keep the dict clean
            nhtsa_data = {k: v for k, v in nhtsa_data.items() if v is not None}

            return nhtsa_data if nhtsa_data.get('make') else None

        except Exception as e:
            logger.error(f'NHTSA vpic-api error for VIN {vin}: {e}')
            return None

    @staticmethod
    def search_vds_extended(vin: str) -> Optional[dict]:
        """
        VDS Extended: chars 1-8 + char 11 match exactly, closest last 6 digits.
        """
        if len(vin) != 17: return None
        vds_part = vin[:8]
        char_11 = vin[10]
        serial_str = vin[11:]
        
        is_digit_serial = serial_str.isdigit()
        serial_int = int(serial_str) if is_digit_serial else 0

        # PostgreSQL regex: matches start with 8 chars, exactly 2 any chars, then 11th char
        regex_pattern = f"^{vds_part}..{char_11}"
        fields = VinDecoderService.LOCAL_FIELDS

        for model_class in VinDecoderService.ALL_PARTITIONS + [VinBaseUnknownYears]:
            qs = model_class.objects.filter(vin__regex=regex_pattern).only(*fields)[:100]
            matches = list(qs)
            
            if matches:
                if not is_digit_serial:
                    return matches[0]
                    
                best_match = None
                min_diff = float('inf')
                
                for m in matches:
                    m_serial_str = m.vin[11:]
                    if m_serial_str.isdigit():
                        diff = abs(int(m_serial_str) - serial_int)
                        if diff < min_diff:
                            min_diff = diff
                            best_match = m
                            
                return best_match or matches[0]
                
        return None

    @staticmethod
    def search_vds(vin: str) -> Optional[dict]:
        """
        VDS: chars 1-8 match. Finds the most common vehicle configuration.
        """
        if len(vin) < 8: return None
        vds_part = vin[:8]
        fields = VinDecoderService.LOCAL_FIELDS

        for model_class in VinDecoderService.ALL_PARTITIONS + [VinBaseUnknownYears]:
            qs = model_class.objects.filter(vin__startswith=vds_part).only(*fields)[:200]
            matches = list(qs)
            
            if matches:
                from collections import Counter
                counts = Counter()
                for m in matches:
                    key = (m.type, m.make, m.model_name, m.modelyear, m.power_hp)
                    counts[key] += 1
                
                best_key = counts.most_common(1)[0][0]
                
                for m in matches:
                    if (m.type, m.make, m.model_name, m.modelyear, m.power_hp) == best_key:
                        return m
        return None

    @staticmethod
    def decode(vin: str) -> dict:
        """
        Full VIN decode pipeline.

        Returns a dict with: vin, is_valid, manufacturer, year_from_vin,
        source ('local_db' | 'local_db_vds_ext' | 'local_db_vds' | 'nhtsa_api' | 'fallback_wmi'), 
        vehicle data.
        """
        # Step 1: Validate
        is_valid, errors = VinValidationService.validate(vin)
        if not is_valid:
            return {
                'vin': vin.upper(),
                'is_valid': False,
                'manufacturer': None,
                'year_from_vin': None,
                'source': 'validation_failed',
                'vehicle': None,
                'errors': errors,
            }

        vin_upper = vin.upper().strip()

        # Step 2: Decode metadata
        year_from_vin = VinDecoderService.decode_year_from_vin(vin_upper)
        manufacturer = VinDecoderService.decode_manufacturer(vin_upper)

        # Step 3: Query NHTSA first
        nhtsa_record = VinDecoderService.search_nhtsa(vin_upper)
        if nhtsa_record:
            return {
                'vin': vin_upper,
                'is_valid': True,
                'manufacturer': manufacturer or nhtsa_record.get('make'),
                'year_from_vin': year_from_vin or nhtsa_record.get('modelyear'),
                'source': 'nhtsa_api',
                'vehicle': nhtsa_record,
            }

        # Step 4: Search local database
        record = VinDecoderService.search_local(vin_upper, year_from_vin)
        if record:
            return {
                'vin': vin_upper,
                'is_valid': True,
                'manufacturer': manufacturer,
                'year_from_vin': year_from_vin,
                'source': 'local_db',
                'vehicle': record,
            }

        # Step 5: Search VDS Extended
        vds_ext_record = VinDecoderService.search_vds_extended(vin_upper)
        if vds_ext_record:
            vds_ext_record.vin = vin_upper  # override so frontend sees requested VIN
            return {
                'vin': vin_upper,
                'is_valid': True,
                'manufacturer': manufacturer,
                'year_from_vin': year_from_vin,
                'source': 'local_db_vds_ext',
                'vehicle': vds_ext_record,
            }

        # Step 6: Search VDS
        vds_record = VinDecoderService.search_vds(vin_upper)
        if vds_record:
            vds_record.vin = vin_upper
            return {
                'vin': vin_upper,
                'is_valid': True,
                'manufacturer': manufacturer,
                'year_from_vin': year_from_vin,
                'source': 'local_db_vds',
                'vehicle': vds_record,
            }

        # Step 7: Fallback WMI + Year only (nothing found)
        # Phase 3.3
        fallback_record = {
            'vin': vin_upper,
            'make': manufacturer,
            'modelyear': year_from_vin,
            'type': None,
            'model_name': None,
            'power_hp': None,
        }
        
        return {
            'vin': vin_upper,
            'is_valid': True,
            'manufacturer': manufacturer,
            'year_from_vin': year_from_vin,
            'source': 'fallback_wmi',
            'vehicle': fallback_record,
        }
