from __future__ import annotations

import json
import os
import re
from abc import ABC, abstractmethod
from typing import Iterable
from urllib.parse import urlencode, urljoin, urlparse

import requests
from bs4 import BeautifulSoup

from .catalog_index import normalize_compact, normalize_text
from .fetchers import BaseFetcher, PlaywrightFetcher, REQUEST_HEADERS, RequestsFetcher
from .models import ListingResult, ProviderRunResult, VehicleQuery

try:
    from curl_cffi import requests as curl_requests
except Exception:  # pragma: no cover - optional dependency
    curl_requests = None


PRICE_RE = re.compile(
    "(\\d[\\d\\s]{3,})\\s*(?:\u20bd|\u0440\u0443\u0431|rub)",
    re.IGNORECASE,
)
MODEL_ALIAS_MAP = {
    "autoru": {
        "rav4": ["rav4", "rav_4"],
        "rav 4": ["rav4", "rav_4"],
        "cx5": ["cx5", "cx_5"],
        "cx 5": ["cx5", "cx_5"],
        "cx7": ["cx7", "cx_7"],
        "cx 7": ["cx7", "cx_7"],
        "cx9": ["cx9", "cx_9"],
        "cx 9": ["cx9", "cx_9"],
        "crv": ["crv", "cr_v"],
        "cr v": ["crv", "cr_v"],
        "hrv": ["hrv", "hr_v"],
        "hr v": ["hrv", "hr_v"],
        "rx300": ["rx300", "rx_300"],
        "rx350": ["rx350", "rx_350"],
        "rx400h": ["rx400h", "rx_400h"],
    },
    "drom": {
        "cx5": ["cx-5", "cx_5", "cx5"],
        "cx 5": ["cx-5", "cx_5", "cx5"],
        "cx7": ["cx-7", "cx_7", "cx7"],
        "cx 7": ["cx-7", "cx_7", "cx7"],
        "cx9": ["cx-9", "cx_9", "cx9"],
        "cx 9": ["cx-9", "cx_9", "cx9"],
    },
}


def parse_price(value: str) -> int | None:
    match = PRICE_RE.search((value or "").replace("\xa0", " "))
    if not match:
        return None
    digits = re.sub(r"[^\d]", "", match.group(1))
    return int(digits) if digits else None


def parse_year(value: str | None) -> int | None:
    if not value:
        return None
    match = re.search(r"\b(19\d{2}|20\d{2}|21\d{2})\b", value)
    return int(match.group(1)) if match else None


def parse_mileage_km(value: str | None) -> int | None:
    if not value:
        return None
    normalized = normalize_whitespace(value).lower()
    if "км" not in normalized and "km" not in normalized:
        return None
    match = re.search(r"(\d[\d\s]{1,})\s*(?:км|km)", normalized)
    if not match:
        return None
    digits = re.sub(r"[^\d]", "", match.group(1))
    return int(digits) if digits else None


def parse_int(value: str | None) -> int | None:
    if not value:
        return None
    match = re.search(r"\d+", value)
    return int(match.group(0)) if match else None


def normalize_whitespace(value: str | None) -> str:
    if not value:
        return ""
    return re.sub(r"\s+", " ", value.replace("\xa0", " ")).strip()


def first_non_empty(values: Iterable[str]) -> str:
    for value in values:
        value = normalize_whitespace(value)
        if value:
            return value
    return ""


def extract_images(item) -> list[str]:
    if isinstance(item, str):
        return [item]
    if isinstance(item, list):
        images: list[str] = []
        for entry in item:
            images.extend(extract_images(entry))
        return [url for url in images if url]
    if isinstance(item, dict):
        images: list[str] = []
        for key in ("url", "contentUrl", "thumbnailUrl"):
            value = item.get(key)
            if isinstance(value, str) and value:
                images.append(value)
        return images
    return []    


def parse_cookie_header(value: str) -> list[dict[str, str | bool]]:
    cookies: list[dict[str, str | bool]] = []
    for part in value.split(";"):
        if "=" not in part:
            continue
        name, cookie_value = part.split("=", 1)
        name = name.strip()
        cookie_value = cookie_value.strip()
        if not name:
            continue
        cookies.append(
            {
                "name": name,
                "value": cookie_value,
                "domain": "bid.cars",
                "path": "/",
                "httpOnly": False,
                "secure": True,
            }
        )
    return cookies


def walk_json_objects(payload):
    if isinstance(payload, dict):
        yield payload
        for value in payload.values():
            yield from walk_json_objects(value)
    elif isinstance(payload, list):
        for item in payload:
            yield from walk_json_objects(item)


