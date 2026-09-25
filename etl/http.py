"""HTTP helper: retries, timeouts, a polite User-Agent and a per-run memo cache.

Everything the pipeline downloads goes through `get()`, so the whole run can be
tested offline by swapping in a fake transport (see tests/).
"""
from __future__ import annotations

import gzip
import io
import json
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Callable, Iterable, TypeVar
from urllib.parse import urlsplit

import requests

USER_AGENT = "BeyondGDP-Dashboard/1.0 (open-data dashboard; +https://github.com)"
TIMEOUT = 60
RETRIES = 3
PER_HOST = 6  # parallel requests allowed to one host

T = TypeVar("T")
R = TypeVar("R")

# Each fetching thread may carry a deadline (time.monotonic()); requests past it fail fast,
# so one slow source cannot hold up the whole run.
_local = threading.local()
_host_locks: dict[str, threading.BoundedSemaphore] = {}
_host_guard = threading.Lock()


def set_deadline(deadline: float | None) -> None:
    _local.deadline = deadline


def _remaining() -> float | None:
    d = getattr(_local, "deadline", None)
    return None if d is None else d - time.monotonic()


def _host_lock(url: str) -> threading.BoundedSemaphore:
    host = urlsplit(url).netloc
    with _host_guard:
        return _host_locks.setdefault(host, threading.BoundedSemaphore(PER_HOST))


def pmap(fn: Callable[[T], R], items: Iterable[T], workers: int = 6) -> list[R]:
    """Map in threads, in order; workers inherit the caller's deadline."""
    deadline = getattr(_local, "deadline", None)

    def run(item: T) -> R:
        set_deadline(deadline)
        return fn(item)

    with ThreadPoolExecutor(max_workers=workers) as ex:
        return list(ex.map(run, items))

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
    left = _remaining()
    if left is not None and left <= 1:
        raise FetchError(f"Time budget used up before fetching {url}")
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
        left = _remaining()
        if left is not None and left <= 1:
            raise FetchError(f"Time budget used up before fetching {url}")
        timeout = TIMEOUT if left is None else max(1.0, min(TIMEOUT, left))
        try:
            with _host_lock(url):
                r = _session.get(url, params=params, headers=headers or {}, timeout=timeout)
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
        pause = 2 ** attempt * 2
        left = _remaining()
        if left is not None and left <= pause:
            break
        time.sleep(pause)
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
