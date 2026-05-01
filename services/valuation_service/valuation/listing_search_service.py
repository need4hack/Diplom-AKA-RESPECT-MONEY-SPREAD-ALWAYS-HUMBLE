"""
Bridge between valuation_service and the standalone listing_search package.

The implementation is intentionally lazy-loaded so the valuation service
keeps working even if listing-search dependencies are not installed yet.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

from django.conf import settings

from .services import ValuationError

PROJECT_ROOT = Path(__file__).resolve().parents[3]


def _ensure_project_root_on_path() -> None:
    project_root_str = str(PROJECT_ROOT)
    if project_root_str not in sys.path:
        sys.path.insert(0, project_root_str)


class ListingSearchBridge:
    @staticmethod
    def search(query: dict) -> dict:
        _ensure_project_root_on_path()

        try:
            from listing_search.models import VehicleQuery
            from listing_search.service import ListingSearchService
        except Exception as exc:  # pragma: no cover - import availability depends on env
            raise ValuationError(
                "Listing search is unavailable. Install listing_search dependencies first."
            ) from exc

        sites = [
            item.strip()
            for item in getattr(settings, "LISTING_SEARCH_SITES", ["autoru", "drom"])
            if item and str(item).strip()
        ]
        limit_per_site = max(1, min(int(getattr(settings, "LISTING_SEARCH_LIMIT_PER_SITE", 4)), 10))
        proxy_url = getattr(settings, "LISTING_SEARCH_PROXY", "") or os.getenv("LISTING_SEARCH_PROXY", "")

        service = ListingSearchService(
            use_browser=bool(getattr(settings, "LISTING_SEARCH_USE_BROWSER", False)),
            headless=bool(getattr(settings, "LISTING_SEARCH_HEADLESS", True)),
            proxy_url=proxy_url,
        )
        try:
            vehicle_query = VehicleQuery.from_dict(
                {
                    "year": query.get("year"),
                    "make": query.get("make", ""),
                    "model": query.get("model", ""),
                }
            )
            return service.search(
                query=vehicle_query,
                sites=sites,
                limit_per_site=limit_per_site,
            )
        finally:
            service.close()