def clean_slug(value: str) -> str:
    cleaned = normalize_text(value)
    cleaned = re.sub(r"[^a-z0-9]+", "_", cleaned)
    cleaned = re.sub(r"_+", "_", cleaned)
    return cleaned.strip("_")


def make_slug(value: str) -> str:
    return clean_slug(value)


def model_slug_candidates(model: str, site: str) -> list[str]:
    normalized = normalize_text(model)
    aliases = MODEL_ALIAS_MAP.get(site, {})
    variants: list[str] = []

    def add(value: str, *, preserve_hyphen: bool = False) -> None:
        slug = clean_slug(value)
        if slug and slug not in variants:
            variants.append(slug)
        if preserve_hyphen:
            hyphen_slug = normalize_text(value)
            hyphen_slug = re.sub(r"[^a-z0-9-]+", "-", hyphen_slug)
            hyphen_slug = re.sub(r"-+", "-", hyphen_slug).strip("-")
            if hyphen_slug and hyphen_slug not in variants:
                variants.append(hyphen_slug)

    for alias in aliases.get(normalized, []):
        add(alias, preserve_hyphen=True)

    add(normalized, preserve_hyphen=True)
    add(normalized.replace(" ", "_"), preserve_hyphen=True)
    add(normalized.replace(" ", ""), preserve_hyphen=True)
    add(normalized.replace("-", "_"), preserve_hyphen=True)
    add(normalized.replace("_", "-"), preserve_hyphen=True)
    add(re.sub(r"([a-z]+)(\d+)", r"\1_\2", normalized), preserve_hyphen=True)
    add(re.sub(r"([a-z]+)(\d+)", r"\1-\2", normalized), preserve_hyphen=True)
    add(re.sub(r"(\d+)([a-z]+)", r"\1_\2", normalized), preserve_hyphen=True)
    add(re.sub(r"(\d+)([a-z]+)", r"\1-\2", normalized), preserve_hyphen=True)
    add(re.sub(r"([a-z])\s+(\d)", r"\1_\2", normalized), preserve_hyphen=True)
    add(re.sub(r"([a-z])\s+(\d)", r"\1-\2", normalized), preserve_hyphen=True)
    add(re.sub(r"(\d)\s+([a-z])", r"\1_\2", normalized), preserve_hyphen=True)
    add(re.sub(r"(\d)\s+([a-z])", r"\1-\2", normalized), preserve_hyphen=True)

    return variants


