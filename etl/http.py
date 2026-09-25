"""HTTP helper: retries, timeouts, a polite User-Agent and a per-run memo cache.

Everything the pipeline downloads goes through `get()`, so the whole run can be
tested offline by swapping in a fake transport (see tests/).
"""
from __future__ import annotations

import gzip
import io
import json
import time
from typing import Any, Callable

import requests

USER_AGENT = "BeyondGDP-Dashboard/1.0 (open-data dashboard; +https://github.com)"
TIMEOUT = 90
RETRIES = 3

_session = requests.Session()
_session.headers.update({"User-Agent": USER_AGENT, "Accept-Encoding": "gzip, deflate"})
_memo: dict[str, bytes] = {}

# Tests replace this with a function (url, params, headers) -> bytes
transport: Callable[[str, dict | None, dict | None], bytes] | None = None


class FetchError(Exception):
    pass


def _key(url: str, params: dict | None, headers: dict | None) -> str:
    return json.dumps([url, sorted((params or {}).items()), sorted((headers or {}).items())], default=str)


def get(url: str, params: dict | None = None, headers: dict | None = None, memo: bool = True) -> bytes:
    key = _key(url, params, headers)
    if memo and key in _memo:
        return _memo[key]
    if transport is not None:
        data = transport(url, params, headers)
    else:
        data = _get_live(url, params, headers)
    if memo:
        _memo[key] = data
    return data


def _get_live(url: str, params: dict | None, headers: dict | None) -> bytes:
    last: Exception | None = None
    for attempt in range(RETRIES):
        try:
            r = _session.get(url, params=params, headers=headers or {}, timeout=TIMEOUT)
            if r.status_code == 429 or r.status_code >= 500:
                raise FetchError(f"HTTP {r.status_code} from {url}")
            if r.status_code >= 400:
                # 4xx other than 429 will not improve on retry
                raise FetchError(f"HTTP {r.status_code} from {url}: {r.text[:200]}")
            return r.content
        except FetchError as e:
            last = e
            if "HTTP 4" in str(e) and "HTTP 429" not in str(e):
                break
        except requests.RequestException as e:
            last = FetchError(f"{type(e).__name__} for {url}: {e}")
        time.sleep(2 ** attempt * 2)
    raise last or FetchError(f"Failed to fetch {url}")


def get_json(url: str, params: dict | None = None, headers: dict | None = None) -> Any:
    raw = get(url, params, headers)
    try:
        return json.loads(raw.decode("utf-8-sig"))
    except (UnicodeDecodeError, json.JSONDecodeError) as e:
        raise FetchError(f"Invalid JSON from {url}: {e}") from e


def get_text(url: str, params: dict | None = None, headers: dict | None = None) -> str:
    raw = get(url, params, headers)
    if raw[:2] == b"\x1f\x8b":
        raw = gzip.decompress(raw)
    return raw.decode("utf-8-sig", errors="replace")


def as_file(raw: bytes) -> io.BytesIO:
    return io.BytesIO(raw)


def reset_memo() -> None:
    _memo.clear()
