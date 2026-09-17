"""Jev Broadcast Lab: serve web/ and proxy TypeSafe System One."""

from __future__ import annotations

import http.client
import json
import os
import queue
import ssl
import sys
import threading
import time
import uuid
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent
WEB = ROOT / "web"

DENIED_PREFIXES = (
    "/.env",
    "/.git",
    "/.impeccable",
    "/product.md",
    "/design.md",
    "/server.py",
)
DENIED_NAMES = {".env", ".env.example", "product.md", "design.md", "server.py"}


def load_dotenv(path: Path) -> None:
    if not path.is_file():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        name, _, value = line.partition("=")
        name = name.strip()
        value = value.strip().strip('"').strip("'")
        if name and name not in os.environ:
            os.environ[name] = value


load_dotenv(ROOT / ".env")
PORT = int(os.environ.get("PORT", "8787"))
BIND = os.environ.get("BIND", "127.0.0.1")
UPSTREAM = os.environ.get("TYPESAFE_UPSTREAM", "https://api.typesafe.ai/v1/systemone")
ENV_KEY = os.environ.get("TYPESAFE_API_KEY", "").strip()
UPSTREAM_TIMEOUT = float(os.environ.get("TYPESAFE_TIMEOUT", "10"))
MAX_IN_FLIGHT = int(os.environ.get("JEV_MAX_IN_FLIGHT", "2"))
COOKIE_NAME = "jev_lab"

_parsed = urlparse(UPSTREAM)
UPSTREAM_HOST = _parsed.hostname or "api.typesafe.ai"
UPSTREAM_PATH = _parsed.path or "/v1/systemone"
UPSTREAM_PORT = _parsed.port or (443 if (_parsed.scheme or "https") == "https" else 80)


def _send_json(handler: SimpleHTTPRequestHandler, status: int, payload: dict, extra_headers: Optional[list] = None) -> None:
    body = json.dumps(payload).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.send_header("Cache-Control", "no-store")
    if extra_headers:
        for k, v in extra_headers:
            handler.send_header(k, v)
    handler.end_headers()
    handler.wfile.write(body)


def _scrub(text: str) -> str:
    out = str(text or "")
    if ENV_KEY:
        out = out.replace(ENV_KEY, "[key]")
    return out.replace("Bearer ", "Bearer [redacted] ")


class UpstreamPool:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._conn: Optional[http.client.HTTPSConnection] = None
        self._ctx = ssl.create_default_context()

    def _connect(self) -> http.client.HTTPSConnection:
        conn = http.client.HTTPSConnection(
            UPSTREAM_HOST, UPSTREAM_PORT, timeout=UPSTREAM_TIMEOUT, context=self._ctx
        )
        return conn

    def post(self, body: bytes, auth: str) -> tuple[int, dict, bytes]:
        headers = {
            "Authorization": auth,
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "jev-lab-local-proxy/1.0",
            "Connection": "keep-alive",
        }
        with self._lock:
            last_err: Optional[Exception] = None
            for attempt in range(2):
                try:
                    if self._conn is None:
                        self._conn = self._connect()
                    self._conn.request("POST", UPSTREAM_PATH, body=body, headers=headers)
                    resp = self._conn.getresponse()
                    data = resp.read()
                    hdrs = {k.lower(): v for k, v in resp.getheaders()}
                    return resp.status, hdrs, data
                except Exception as err:
                    last_err = err
                    try:
                        if self._conn:
                            self._conn.close()
                    except Exception:
                        pass
                    self._conn = None
            raise last_err or RuntimeError("upstream failed")


POOL = UpstreamPool()
SEM = threading.Semaphore(MAX_IN_FLIGHT)
JOBS: "queue.Queue[tuple]" = queue.Queue()


def _worker() -> None:
    while True:
        job = JOBS.get()
        if job is None:
            return
        body, auth, ev, box = job
        try:
            status, headers, data = _post_with_retry(body, auth)
            box["status"] = status
            box["headers"] = headers
            box["data"] = data
        except Exception as err:
            box["error"] = str(err)
        finally:
            ev.set()
            JOBS.task_done()


def _post_with_retry(body: bytes, auth: str) -> tuple[int, dict, bytes]:
    last: Optional[tuple[int, dict, bytes]] = None
    for attempt in range(3):
        SEM.acquire()
        try:
            status, headers, data = POOL.post(body, auth)
        finally:
            SEM.release()
        last = (status, headers, data)
        if status not in (429, 502, 503, 529):
            return last
        ra = headers.get("retry-after")
        try:
            wait = float(ra) if ra else (1.0 * (2 ** attempt))
        except ValueError:
            wait = 1.0 * (2 ** attempt)
        wait = min(max(wait, 0.2), 15.0)
        if attempt == 2:
            return last
        time.sleep(wait)
    return last or (502, {}, b"{}")


for _ in range(2):
    threading.Thread(target=_worker, daemon=True).start()

SESSIONS: dict[str, dict] = {}
SESS_LOCK = threading.Lock()