class BaseListingProvider(ABC):
    site: str

    def __init__(self, fetcher: BaseFetcher):
        self.fetcher = fetcher

    @abstractmethod
    def build_search_urls(self, query: VehicleQuery) -> list[str]:
        raise NotImplementedError

    @abstractmethod
    def is_listing_url(self, url: str) -> bool:
        raise NotImplementedError

    def fetch_html(self, url: str) -> str:
        return self.fetcher.fetch(url)

    def parse_json_ld(self, html: str, source_url: str) -> list[ListingResult]:
        soup = BeautifulSoup(html, "html.parser")
        results: list[ListingResult] = []
        seen_urls: set[str] = set()

        for script in soup.find_all("script", attrs={"type": "application/ld+json"}):
            raw_text = script.string or script.get_text(strip=True)
            raw_text = raw_text.strip()
            if not raw_text:
                continue

            try:
                payload = json.loads(raw_text)
            except Exception:
                continue

            for item in walk_json_objects(payload):
                url = first_non_empty((item.get("url"), item.get("@id")))
                if not url or not self.is_listing_url(url) or url in seen_urls:
                    continue

                offers = item.get("offers")
                if isinstance(offers, list):
                    offers = offers[0] if offers else {}
                if not isinstance(offers, dict):
                    offers = {}

                images = extract_images(item.get("image"))
                title = first_non_empty((item.get("name"), item.get("headline")))
                summary = first_non_empty((item.get("description"),))
                price_text = first_non_empty((str(offers.get("price", "")),))
                price_rub = None

                if price_text:
                    try:
                        price_rub = int(float(price_text.replace(",", ".")))
                    except Exception:
                        price_rub = None
                if price_rub is None:
                    price_rub = parse_price(summary)

                seen_urls.add(url)
                results.append(
                    ListingResult(
                        site=self.site,
                        title=title or summary or url,
                        url=url,
                        price_rub=price_rub,
                        price_text=price_text,
                        image_url=images[0] if images else "",
                        photos=images[:10],
                        summary=summary,
                        search_url=source_url,
                        matched_via="json_ld",
                    )
                )

        return results

    def parse_search_result_links(self, html: str, search_url: str) -> list[ListingResult]:
        soup = BeautifulSoup(html, "html.parser")
        results: list[ListingResult] = []
        seen_urls: set[str] = set()

        for anchor in soup.find_all("a", href=True):
            url = urljoin(search_url, anchor["href"].strip())
            if not self.is_listing_url(url) or url in seen_urls:
                continue

            container = anchor
            for _ in range(5):
                if container.parent is None:
                    break
                container = container.parent

            container_text = normalize_whitespace(container.get_text(" ", strip=True))
            title = first_non_empty((anchor.get("title", ""), anchor.get_text(" ", strip=True)))

            image = anchor.find("img") or container.find("img")
            image_url = ""
            if image:
                image_url = first_non_empty(
                    (image.get("src", ""), image.get("data-src", ""), image.get("data-original", ""))
                )
                if not title:
                    title = first_non_empty((image.get("alt", ""),))

            price_rub = parse_price(container_text)
            if not title and not price_rub and not image_url:
                continue

            seen_urls.add(url)
            results.append(
                ListingResult(
                    site=self.site,
                    title=title or url,
                    url=url,
                    price_rub=price_rub,
                    image_url=image_url,
                    photos=[image_url] if image_url else [],
                    summary=container_text[:500],
                    search_url=search_url,
                    matched_via="search_dom",
                )
            )

        return results

    def parse_listing_page(self, html: str, listing_url: str) -> ListingResult:
        for item in self.parse_json_ld(html, listing_url):
            if item.url == listing_url:
                return item

        soup = BeautifulSoup(html, "html.parser")
        title = first_non_empty(
            (
                self._meta_content(soup, "property", "og:title"),
                self._meta_content(soup, "name", "twitter:title"),
                soup.find("h1").get_text(" ", strip=True) if soup.find("h1") else "",
                soup.title.get_text(" ", strip=True) if soup.title else "",
            )
        )
        summary = first_non_empty(
            (
                self._meta_content(soup, "property", "og:description"),
                self._meta_content(soup, "name", "description"),
            )
        )
        images = self._page_images(soup)
        page_text = normalize_whitespace(soup.get_text(" ", strip=True))
        price_text, price_rub = self.extract_price_from_soup(soup, page_text)

        return ListingResult(
            site=self.site,
            title=title or listing_url,
            url=listing_url,
            price_rub=price_rub,
            price_text=price_text,
            image_url=images[0] if images else "",
            photos=images[:10],
            summary=summary or page_text[:500],
            search_url=listing_url,
            matched_via="detail_page",
            year=parse_year(title or summary or page_text),
        )

    def extract_price_from_soup(self, soup: BeautifulSoup, page_text: str) -> tuple[str, int | None]:
        for selector in (
            "[data-ftid='bulletin-price']",
            "[data-ftid='offer-price']",
            "[data-ftid='card-price']",
            "[data-ftid*='price']",
        ):
            node = soup.select_one(selector)
            if not node:
                continue
            price_text = normalize_whitespace(node.get_text(" ", strip=True))
            price_rub = parse_price(price_text)
            if price_rub is not None:
                return price_text, price_rub

        price_rub = parse_price(page_text)
        return (str(price_rub) if price_rub is not None else "", price_rub)

    def _meta_content(self, soup: BeautifulSoup, attr: str, value: str) -> str:
        tag = soup.find("meta", attrs={attr: value})
        if not tag:
            return ""
        return normalize_whitespace(tag.get("content", ""))

    def _page_images(self, soup: BeautifulSoup) -> list[str]:
        urls: list[str] = []
        for attr, value in (("property", "og:image"), ("name", "twitter:image")):
            image_url = self._meta_content(soup, attr, value)
            if image_url and image_url not in urls:
                urls.append(image_url)

        for image in soup.find_all("img"):
            for key in ("src", "data-src", "data-original"):
                image_url = normalize_whitespace(image.get(key, ""))
                if image_url and image_url not in urls:
                    urls.append(image_url)
        return urls

    def score_listing(self, listing: ListingResult, query: VehicleQuery) -> int:
        text = normalize_text(" ".join((listing.title, listing.summary)))
        compact = normalize_compact(text)
        score = 0

        if normalize_compact(query.make) in compact:
            score += 30
        if normalize_compact(query.model) in compact:
            score += 50
        if str(query.year) in text:
            score += 20

        if query.trim and normalize_text(query.trim) in text:
            score += 20
        if query.body and normalize_text(query.body) in text:
            score += 8
        if query.transmission and normalize_text(query.transmission) in text:
            score += 8
        if query.drivetrain and normalize_text(query.drivetrain) in text:
            score += 8

        return score

    def search(self, query: VehicleQuery, limit: int = 5) -> ProviderRunResult:
        search_urls = self.build_search_urls(query)
        if not search_urls:
            return ProviderRunResult(site=self.site, ok=False, error="No search URLs generated.")

        candidates: dict[str, ListingResult] = {}
        search_errors: list[str] = []

        for search_url in search_urls:
            try:
                html = self.fetch_html(search_url)
                for listing in self.parse_search_result_links(html, search_url):
                    listing.score = self.score_listing(listing, query)
                    if listing.score <= 0:
                        continue
                    current = candidates.get(listing.url)
                    if current is None or listing.score > current.score:
                        candidates[listing.url] = listing
                if len(candidates) >= limit * 3:
                    break
            except Exception as exc:
                search_errors.append(f"{search_url}: {exc}")
                continue

        if not candidates and search_errors:
            return ProviderRunResult(
                site=self.site,
                ok=False,
                search_urls=search_urls,
                error=" | ".join(search_errors),
            )

        ranked_candidates = sorted(
            candidates.values(),
            key=lambda item: (-item.score, item.url),
        )[: max(limit * 2, limit)]

        hydrated_results: list[ListingResult] = []
        for candidate in ranked_candidates:
            try:
                detail_html = self.fetch_html(candidate.url)
                item = self.parse_listing_page(detail_html, candidate.url)
            except Exception:
                item = candidate

            item.search_url = candidate.search_url
            item.score = max(candidate.score, self.score_listing(item, query))
            if not item.title:
                item.title = candidate.title
            if item.price_rub is None:
                item.price_rub = candidate.price_rub
            if not item.image_url:
                item.image_url = candidate.image_url
            if not item.photos:
                item.photos = candidate.photos
            if not item.summary:
                item.summary = candidate.summary
            hydrated_results.append(item)

        deduped: dict[str, ListingResult] = {}
        for item in hydrated_results:
            current = deduped.get(item.url)
            if current is None or item.score > current.score:
                deduped[item.url] = item

        listings = sorted(
            deduped.values(),
            key=lambda item: (-item.score, item.url),
        )[:limit]

        return ProviderRunResult(
            site=self.site,
            ok=True,
            listings=listings,
            search_urls=search_urls,
            error=" | ".join(search_errors),
        )


