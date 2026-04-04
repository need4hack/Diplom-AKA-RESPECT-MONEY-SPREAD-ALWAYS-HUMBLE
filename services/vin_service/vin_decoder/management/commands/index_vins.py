"""
Elasticsearch index definition and management commands for VIN records.

Index: vin_records
- 29M+ documents from 6 PostgreSQL partitions
- Optimized for: exact VIN lookup, VDS prefix search, WMI lookup
"""

import logging
import sys

from django.core.management.base import BaseCommand

logger = logging.getLogger(__name__)

# ─── Index name ──────────────────────────────────────────────
INDEX_NAME = 'vin_records'

# ─── Mapping ─────────────────────────────────────────────────
INDEX_MAPPING = {
    'properties': {
        'vin':          {'type': 'keyword'},            # exact match (PK)
        'vin_prefix8':  {'type': 'keyword'},            # VDS search (first 8 chars)
        'wmi':          {'type': 'keyword'},            # WMI (first 3 chars)
        'make':         {'type': 'keyword'},
        'model_name':   {'type': 'keyword'},
        'modelyear':    {'type': 'integer'},
        'type':         {'type': 'keyword'},
        'power_hp':     {'type': 'keyword'},
        'cubic':        {'type': 'keyword'},
    }
}

INDEX_SETTINGS = {
    'number_of_shards': 3,          # distribute 29M docs across shards
    'number_of_replicas': 0,        # single node → no replicas needed
    'refresh_interval': '30s',      # during bulk index, reduce refresh frequency
}


def vin_record_to_doc(record) -> dict:
    """Convert a Django VinBase model instance to an ES document."""
    vin = record.vin or ''
    return {
        'vin':          vin,
        'vin_prefix8':  vin[:8] if len(vin) >= 8 else vin,
        'wmi':          vin[:3] if len(vin) >= 3 else vin,
        'make':         record.make or '',
        'model_name':   record.model_name or '',
        'modelyear':    record.modelyear,
        'type':         record.type or '',
        'power_hp':     str(record.power_hp or ''),
        'cubic':        str(record.cubic or ''),
    }


class Command(BaseCommand):
    """
    Management command: python manage.py index_vins

    Indexes all VIN records from all partitions into Elasticsearch.
    Uses batch processing to handle 29M+ records without OOM.
    """
    help = 'Index all VIN records into Elasticsearch'

    def add_arguments(self, parser):
        parser.add_argument(
            '--batch-size', type=int, default=5000,
            help='Number of records per batch (default: 5000)'
        )
        parser.add_argument(
            '--partition', type=str, default=None,
            help='Index only a specific partition (modern, 2010_2020, 2000_2010, before_2000, unknown)'
        )
        parser.add_argument(
            '--recreate', action='store_true',
            help='Delete and recreate the index before indexing'
        )

    def handle(self, *args, **options):
        # Add shared to path
        import os
        shared_path = os.path.join(os.path.dirname(__file__), '..', '..', '..', '..', 'shared')
        sys.path.insert(0, os.path.abspath(shared_path))
        # Use absolute import path
        parent = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..'))
        if parent not in sys.path:
            sys.path.insert(0, parent)

        from shared.elasticsearch_utils import get_es_client, ensure_index, bulk_index_docs

        es = get_es_client()
        if es is None:
            self.stderr.write(self.style.ERROR('❌ Cannot connect to Elasticsearch'))
            return

        # Recreate index if requested
        if options['recreate']:
            try:
                es.indices.delete(index=INDEX_NAME, ignore_unavailable=True)
                self.stdout.write(f'🗑️  Deleted index "{INDEX_NAME}"')
            except Exception as e:
                self.stderr.write(f'Warning: {e}')

        # Ensure index exists
        ensure_index(INDEX_NAME, INDEX_MAPPING, INDEX_SETTINGS)

        # Import partition models
        from vin_decoder.models import (
            VinBaseModern, VinBase2010_2020, VinBase2000_2010,
            VinBaseBefore2000, VinBaseUnknownYears,
        )

        PARTITIONS = {
            'modern':      VinBaseModern,
            '2010_2020':   VinBase2010_2020,
            '2000_2010':   VinBase2000_2010,
            'before_2000': VinBaseBefore2000,
            'unknown':     VinBaseUnknownYears,
        }

        target = options['partition']
        if target:
            if target not in PARTITIONS:
                self.stderr.write(f'Unknown partition: {target}. Use: {", ".join(PARTITIONS.keys())}')
                return
            partitions = {target: PARTITIONS[target]}
        else:
            partitions = PARTITIONS

        batch_size = options['batch_size']
        total_indexed = 0

        # Fields to load from DB (minimal set)
        fields = ('vin', 'type', 'make', 'model_name', 'modelyear', 'power_hp', 'cubic')

        for name, model_class in partitions.items():
            self.stdout.write(f'\n📦 Indexing partition: {name} ({model_class._meta.db_table})')

            count = model_class.objects.count()
            self.stdout.write(f'   Total records: {count:,}')

            # Stream in batches using iterator()
            docs = []
            processed = 0

            for record in model_class.objects.only(*fields).iterator(chunk_size=batch_size):
                docs.append(vin_record_to_doc(record))
                processed += 1

                if len(docs) >= batch_size:
                    bulk_index_docs(INDEX_NAME, docs, id_field='vin', batch_size=batch_size)
                    total_indexed += len(docs)
                    docs = []
                    progress = (processed / count * 100) if count > 0 else 0
                    self.stdout.write(f'   Progress: {processed:,}/{count:,} ({progress:.1f}%)')

            # Flush remaining
            if docs:
                bulk_index_docs(INDEX_NAME, docs, id_field='vin', batch_size=batch_size)
                total_indexed += len(docs)

            self.stdout.write(self.style.SUCCESS(f'   ✅ Done: {processed:,} records'))

        # Reset refresh interval for normal operation
        try:
            es.indices.put_settings(
                index=INDEX_NAME,
                body={'index': {'refresh_interval': '1s'}}
            )
        except Exception:
            pass

        self.stdout.write(self.style.SUCCESS(
            f'\n🎉 Total indexed: {total_indexed:,} VIN records into "{INDEX_NAME}"'
        ))
