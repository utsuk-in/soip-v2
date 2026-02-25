"""
Scraping client — Crawl4AI (with scroll/pagination) and httpx + BeautifulSoup (with link pagination).
"""

import logging
import re
from typing import Optional
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

import httpx
from bs4 import BeautifulSoup
from markdownify import markdownify as md

from app.config import settings
from app.models.source import Source

logger = logging.getLogger(__name__)

_HTTPX_TIMEOUT = 30.0
_MAX_CONTENT_LENGTH = 500_000
_USER_AGENT = "SOIP-Bot/1.0 (Student Opportunity Aggregator)"
_DEFAULT_MAX_PAGES = 3


async def scrape_source(source: Source) -> Optional[str]:
    """Returns clean markdown content from a source (all pages combined)."""
    config = source.config or {}
    listing_url = config.get("listing_url", source.base_url)

    try:
        if source.scraper_type == "html":
            return await _fetch_static(listing_url, source)
        return await _fetch_with_crawl4ai(listing_url, source)
    except Exception as e:
        logger.error(f"Failed to scrape {source.name} ({listing_url}): {e}")
        return None


async def scrape_detail_url(url: str, source: Source) -> Optional[str]:
    """Scrape a single detail URL using the source's scraper strategy."""
    try:
        if source.scraper_type == "html":
            return await _fetch_single_static(url)
        return await _fetch_with_crawl4ai(url, source)
    except Exception as e:
        logger.warning(f"Failed to scrape detail URL {url}: {e}")
        return None


# ── Crawl4AI (JS-heavy, with scroll and optional cookie consent) ──


async def _fetch_with_crawl4ai(url: str, source: Source) -> str:
    """JS-heavy scraping with Crawl4AI; supports scroll and optional js_code (e.g. cookie consent)."""
    from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig, VirtualScrollConfig

    config = source.config or {}
    browser_config = BrowserConfig(headless=True)
    run_config = _build_crawl4ai_config(config)

    async with AsyncWebCrawler(config=browser_config) as crawler:
        result = await crawler.arun(url=url, config=run_config)

        if result.success:
            return _clean_markdown(result.markdown or "")

        logger.error(f"Crawl4AI failed for {url}: {result.error_message}")
        return ""


def _build_crawl4ai_config(config: dict) -> "CrawlerRunConfig":
    """Build CrawlerRunConfig from source config (scroll, cookie consent, etc.)."""
    from crawl4ai import CrawlerRunConfig, VirtualScrollConfig

    kwargs: dict = {}

    # Optional JS run before capture (e.g. click cookie consent)
    js_code = config.get("js_code")
    if js_code:
        kwargs["js_code"] = js_code
    delay = config.get("delay_before_return_html")
    if delay is not None:
        kwargs["delay_before_return_html"] = float(delay)

    # Overlay/cookie banner handling — helps when site shows cookie wall
    if config.get("remove_overlay_elements"):
        kwargs["remove_overlay_elements"] = True
    if config.get("magic"):
        kwargs["magic"] = True

    scroll_mode = config.get("scroll_mode", "none")

    if scroll_mode == "virtual":
        container = config.get("container_selector")
        if container:
            kwargs["virtual_scroll_config"] = VirtualScrollConfig(
                container_selector=container,
                scroll_count=int(config.get("scroll_count", 20)),
                scroll_by=config.get("scroll_by", "container_height"),
                wait_after_scroll=float(config.get("wait_after_scroll", 0.8)),
            )
        else:
            logger.warning("scroll_mode=virtual but container_selector missing; skipping scroll")
    elif scroll_mode == "full_page":
        kwargs["scan_full_page"] = True
        base_delay = float(config.get("scroll_delay", 0.5))
        env_pages = int(getattr(settings, "crawl_max_pages", 0) or 0)
        # When crawling multiple pages of infinite scroll, wait long enough for load-more.
        if env_pages >= 2 and base_delay < 1.2:
            base_delay = 1.2
        kwargs["scroll_delay"] = base_delay
        # Infinite scroll: each "page" needs many viewport scrolls to trigger load-more.
        # CRAWL_MAX_PAGES = number of logical pages; steps = pages * steps_per_page.
        steps_per_page = int(config.get("scroll_steps_per_page", 10))
        if env_pages > 0:
            max_steps = env_pages * steps_per_page
        else:
            max_steps = config.get("max_scroll_steps")
        if max_steps is not None:
            kwargs["max_scroll_steps"] = int(max_steps)
            logger.info(f"Full-page scroll: max_scroll_steps={max_steps}, scroll_delay={kwargs['scroll_delay']}s (CRAWL_MAX_PAGES={env_pages or 'config'}, steps_per_page={steps_per_page})")

    return CrawlerRunConfig(**kwargs)


# ── Static HTML with optional link-based pagination ──