class AutoruListingProvider(BaseListingProvider):
    site = "autoru"

    def build_search_urls(self, query: VehicleQuery) -> list[str]:
        make_value = make_slug(query.make)
        urls: list[str] = []
        for model_value in model_slug_candidates(query.model, site=self.site):
            url = f"https://auto.ru/cars/{make_value}/{model_value}/{query.year}-year/used/"
            if url not in urls:
                urls.append(url)
        return urls

    def is_listing_url(self, url: str) -> bool:
        parsed = urlparse(url)
        return parsed.netloc.endswith("auto.ru") and parsed.path.startswith("/cars/used/sale/")


class DromListingProvider(BaseListingProvider):
    site = "drom"

    def build_search_urls(self, query: VehicleQuery) -> list[str]:
        make_value = make_slug(query.make)
        urls: list[str] = []
        for model_value in model_slug_candidates(query.model, site=self.site):
            url = f"https://auto.drom.ru/{make_value}/{model_value}/year-{query.year}/"
            if url not in urls:
                urls.append(url)
        return urls

    def is_listing_url(self, url: str) -> bool:
        parsed = urlparse(url)
        return parsed.netloc.endswith("drom.ru") and parsed.path.endswith(".html")

    def extract_price_from_soup(self, soup: BeautifulSoup, page_text: str) -> tuple[str, int | None]:
        price_node = soup.select_one("[data-ftid='bulletin-price']")
        if price_node:
            price_text = normalize_whitespace(price_node.get_text(" ", strip=True))
            price_rub = parse_price(price_text)
            if price_rub is not None:
                return price_text, price_rub

        return super().extract_price_from_soup(soup, page_text)

    def parse_listing_page(self, html: str, listing_url: str) -> ListingResult:
        soup = BeautifulSoup(html, "html.parser")

        title = first_non_empty(
            (
                self._text_by_selector(soup, "[data-ftid='bull_title']"),
                self._text_by_selector(soup, "[data-ftid='bull-page_bull-title']"),
                self._text_by_selector(soup, "h1"),
                self._meta_content(soup, "property", "og:title"),
                self._meta_content(soup, "name", "twitter:title"),
            )
        )

        price_text, price_rub = self.extract_price_from_soup(
            soup,
            normalize_whitespace(soup.get_text(" ", strip=True)),
        )

        images = self._page_images(soup)
        specs = self._extract_drom_specs(soup)
        summary = first_non_empty(
            (
                self._meta_content(soup, "property", "og:description"),
                self._meta_content(soup, "name", "description"),
                self._build_drom_summary(soup),
            )
        )
        city = first_non_empty(
            (
                self._city_value(soup),
                self._text_by_selector(soup, "[data-ftid='bull_location']"),
                self._text_by_selector(soup, "[data-ftid='bull-page_bull-location']"),
                self._text_by_selector(soup, "[data-ftid='bull-city']"),
            )
        )
        mileage_text = first_non_empty(
            (
                specs.get("mileage", ""),
                self._text_by_selector(soup, "[data-ftid='bull_run']"),
                self._text_by_selector(soup, "[data-ftid='bull-page_bull-run']"),
                self._text_by_selector(soup, "[data-ftid='bull-description-item_run']"),
            )
        )
        year_text = first_non_empty(
            (
                specs.get("year", ""),
                self._text_by_selector(soup, "[data-ftid='bull_year']"),
                self._text_by_selector(soup, "[data-ftid='bull-page_bull-year']"),
                title,
                summary,
            )
        )
        trim = first_non_empty(
            (
                specs.get("complectation", ""),
                self._extract_trim(title, query_year=parse_year(year_text)),
            )
        )
        if not trim:
            trim = self._extract_trim_from_summary(summary)

        if not title:
            title = listing_url

        return ListingResult(
            site=self.site,
            title=title,
            url=listing_url,
            price_rub=price_rub,
            price_text=price_text,
            image_url=images[0] if images else "",
            photos=images[:10],
            summary=summary,
            search_url=listing_url,
            matched_via="detail_page",
            year=parse_year(year_text),
            mileage_km=parse_mileage_km(mileage_text or summary),
            city=city,
            trim=trim,
            engine=specs.get("engine", ""),
            power_hp=parse_int(specs.get("power", "")),
            transmission=specs.get("transmission", ""),
            drivetrain=specs.get("drive", ""),
            color=specs.get("color", ""),
            owners_count=parse_int(specs.get("owners", "")),
            steering_wheel=specs.get("wheel", ""),
            generation=specs.get("generation", ""),
        )

    def _text_by_selector(self, soup: BeautifulSoup, selector: str) -> str:
        node = soup.select_one(selector)
        if not node:
            return ""
        return normalize_whitespace(node.get_text(" ", strip=True))

    def _city_value(self, soup: BeautifulSoup) -> str:
        city_node = soup.select_one("[data-ftid='city'] [data-ftid='value']")
        if not city_node:
            return ""
        return normalize_whitespace(city_node.get_text(" ", strip=True))

    def _extract_drom_specs(self, soup: BeautifulSoup) -> dict[str, str]:
        spec_map = {
            "specification-engine": "engine",
            "specification-power": "power",
            "specification-transmission": "transmission",
            "specification-drive": "drive",
            "specification-color": "color",
            "specification-mileage": "mileage",
            "specification-owners": "owners",
            "specification-wheel": "wheel",
            "specification-generation": "generation",
            "specification-complectation": "complectation",
            "specification-year": "year",
        }
        specs: dict[str, str] = {}
        for row_ftid, target_key in spec_map.items():
            row = soup.select_one(f"[data-ftid='{row_ftid}']")
            if not row:
                continue
            value_node = row.select_one("[data-ftid='value']")
            if not value_node:
                continue
            text = normalize_whitespace(value_node.get_text(" ", strip=True))
            if text:
                specs[target_key] = text
        return specs

    def _build_drom_summary(self, soup: BeautifulSoup) -> str:
        parts: list[str] = []
        for selector in (
            "[data-ftid='bull_description']",
            "[data-ftid='bull-page_bull-description']",
            "[data-ftid='specification-engine'] [data-ftid='value']",
            "[data-ftid='specification-power'] [data-ftid='value']",
            "[data-ftid='specification-transmission'] [data-ftid='value']",
            "[data-ftid='specification-drive'] [data-ftid='value']",
            "[data-ftid='specification-mileage'] [data-ftid='value']",
            "[data-ftid='bull_location']",
            "[data-ftid='bull_engine']",
            "[data-ftid='bull_transmission']",
            "[data-ftid='bull_run']",
        ):
            text = self._text_by_selector(soup, selector)
            if text and text not in parts:
                parts.append(text)

        return " | ".join(parts[:8])

    def _extract_trim(self, title: str, query_year: int | None) -> str:
        normalized = normalize_whitespace(title)
        if not normalized:
            return ""

        if query_year is not None:
            marker = f", {query_year}"
            if marker in normalized:
                tail = normalized.split(marker, 1)[1].strip(" ,|-")
                return tail

        match = re.search(r",\s*(19\d{2}|20\d{2}|21\d{2})\s*(.*)$", normalized)
        if match:
            return match.group(2).strip(" ,|-")
        return ""

    def _extract_trim_from_summary(self, summary: str) -> str:
        normalized = normalize_whitespace(summary)
        if not normalized:
            return ""

        match = re.search(
            r"\b(?:19\d{2}|20\d{2}|21\d{2})\b\s+(.+?)\s+\d[\d\s]{0,}\s*(?:км|km)\b",
            normalized,
            flags=re.IGNORECASE,
        )
        if match:
            return match.group(1).strip(" ,|-")
        return ""


