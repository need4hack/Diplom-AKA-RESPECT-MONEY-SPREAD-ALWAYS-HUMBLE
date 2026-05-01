from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

from .models import VehicleQuery
from .service import ListingSearchService


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Standalone listing search for Auto.ru and Drom"
    )
    parser.add_argument("--make", required=True)
    parser.add_argument("--model", required=True)
    parser.add_argument("--year", required=True, type=int)
    parser.add_argument("--trim", default="")
    parser.add_argument("--body", default="")
    parser.add_argument("--engine", default="")
    parser.add_argument("--transmission", default="")
    parser.add_argument("--drivetrain", default="")
    parser.add_argument(
        "--sites",
        default="autoru,drom",
        help="Comma-separated providers, for example: autoru,drom",
    )
    parser.add_argument("--limit-per-site", type=int, default=5)
    parser.add_argument("--browser", action="store_true", help="Fetch pages with Playwright browser.")
    parser.add_argument("--headed", action="store_true", help="Run browser mode with visible window.")
    parser.add_argument("--output", default="", help="Optional JSON output path.")
    parser.add_argument(
        "--proxy",
        default="",
        help="Optional proxy URL, for example: http://user:pass@host:port",
    )
    return parser


def main() -> None:
    args = build_parser().parse_args()
    query = VehicleQuery(
        make=args.make,
        model=args.model,
        year=args.year,
        trim=args.trim,
        body=args.body,
        engine=args.engine,
        transmission=args.transmission,
        drivetrain=args.drivetrain,
    )
    sites = [item.strip() for item in args.sites.split(",") if item.strip()]
    service = ListingSearchService(
        use_browser=args.browser,
        headless=not args.headed,
        proxy_url=args.proxy or os.getenv("LISTING_SEARCH_PROXY", ""),
    )
    try:
        payload = service.search(
            query=query,
            sites=sites,
            limit_per_site=args.limit_per_site,
        )
    finally:
        service.close()

    rendered = json.dumps(payload, ensure_ascii=False, indent=2)
    if args.output:
        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(rendered, encoding="utf-8")
    print(rendered)


if __name__ == "__main__":
    main()
