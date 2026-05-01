from __future__ import annotations

from abc import ABC, abstractmethod
from urllib.parse import urlparse

import requests


REQUEST_HEADERS = {
    "Accept": (
        "text/html,application/xhtml+xml,application/xml;q=0.9,"
        "image/avif,image/webp,image/apng,*/*;q=0.8"
    ),
    "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
    "Upgrade-Insecure-Requests": "1",
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
}


class BaseFetcher(ABC):
    @abstractmethod
    def fetch(self, url: str) -> str:
        raise NotImplementedError

    def close(self) -> None:
        return None


class RequestsFetcher(BaseFetcher):
    def __init__(self, proxy_url: str = ""):
        self.session = requests.Session()
        self.session.headers.update(REQUEST_HEADERS)
        if proxy_url:
            self.session.proxies.update(
                {
                    "http": proxy_url,
                    "https": proxy_url,
                }
            )

    def fetch(self, url: str) -> str:
        response = self.session.get(url, timeout=20)
        response.raise_for_status()
        response.encoding = response.encoding or "utf-8"
        return response.text

    def close(self) -> None:
        self.session.close()


class PlaywrightFetcher(BaseFetcher):
    def __init__(self, headless: bool = True, proxy_url: str = ""):
        from playwright.sync_api import sync_playwright

        self._playwright = sync_playwright().start()
        launch_options = {
            "headless": headless,
            "args": [
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
            ],
        }
        proxy_config = build_playwright_proxy_config(proxy_url)
        if proxy_config:
            launch_options["proxy"] = proxy_config
        self._browser = self._playwright.chromium.launch(
            **launch_options,
        )
        self._context = self._browser.new_context(
            user_agent=REQUEST_HEADERS["User-Agent"],
            viewport={"width": 1440, "height": 1200},
            locale="ru-RU",
        )
        self._context.add_init_script(
            """
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined
            });
            """
        )
        self._page = self._context.new_page()

    def fetch(self, url: str) -> str:
        self._page.goto(url, wait_until="domcontentloaded", timeout=60000)
        try:
            self._page.wait_for_load_state("networkidle", timeout=10000)
        except Exception:
            pass
        return self._page.content()

    def close(self) -> None:
        for resource in (self._page, self._context, self._browser):
            try:
                resource.close()
            except Exception:
                pass
        try:
            self._playwright.stop()
        except Exception:
            pass


def build_playwright_proxy_config(proxy_url: str) -> dict | None:
    if not proxy_url:
        return None

    parsed = urlparse(proxy_url)
    if not parsed.scheme or not parsed.hostname or not parsed.port:
        return {"server": proxy_url}

    config = {
        "server": f"{parsed.scheme}://{parsed.hostname}:{parsed.port}",
    }
    if parsed.username:
        config["username"] = parsed.username
    if parsed.password:
        config["password"] = parsed.password
    return config
