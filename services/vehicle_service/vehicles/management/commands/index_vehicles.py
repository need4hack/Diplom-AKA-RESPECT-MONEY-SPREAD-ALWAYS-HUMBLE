"""
Elasticsearch index definition and management command for vehicle catalog.

Index: vehicles
- 155K documents from model_db table
- Optimized for: cascading filters (terms aggregations), full-text search
"""

import logging
import sys
import os

from django.core.management.base import BaseCommand

logger = logging.getLogger(__name__)

INDEX_NAME = 'vehicles'

INDEX_MAPPING = {
    'properties': {
        'id':            {'type': 'integer'},
        'region':        {'type': 'keyword'},
        'year':          {'type': 'integer'},
        'make':          {'type': 'keyword'},
        'model':         {'type': 'keyword'},
        'trim':          {'type': 'keyword'},
        'body':          {'type': 'keyword'},
        'engine':        {'type': 'keyword'},
        'transmission':  {'type': 'keyword'},
        'cylinder':      {'type': 'integer'},
        'doors':         {'type': 'integer'},
        'seats':         {'type': 'integer'},
        'category':      {'type': 'keyword'},
        'fuel':          {'type': 'keyword'},
        'drivetrain':    {'type': 'keyword'},
        'mileage':       {'type': 'keyword'},
        'depreciation':  {'type': 'keyword'},
        'new_price':     {'type': 'integer'},
        'today_price':   {'type': 'integer'},
        'is_active':     {'type': 'boolean'},
    }
}

INDEX_SETTINGS = {
    'number_of_shards': 1,          # 155K docs → single shard is fine
    'number_of_replicas': 0,
}


def vehicle_to_doc(record) -> dict:
    """Convert a ModelDB instance to an ES document."""
    return {
        'id':            record.id,
        'region':        record.region or '',
        'year':          record.year,
        'make':          record.make or '',
        'model':         record.model or '',
        'trim':          record.trim or '',
        'body':          record.body or '',
        'engine':        record.engine or '',
        'transmission':  record.transmission or '',
        'cylinder':      record.cylinder,
        'doors':         record.doors,
        'seats':         record.seats,
        'category':      record.category or '',
        'fuel':          record.fuel or '',
        'drivetrain':    record.drivetrain or '',
        'mileage':       record.mileage or '',
        'depreciation':  record.depreciation or '',
        'new_price':     record.new_price,
        'today_price':   record.today_price,
        'is_active':     record.is_active,
    }


class Command(BaseCommand):
    """
    Management command: python manage.py index_vehicles

    Indexes all active vehicles from model_db into Elasticsearch.
    """
    help = 'Index all vehicles into Elasticsearch'

    def add_arguments(self, parser):
        parser.add_argument(
            '--batch-size', type=int, default=5000,
            help='Number of records per batch (default: 5000)'
        )
        parser.add_argument(
            '--recreate', action='store_true',
            help='Delete and recreate the index before indexing'
        )

    def handle(self, *args, **options):
        parent = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..'))
        if parent not in sys.path:
            sys.path.insert(0, parent)

        from shared.elasticsearch_utils import get_es_client, ensure_index, bulk_index_docs

        es = get_es_client()
        if es is None:
            self.stderr.write(self.style.ERROR('❌ Cannot connect to Elasticsearch'))
            return

        if options['recreate']:
            try:
                es.indices.delete(index=INDEX_NAME, ignore_unavailable=True)
                self.stdout.write(f'🗑️  Deleted index "{INDEX_NAME}"')
            except Exception as e:
                self.stderr.write(f'Warning: {e}')

        ensure_index(INDEX_NAME, INDEX_MAPPING, INDEX_SETTINGS)

        from vehicles.models import ModelDB

        count = ModelDB.objects.filter(is_active=True).count()
        self.stdout.write(f'📦 Indexing {count:,} active vehicles...')

        batch_size = options['batch_size']
        docs = []
        total = 0

        for record in ModelDB.objects.filter(is_active=True).iterator(chunk_size=batch_size):
            docs.append(vehicle_to_doc(record))

            if len(docs) >= batch_size:
                bulk_index_docs(INDEX_NAME, docs, id_field='id', batch_size=batch_size)
                total += len(docs)
                docs = []
                self.stdout.write(f'   Progress: {total:,}/{count:,}')

        if docs:
            bulk_index_docs(INDEX_NAME, docs, id_field='id', batch_size=batch_size)
            total += len(docs)

        self.stdout.write(self.style.SUCCESS(
            f'🎉 Indexed {total:,} vehicles into "{INDEX_NAME}"'
        ))