async def _fetch_static(start_url: str, source: Source) -> str:
    """Fetch static HTML; if config has pagination, follow next links up to max_pages."""
    config = source.config or {}
    pagination = config.get("pagination", False)
    max_pages = _resolve_max_pages(config)
    page_param = config.get("page_param", "page")

    if not pagination or max_pages < 2:
        return await _fetch_single_static(start_url)

    parts: list[str] = []
    seen_urls: set[str] = set()
    url: Optional[str] = start_url
    page_num = 1

    async with httpx.AsyncClient(
        timeout=_HTTPX_TIMEOUT,
        follow_redirects=True,
        headers={"User-Agent": _USER_AGENT},
    ) as client:
        while url and page_num <= max_pages:
            if url in seen_urls:
                break
            seen_urls.add(url)

            try:
                response = await client.get(url)
                response.raise_for_status()
            except Exception as e:
                logger.warning(f"Pagination fetch failed for {url}: {e}")
                break

            soup = BeautifulSoup(response.text, "html.parser")
            main = soup.find("main") or soup.find("article") or soup.find("body")
            if main:
                markdown = md(str(main), strip=["img"])
                parts.append(_clean_markdown(markdown))

            next_url = _get_next_page_url(soup, url, page_param)
            if not next_url:
                break
            url = next_url
            page_num += 1
            logger.info(f"Following pagination page {page_num}: {url}")

    if not parts:
        return ""
    combined = "\n\n---\n\n".join(parts)
    return _clean_markdown(combined)


async def _fetch_single_static(url: str) -> str:
    """Single-page static fetch (no pagination)."""
    async with httpx.AsyncClient(
        timeout=_HTTPX_TIMEOUT,
        follow_redirects=True,
        headers={"User-Agent": _USER_AGENT},
    ) as client:
        response = await client.get(url)
        response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")
    for tag in soup(["script", "style", "nav", "footer", "header", "aside", "noscript"]):
        tag.decompose()

    main = soup.find("main") or soup.find("article") or soup.find("body")
    if not main:
        return ""

    markdown = md(str(main), strip=["img"])
    return _clean_markdown(markdown)


def _get_next_page_url(soup: BeautifulSoup, current_url: str, page_param: str) -> Optional[str]:
    """Find next page URL: rel='next', then ?page=N+1, then link text 'Next'."""
    # 1. rel="next"
    next_a = soup.find("a", rel=lambda v: v and "next" in v.lower().split())
    if next_a and next_a.get("href"):
        href = next_a["href"].strip()
        return _resolve_url(href, current_url)

    # 2. Same path with page_param incremented
    parsed = urlparse(current_url)
    qs = parse_qs(parsed.query, keep_blank_values=True)
    try:
        current_page = int(qs.get(page_param, [1])[0])
    except (ValueError, IndexError):
        current_page = 1
    qs[page_param] = [str(current_page + 1)]
    new_query = urlencode(qs, doseq=True)
    next_url = urlunparse((parsed.scheme, parsed.netloc, parsed.path, parsed.params, new_query, parsed.fragment))
    # We don't know if that page exists; the caller will 404 or get empty content. Alternatively check for presence of a "next" link that points to page N+1.
    # So prefer to only use ?page=N+1 if we also find a link with that pattern on the page.
    next_page_num = current_page + 1
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if page_param in href and str(next_page_num) in href:
            return _resolve_url(href, current_url)

    # 3. Link with text "Next" / "next"
    for a in soup.find_all("a", href=True):
        if a.get_text(strip=True).lower() == "next":
            return _resolve_url(a["href"], current_url)

    return None


def _resolve_max_pages(config: dict) -> int:
    """Resolve max pages from env override, then source config."""
    env_pages = int(getattr(settings, "crawl_max_pages", 0) or 0)
    if env_pages > 0:
        return env_pages
    return int(config.get("max_pages", _DEFAULT_MAX_PAGES))


def _resolve_url(href: str, base: str) -> str:
    """Make href absolute against base URL."""
    if not href:
        return ""
    if href.startswith("http://") or href.startswith("https://"):
        return href
    parsed_base = urlparse(base)
    if href.startswith("//"):
        return f"{parsed_base.scheme}:{href}"
    if href.startswith("/"):
        return f"{parsed_base.scheme}://{parsed_base.netloc}{href}"
    # Relative to current path
    base_path = parsed_base.path.rsplit("/", 1)[0] if "/" in parsed_base.path else ""
    return f"{parsed_base.scheme}://{parsed_base.netloc}{base_path}/{href}"


def _clean_markdown(text: str) -> str:
    """Remove excessive whitespace and cap content size."""
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r" {2,}", " ", text)
    text = text.strip()
    if len(text) > _MAX_CONTENT_LENGTH:
        text = text[:_MAX_CONTENT_LENGTH]
    return text