class BidCarsListingProvider(BaseListingProvider):
    site = "bid.cars"

    def __init__(self, fetcher: BaseFetcher):
        super().__init__(fetcher)
        self._session_warmed = False
        self._curl_session = None
        self._cookie_header = os.getenv("BIDCARS_COOKIE", "").strip()

    def _build_search_params(self, query: VehicleQuery) -> dict[str, str | int]:
        return {
            "search-type": "filters",
            "status": "All",
            "type": "Automobile",
            "make": query.make.strip(),
            "model": query.model.strip(),
            "year-from": query.year,
            "year-to": query.year,
            "auction-type": "All",
        }

    def build_search_urls(self, query: VehicleQuery) -> list[str]:
        params = urlencode(self._build_search_params(query))
        return [f"https://bid.cars/ru/search/results?{params}"]

    def is_listing_url(self, url: str) -> bool:
        parsed = urlparse(url)
        return parsed.netloc.endswith("bid.cars") and "/lot/" in parsed.path

    def close(self) -> None:
        if self._curl_session is not None:
            try:
                self._curl_session.close()
            except Exception:
                pass
            self._curl_session = None

    def _build_api_url(self, query: VehicleQuery) -> str:
        return f"https://bid.cars/app/search/request?{urlencode(self._build_search_params(query))}"

    def _build_archived_api_url(self, query: VehicleQuery) -> str:
        params = dict(self._build_search_params(query))
        params["page"] = 1
        return f"https://bid.cars/app/search/archived/request?{urlencode(params)}"

    def _build_referer_url(self, query: VehicleQuery) -> str:
        return f"https://bid.cars/en/search/results?{urlencode(self._build_search_params(query))}"

    def search(self, query: VehicleQuery, limit: int = 5) -> ProviderRunResult:
        search_urls = self.build_search_urls(query)
        referer_url = self._build_referer_url(query)
        api_urls = [
            self._build_api_url(query),
            self._build_archived_api_url(query),
        ]
        errors: list[str] = []

        for api_url in api_urls:
            try:
                payload = self._fetch_search_payload(api_url, referer_url)
                listings = self._parse_search_payload(payload, search_urls[0], query, limit)
                return ProviderRunResult(
                    site=self.site,
                    ok=True,
                    listings=listings,
                    search_urls=search_urls,
                    error=" | ".join(errors),
                )
            except Exception as exc:
                errors.append(f"{api_url}: {exc}")

        return ProviderRunResult(
            site=self.site,
            ok=False,
            search_urls=search_urls,
            error=" | ".join(errors),
        )

    def fetch_html(self, url: str) -> str:
        if isinstance(self.fetcher, RequestsFetcher):
            try:
                return self._fetch_with_session(url)
            except requests.HTTPError as exc:
                if exc.response is not None and exc.response.status_code == 403:
                    browser_html = self._try_browser_fallback(url)
                    if browser_html:
                        return browser_html
                raise

        return super().fetch_html(url)

    def _fetch_with_session(self, url: str) -> str:
        session = self.fetcher.session
        headers = {
            **REQUEST_HEADERS,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Referer": "https://bid.cars/en/",
            "Sec-Fetch-Site": "same-origin",
        }
        if self._cookie_header:
            headers["Cookie"] = self._cookie_header

        if not self._session_warmed:
            for warmup_url in ("https://bid.cars/en/", "https://bid.cars/ru/", "https://bid.cars/"):
                try:
                    session.get(warmup_url, headers=headers, timeout=20, allow_redirects=True)
                except requests.RequestException:
                    continue
            self._session_warmed = True

        response = session.get(url, headers=headers, timeout=20, allow_redirects=True)
        if response.status_code == 403 and "/ru/" in url:
            fallback_url = url.replace("/ru/", "/", 1)
            fallback_response = session.get(
                fallback_url,
                headers=headers,
                timeout=20,
                allow_redirects=True,
            )
            if fallback_response.ok:
                response = fallback_response

        response.raise_for_status()
        response.encoding = response.encoding or "utf-8"
        return response.text

    def _fetch_search_payload(self, api_url: str, referer_url: str) -> dict:
        try:
            if curl_requests is not None:
                return self._fetch_search_payload_with_curl(api_url, referer_url)
            return self._fetch_search_payload_with_requests(api_url, referer_url)
        except Exception:
            browser_payload = self._fetch_search_payload_with_browser(api_url, referer_url)
            if browser_payload is not None:
                return browser_payload
            raise

    def _fetch_search_payload_with_requests(self, api_url: str, referer_url: str) -> dict:
        if not isinstance(self.fetcher, RequestsFetcher):
            response_text = self.fetch_html(api_url)
            return json.loads(response_text)

        session = self.fetcher.session
        headers = {
            **REQUEST_HEADERS,
            "Accept": "*/*",
            "Referer": referer_url,
            "X-Requested-With": "XMLHttpRequest",
            "Sec-Fetch-Site": "same-origin",
        }
        if self._cookie_header:
            headers["Cookie"] = self._cookie_header

        if not self._session_warmed:
            for warmup_url in ("https://bid.cars/en/", "https://bid.cars/ru/", "https://bid.cars/", referer_url):
                try:
                    session.get(warmup_url, headers=headers, timeout=20, allow_redirects=True)
                except requests.RequestException:
                    continue
            self._session_warmed = True

        response = session.get(api_url, headers=headers, timeout=20, allow_redirects=True)
        response.raise_for_status()
        return response.json()

    def _fetch_search_payload_with_curl(self, api_url: str, referer_url: str) -> dict:
        if self._curl_session is None:
            self._curl_session = curl_requests.Session(
                impersonate="chrome110",
                verify=False,
                headers={
                    **REQUEST_HEADERS,
                    "Accept": "*/*",
                    "Referer": referer_url,
                    "X-Requested-With": "XMLHttpRequest",
                    "Sec-Fetch-Site": "same-origin",
                },
            )
            if self._cookie_header:
                self._curl_session.headers["Cookie"] = self._cookie_header

        session = self._curl_session
        if not self._session_warmed:
            for warmup_url in ("https://bid.cars/en/", "https://bid.cars/ru/", "https://bid.cars/", referer_url):
                try:
                    session.get(warmup_url, timeout=20, allow_redirects=True)
                except Exception:
                    continue
            self._session_warmed = True

        response = session.get(api_url, timeout=20, allow_redirects=True)
        response.raise_for_status()
        return response.json()

    def _fetch_search_payload_with_browser(self, api_url: str, referer_url: str) -> dict | None:
        try:
            from playwright.sync_api import sync_playwright
        except Exception:
            return None

        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(
                headless=True,
                args=[
                    "--disable-blink-features=AutomationControlled",
                    "--no-sandbox",
                ],
            )
            context = browser.new_context(
                user_agent=REQUEST_HEADERS["User-Agent"],
                viewport={"width": 1440, "height": 1200},
                locale="ru-RU",
            )
            if self._cookie_header:
                context.add_cookies(parse_cookie_header(self._cookie_header))
            page = context.new_page()
            try:
                page.add_init_script(
                    """
                    Object.defineProperty(navigator, 'webdriver', {
                        get: () => undefined
                    });
                    """
                )
                page.goto(referer_url, wait_until="domcontentloaded", timeout=60000)
                try:
                    page.wait_for_load_state("networkidle", timeout=10000)
                except Exception:
                    pass

                payload = page.evaluate(
                    """
                    async (apiUrl) => {
                      const response = await fetch(apiUrl, {
                        method: "GET",
                        credentials: "include",
                        headers: {
                          "accept": "*/*",
                          "x-requested-with": "XMLHttpRequest"
                        }
                      });

                      if (!response.ok) {
                        throw new Error(`HTTP ${response.status}`);
                      }

                      return await response.json();
                    }
                    """,
                    api_url,
                )
                return payload if isinstance(payload, dict) else None
            finally:
                context.close()
                browser.close()

    def _parse_search_payload(
        self,
        payload: dict,
        search_url: str,
        query: VehicleQuery,
        limit: int,
    ) -> list[ListingResult]:
        listings: list[ListingResult] = []

        for item in payload.get("data", []) or []:
            lot_number = str(item.get("lot", "")).strip()
            if not lot_number:
                continue

            specs = item.get("specs") or {}
            title = first_non_empty(
                (
                    str(item.get("name_long", "")).strip(),
                    str(item.get("name", "")).strip(),
                    f"{query.make} {query.model} {query.year}",
                )
            )
            summary_parts = [
                str(specs.get("engine_rendered", "")).strip(),
                str(specs.get("key_info", "")).strip(),
                str(specs.get("drive_type", "")).strip(),
                str(specs.get("fuel_type", "")).strip(),
                str(specs.get("transmission", "")).strip(),
            ]
            summary = " | ".join(part for part in summary_parts if part)
            url = first_non_empty(
                (
                    str(item.get("url", "")).strip(),
                    f"https://bid.cars/en/lot/{lot_number}",
                )
            )
            photos = self._extract_bidcars_images(item)
            image_url = photos[0] if photos else ""

            price_candidates = [
                str(item.get("price", "")).strip(),
                str(item.get("buy_now_price", "")).strip(),
                str(item.get("final_bid", "")).strip(),
                str(item.get("sale_price", "")).strip(),
                summary,
            ]
            price_text = first_non_empty(price_candidates)
            price_rub = None
            for candidate in price_candidates:
                price_rub = parse_price(candidate)
                if price_rub is not None:
                    break

            listing = ListingResult(
                site=self.site,
                title=title,
                url=url,
                price_rub=price_rub,
                price_text=price_text,
                image_url=image_url,
                photos=photos[:10],
                summary=summary,
                search_url=search_url,
                matched_via="search_api",
                year=parse_year(title) or query.year,
                trim=str(specs.get("key_info", "")).strip(),
                engine=str(specs.get("engine_rendered", "")).strip(),
                transmission=str(specs.get("transmission", "")).strip(),
                drivetrain=str(specs.get("drive_type", "")).strip(),
            )
            listing.score = self.score_listing(listing, query)
            if listing.score > 0:
                listings.append(listing)

        listings.sort(key=lambda item: (-item.score, item.url))
        listings = listings[:limit]

        for listing in listings:
            if listing.image_url:
                continue
            self._hydrate_listing_image(listing)

        return listings

    def _extract_bidcars_images(self, item: dict) -> list[str]:
        raw_candidates: list[str] = []

        for key in (
            "image",
            "image_url",
            "lot_image",
            "thumbnail",
            "thumbnail_url",
            "thumb",
            "photo",
            "photo_url",
            "poster",
        ):
            value = item.get(key)
            if isinstance(value, str):
                raw_candidates.append(value)
            else:
                raw_candidates.extend(extract_images(value))

        for key in ("images", "lot_images", "photos", "gallery", "media"):
            raw_candidates.extend(extract_images(item.get(key)))

        for nested in walk_json_objects(item):
            if not isinstance(nested, dict):
                continue
            for key in (
                "image",
                "image_url",
                "lot_image",
                "thumbnail",
                "thumbnail_url",
                "thumb",
                "photo",
                "photo_url",
            ):
                value = nested.get(key)
                if isinstance(value, str):
                    raw_candidates.append(value)
                else:
                    raw_candidates.extend(extract_images(value))

        normalized: list[str] = []
        seen: set[str] = set()
        for candidate in raw_candidates:
            value = normalize_whitespace(candidate)
            if not value:
                continue
            absolute = urljoin("https://bid.cars", value)
            if absolute in seen:
                continue
            seen.add(absolute)
            normalized.append(absolute)

        return normalized

    def _hydrate_listing_image(self, listing: ListingResult) -> None:
        try:
            html = self.fetch_html(listing.url)
            detail = self.parse_listing_page(html, listing.url)
        except Exception:
            return

        photos: list[str] = []
        for candidate in detail.photos:
            value = normalize_whitespace(candidate)
            if value:
                photos.append(urljoin("https://bid.cars", value))

        if not photos and detail.image_url:
            photos = [urljoin("https://bid.cars", detail.image_url)]

        if not photos:
            return

        listing.image_url = photos[0]
        listing.photos = photos[:10]

    def _try_browser_fallback(self, url: str) -> str | None:
        browser_fetcher: PlaywrightFetcher | None = None
        try:
            browser_fetcher = PlaywrightFetcher(headless=True)
            return browser_fetcher.fetch(url)
        except Exception:
            return None
        finally:
            if browser_fetcher is not None:
                browser_fetcher.close()
