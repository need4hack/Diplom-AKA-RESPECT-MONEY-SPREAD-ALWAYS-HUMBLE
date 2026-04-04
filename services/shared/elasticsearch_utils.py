"""
Shared Elasticsearch utilities for CarSpecs microservices.

Provides:
- Singleton ES client with connection pooling
- Index creation helpers with mappings
- Bulk indexing with progress logging
- Search helpers with PostgreSQL fallback on failure

Usage:
    from shared.elasticsearch_utils import get_es_client, bulk_index_docs, es_search
"""

import logging
from typing import Optional

from django.conf import settings

logger = logging.getLogger(__name__)

# Module-level singleton
_es_client = None


def get_es_client():
    """
    Return a singleton Elasticsearch client.

    Uses ELASTICSEARCH_HOST from Django settings.
    Returns None if elasticsearch-py is not installed or host not configured.
    """
    global _es_client
    # If we already confirmed ES is down or missing, skip further attempts
    if _es_client is False:
        return None

    if _es_client is not None:
        return _es_client

    try:
        from elasticsearch import Elasticsearch

        host = getattr(settings, 'ELASTICSEARCH_HOST', None)
        if not host:
            logger.info('ELASTICSEARCH_HOST not configured — ES disabled')
            _es_client = False
            return None

        # Try to connect with minimal retries for the initial ping to fail fast
        temp_client = Elasticsearch(
            hosts=[host],
            request_timeout=2,  # Fail fast initially
            max_retries=1,
            retry_on_timeout=False,
        )

        # Quick health check
        if temp_client.ping():
            # If successful, create the real client with robust production settings
            _es_client = Elasticsearch(
                hosts=[host],
                request_timeout=30,
                max_retries=3,
                retry_on_timeout=True,
            )
            logger.info(f'✅ Connected to Elasticsearch at {host}')
        else:
            logger.warning(f'⚠️ Elasticsearch at {host} not responding — falling back to PostgreSQL')
            _es_client = False

    except ImportError:
        logger.warning('elasticsearch-py not installed — ES disabled')
        _es_client = False
    except Exception as e:
        logger.error(f'Elasticsearch connection error: {e}')
        _es_client = False

    # Return None instead of False to callers
    return _es_client if _es_client is not False else None


def ensure_index(index_name: str, mappings: dict, settings_body: Optional[dict] = None):
    """
    Create an ES index if it doesn't exist.

    Args:
        index_name: Name of the index
        mappings: ES mapping dict ({"properties": {...}})
        settings_body: Optional index settings (shards, replicas, etc.)
    """
    es = get_es_client()
    if es is None:
        return False

    try:
        if es.indices.exists(index=index_name):
            logger.info(f'Index "{index_name}" already exists')
            return True

        body = {'mappings': mappings}
        if settings_body:
            body['settings'] = settings_body

        es.indices.create(index=index_name, body=body)
        logger.info(f'✅ Created index "{index_name}"')
        return True

    except Exception as e:
        logger.error(f'Failed to create index "{index_name}": {e}')
        return False


def bulk_index_docs(index_name: str, docs: list[dict], id_field: str = 'id',
                    batch_size: int = 5000):
    """
    Bulk index documents into Elasticsearch.

    Args:
        index_name: Target index
        docs: List of dicts to index
        id_field: Field to use as document _id
        batch_size: Number of docs per bulk request
    """
    es = get_es_client()
    if es is None:
        logger.warning('ES client not available — skipping bulk index')
        return 0

    from elasticsearch.helpers import bulk

    total = 0
    actions = []

    for doc in docs:
        action = {
            '_index': index_name,
            '_id': doc.get(id_field, None),
            '_source': doc,
        }
        actions.append(action)

        if len(actions) >= batch_size:
            success, errors = bulk(es, actions, raise_on_error=False)
            total += success
            if errors:
                logger.warning(f'Bulk index errors: {len(errors)}')
            actions = []
            logger.info(f'  Indexed {total} docs into "{index_name}"...')

    # Flush remaining
    if actions:
        success, errors = bulk(es, actions, raise_on_error=False)
        total += success

    logger.info(f'✅ Bulk indexed {total} docs into "{index_name}"')
    return total


def es_search(index_name: str, query: dict, size: int = 10,
              source_fields: Optional[list[str]] = None) -> Optional[list[dict]]:
    """
    Execute a search query against Elasticsearch.

    Returns list of _source dicts, or None if ES is unavailable.
    Returning None signals the caller to fall back to PostgreSQL.
    """
    es = get_es_client()
    if es is None:
        return None

    try:
        body = {'query': query, 'size': size}
        if source_fields:
            body['_source'] = source_fields

        result = es.search(index=index_name, body=body)
        hits = result.get('hits', {}).get('hits', [])
        return [hit['_source'] for hit in hits]

    except Exception as e:
        logger.error(f'ES search error on "{index_name}": {e}')
        return None  # Signal fallback to PostgreSQL


def es_terms_agg(index_name: str, field: str, filters: Optional[dict] = None,
                 size: int = 1000, order: str = 'asc') -> Optional[list]:
    """
    Get distinct values for a field using ES terms aggregation.

    Much faster than PostgreSQL DISTINCT + ORDER BY on large tables.
    Returns sorted list of values, or None for fallback to PostgreSQL.
    """
    es = get_es_client()
    if es is None:
        return None

    try:
        # Build filter clauses
        must_clauses = []
        if filters:
            for k, v in filters.items():
                if v is not None and str(v).strip():
                    must_clauses.append({'term': {k: v}})

        query = {'bool': {'must': must_clauses}} if must_clauses else {'match_all': {}}

        body = {
            'size': 0,
            'query': query,
            'aggs': {
                'unique_values': {
                    'terms': {
                        'field': field,
                        'size': size,
                        'order': {'_key': order},
                    }
                }
            }
        }

        result = es.search(index=index_name, body=body)
        buckets = result.get('aggregations', {}).get('unique_values', {}).get('buckets', [])
        return [b['key'] for b in buckets]

    except Exception as e:
        logger.error(f'ES terms agg error on "{index_name}.{field}": {e}')
        return None