def _session_id(handler: SimpleHTTPRequestHandler) -> tuple[str, bool]:
    raw = handler.headers.get("Cookie") or ""
    sid = ""
    for part in raw.split(";"):
        k, _, v = part.strip().partition("=")
        if k == COOKIE_NAME:
            sid = v.strip()
            break
    created = False
    if not sid or sid not in SESSIONS:
        sid = uuid.uuid4().hex
        created = True
        with SESS_LOCK:
            SESSIONS[sid] = {"in_flight": 0}
    return sid, created


def _cookie_header(sid: str) -> str:
    return "%s=%s; HttpOnly; SameSite=Lax; Path=/" % (COOKIE_NAME, sid)


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(WEB), **kwargs)

    def log_message(self, fmt: str, *args) -> None:
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    def _denied(self) -> bool:
        path = (self.path.split("?", 1)[0] or "/").lower()
        if any(path.startswith(p) for p in DENIED_PREFIXES):
            return True
        if path.endswith(".md") or path.endswith(".py") or path.endswith(".env"):
            return True
        try:
            translated = Path(self.translate_path(path)).resolve()
            if translated.name.lower() in DENIED_NAMES:
                return True
            translated.relative_to(WEB.resolve())
        except Exception:
            return True
        return False

    def do_GET(self) -> None:
        if self._denied():
            self.send_error(404, "Not Found")
            return
        path = self.path.split("?", 1)[0]
        sid, created = _session_id(self)
        if path == "/config":
            extra = [("Set-Cookie", _cookie_header(sid))] if created else None
            with SESS_LOCK:
                depth = JOBS.qsize()
            _send_json(
                self,
                200,
                {
                    "hasEnvKey": bool(ENV_KEY),
                    "upstream": "https://api.typesafe.ai/v1/systemone",
                    "modelDefault": "jev-latest",
                    "queueDepth": depth,
                },
                extra,
            )
            return
        super().do_GET()

    def do_POST(self) -> None:
        if self._denied():
            self.send_error(404, "Not Found")
            return
        path = self.path.split("?", 1)[0]
        if path != "/v1/systemone":
            self.send_error(404, "Not Found")
            return

        length = int(self.headers.get("Content-Length") or 0)
        if length > 2_000_000:
            _send_json(self, 413, {"error": {"message": "Request body too large."}})
            return
        body = self.rfile.read(length) if length else b"{}"
        sid, created = _session_id(self)
        extra = [("Set-Cookie", _cookie_header(sid))] if created else None

        incoming = (self.headers.get("Authorization") or "").strip()
        auth = ("Bearer " + ENV_KEY) if ENV_KEY else incoming
        if not auth or auth.lower() in ("bearer", "bearer "):
            _send_json(
                self,
                401,
                {
                    "error": {
                        "message": "Missing TypeSafe API key. Set TYPESAFE_API_KEY or paste a key in the lab strip."
                    }
                },
                extra,
            )
            return

        with SESS_LOCK:
            sess = SESSIONS.setdefault(sid, {"in_flight": 0})
            if sess["in_flight"] >= 1 and MAX_IN_FLIGHT <= 2:
                # one Arena loop in flight per session; extra booths still share the global semaphore
                pass
            sess["in_flight"] += 1

        ev = threading.Event()
        box: dict = {}
        JOBS.put((body, auth, ev, box))
        if not ev.wait(UPSTREAM_TIMEOUT + 20):
            with SESS_LOCK:
                SESSIONS[sid]["in_flight"] = max(0, SESSIONS[sid]["in_flight"] - 1)
            _send_json(self, 504, {"error": {"message": "Upstream timed out."}}, extra)
            return

        with SESS_LOCK:
            SESSIONS[sid]["in_flight"] = max(0, SESSIONS[sid]["in_flight"] - 1)

        if "error" in box:
            _send_json(
                self,
                502,
                {"error": {"message": "Proxy could not reach api.typesafe.ai: " + _scrub(box["error"])}},
                extra,
            )
            return

        status = int(box.get("status") or 502)
        data = box.get("data") or b"{}"
        headers = box.get("headers") or {}
        self.send_response(status)
        self.send_header("Content-Type", headers.get("content-type") or "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        if extra:
            for k, v in extra:
                self.send_header(k, v)
        ra = headers.get("retry-after")
        if ra:
            self.send_header("Retry-After", ra)
        self.end_headers()
        self.wfile.write(data)


class Server(ThreadingHTTPServer):
    allow_reuse_address = False


def main() -> None:
    if not WEB.is_dir():
        raise SystemExit("web/ is missing")
    os.chdir(WEB)
    server = Server((BIND, PORT), Handler)

    def log(msg: str) -> None:
        print(msg, flush=True)

    log("Jev Broadcast Lab")
    log("  Open  http://%s:%s/" % (BIND, PORT))
    if ENV_KEY:
        log("  Using TYPESAFE_API_KEY from the environment")
    else:
        log("  No TYPESAFE_API_KEY in env — paste a key in the lab strip")
    log("  Ctrl+C to stop")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
        server.server_close()


if __name__ == "__main__":
    main()
