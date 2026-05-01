from __future__ import annotations

from .fetchers import PlaywrightFetcher, RequestsFetcher
from .models import ProviderRunResult, VehicleQuery
from .providers import AutoruListingProvider, BidCarsListingProvider, DromListingProvider


class ListingSearchService:
    def __init__(
        self,
        *,
        use_browser: bool = False,
        headless: bool = True,
        proxy_url: str = "",
    ):
        self.fetcher = (
            PlaywrightFetcher(headless=headless, proxy_url=proxy_url)
            if use_browser
            else RequestsFetcher(proxy_url=proxy_url)
        )
        self.providers = {
            "autoru": AutoruListingProvider(self.fetcher),
            "drom": DromListingProvider(self.fetcher),
            "bid.cars": BidCarsListingProvider(self.fetcher),
        }

    def search(
        self,
        query: VehicleQuery,
        sites: list[str] | None = None,
        limit_per_site: int = 5,
    ) -> dict:
        requested_sites = sites or list(self.providers.keys())
        provider_runs: list[ProviderRunResult] = []

        for site in requested_sites:
            provider = self.providers.get(site)
            if provider is None:
                provider_runs.append(
                    ProviderRunResult(
                        site=site,
                        ok=False,
                        error="Unsupported provider.",
                    )
                )
                continue
            provider_runs.append(provider.search(query, limit=limit_per_site))

        results = []
        for provider_run in provider_runs:
            results.extend(provider_run.listings)

        results.sort(key=lambda item: (-item.score, item.site, item.url))

        return {
            "query": query.to_dict(),
            "providers": [item.to_dict() for item in provider_runs],
            "results": [item.to_dict() for item in results],
        }

    def close(self) -> None:
        for provider in self.providers.values():
            close = getattr(provider, "close", None)
            if callable(close):
                close()
        self.fetcher.close()
