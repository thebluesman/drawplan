#!/usr/bin/env python3
"""Sketchbook Academy — local server.

Serves the course web app from ./app and stores the learner's progress and
uploaded drawings in ./data. Uses only the Python standard library.

    python3 server.py            # opens http://127.0.0.1:4817 in the browser
    python3 server.py --port 9000 --no-browser
"""

import argparse
import json
import mimetypes
import os
import re
import shutil
import sys
import threading
import time
import webbrowser
from datetime import datetime
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlparse

ROOT = os.path.dirname(os.path.abspath(__file__))
APP_DIR = os.path.join(ROOT, "app")
DATA_DIR = os.path.join(ROOT, "data")
UPLOAD_DIR = os.path.join(DATA_DIR, "uploads")
BACKUP_DIR = os.path.join(DATA_DIR, "backups")
PROGRESS_FILE = os.path.join(DATA_DIR, "progress.json")

MAX_UPLOAD_BYTES = 25 * 1024 * 1024
MAX_PROGRESS_BYTES = 5 * 1024 * 1024
IMAGE_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "image/heic": ".heic",
}
SAFE_NAME = re.compile(r"^[A-Za-z0-9._-]+$")

_lock = threading.Lock()
RESTART_ARGV = None  # how to start this server again after an update (set in main)


def set_data_dir(path):
    """Point the server at a different data folder (used by --demo)."""
    global DATA_DIR, UPLOAD_DIR, BACKUP_DIR, PROGRESS_FILE
    DATA_DIR = path
    UPLOAD_DIR = os.path.join(path, "uploads")
    BACKUP_DIR = os.path.join(path, "backups")
    PROGRESS_FILE = os.path.join(path, "progress.json")


def ensure_dirs():
    for d in (DATA_DIR, UPLOAD_DIR, BACKUP_DIR):
        os.makedirs(d, exist_ok=True)


def read_progress():
    if not os.path.exists(PROGRESS_FILE):
        return {}
    with open(PROGRESS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


class Conflict(Exception):
    """The save was based on an older copy of the progress (e.g. a second tab, or a stale one)."""

    def __init__(self, rev):
        self.rev = rev


def write_progress(obj):
    """Atomic write, plus one backup per day (keeps the last 30).

    Every save carries the revision it was based on (``_rev``). If the file has moved on since,
    the save is refused, so a stale browser tab can't overwrite newer progress. Returns the new revision.
    """
    with _lock:
        ensure_dirs()  # recreate data/ if it was moved or deleted while running
        try:
            current = read_progress()
        except (OSError, json.JSONDecodeError):
            current = {}
        cur_rev = int(current.get("_rev", 0) or 0)
        base = obj.get("_rev")
        if current and base is not None and int(base) != cur_rev:
            raise Conflict(cur_rev)
        obj["_rev"] = cur_rev + 1
        tmp = PROGRESS_FILE + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(obj, f, ensure_ascii=False, indent=1)
        os.replace(tmp, PROGRESS_FILE)
        stamp = datetime.now().strftime("%Y-%m-%d")
        daily = os.path.join(BACKUP_DIR, f"progress-{stamp}.json")
        shutil.copyfile(PROGRESS_FILE, daily)
        backups = sorted(os.listdir(BACKUP_DIR))
        for old in backups[:-30]:
            try:
                os.remove(os.path.join(BACKUP_DIR, old))
            except OSError:
                pass
        return obj["_rev"]


class Handler(SimpleHTTPRequestHandler):
    server_version = "SketchbookAcademy/1.0"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=APP_DIR, **kwargs)

    # Quieter logs: only errors.
    def log_message(self, fmt, *args):
        if args and isinstance(args[1], str) and args[1].startswith(("4", "5")):
            sys.stderr.write("%s - %s\n" % (self.log_date_time_string(), fmt % args))

    def end_headers(self):
        # App files change when the course is edited; don't let the browser cache them stale.
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    # ---------- helpers ----------
    def send_json(self, obj, status=HTTPStatus.OK):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def error_json(self, status, message):
        self.send_json({"error": message}, status)

    def read_body(self, limit):
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0:
            return b""
        if length > limit:
            raise ValueError("too_large")
        return self.rfile.read(length)

    def same_origin(self):
        """Reject writes from other websites (basic CSRF guard for a localhost app)."""
        origin = self.headers.get("Origin")
        if not origin:
            return True
        host = self.headers.get("Host", "")
        return urlparse(origin).netloc == host

    # ---------- routes ----------
    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/api/progress":
            try:
                return self.send_json(read_progress())
            except (OSError, json.JSONDecodeError) as e:
                return self.error_json(HTTPStatus.INTERNAL_SERVER_ERROR, f"Could not read progress: {e}")
        if path.startswith("/uploads/"):
            return self.serve_upload(unquote(path[len("/uploads/"):]))
        if path == "/api/update":
            import update

            try:
                return self.send_json(update.check())
            except Exception as e:
                return self.error_json(HTTPStatus.BAD_GATEWAY, f"Couldn't reach GitHub: {e}")
        return super().do_GET()

    def do_PUT(self):
        path = urlparse(self.path).path
        if path != "/api/progress":
            return self.error_json(HTTPStatus.NOT_FOUND, "Not found")
        if not self.same_origin():
            return self.error_json(HTTPStatus.FORBIDDEN, "Cross-origin write refused")
        try:
            obj = json.loads(self.read_body(MAX_PROGRESS_BYTES) or b"{}")
            if not isinstance(obj, dict):
                raise ValueError("Progress must be a JSON object")
            rev = write_progress(obj)
            return self.send_json({"ok": True, "rev": rev, "savedAt": int(time.time() * 1000)})
        except Conflict as c:
            return self.send_json({"error": "conflict", "rev": c.rev}, HTTPStatus.CONFLICT)
        except ValueError as e:
            return self.error_json(HTTPStatus.BAD_REQUEST, str(e))
        except OSError as e:
            return self.error_json(HTTPStatus.INTERNAL_SERVER_ERROR, f"Could not save: {e}")

    def do_POST(self):
        path = urlparse(self.path).path
        if path == "/api/progress":
            # navigator.sendBeacon (used when the tab closes) can only POST.
            return self.do_PUT()
        if path == "/api/update":
            return self.run_update()
        if path != "/api/uploads":
            return self.error_json(HTTPStatus.NOT_FOUND, "Not found")
        if not self.same_origin():
            return self.error_json(HTTPStatus.FORBIDDEN, "Cross-origin write refused")
        ctype = (self.headers.get("Content-Type") or "").split(";")[0].strip().lower()
        ext = IMAGE_TYPES.get(ctype)
        if not ext:
            return self.error_json(HTTPStatus.UNSUPPORTED_MEDIA_TYPE, "Only JPG, PNG, WEBP, GIF or HEIC images")
        try:
            data = self.read_body(MAX_UPLOAD_BYTES)
        except ValueError:
            return self.error_json(HTTPStatus.REQUEST_ENTITY_TOO_LARGE, "Image is larger than 25 MB")
        if not data:
            return self.error_json(HTTPStatus.BAD_REQUEST, "Empty upload")
        ensure_dirs()
        name = datetime.now().strftime("%Y%m%d-%H%M%S-%f") + ext
        with open(os.path.join(UPLOAD_DIR, name), "wb") as f:
            f.write(data)
        return self.send_json({"file": name, "url": f"/uploads/{name}"}, HTTPStatus.CREATED)

    def do_DELETE(self):
        path = urlparse(self.path).path
        if not path.startswith("/api/uploads/"):
            return self.error_json(HTTPStatus.NOT_FOUND, "Not found")
        if not self.same_origin():
            return self.error_json(HTTPStatus.FORBIDDEN, "Cross-origin write refused")
        name = unquote(path[len("/api/uploads/"):])
        if not SAFE_NAME.match(name):
            return self.error_json(HTTPStatus.BAD_REQUEST, "Bad file name")
        target = os.path.join(UPLOAD_DIR, name)
        if os.path.exists(target):
            # Move to a trash folder instead of deleting outright.
            trash = os.path.join(DATA_DIR, "trash")
            os.makedirs(trash, exist_ok=True)
            os.replace(target, os.path.join(trash, name))
        return self.send_json({"ok": True})

    def run_update(self):
        """Install the latest version from GitHub, then restart so a new server.py takes effect."""
        # A JSON content type can't be sent cross-site without a CORS preflight, which this server never grants.
        if not self.same_origin() or not (self.headers.get("Content-Type") or "").startswith("application/json"):
            return self.error_json(HTTPStatus.FORBIDDEN, "Cross-origin write refused")
        import update

        try:
            res = update.apply()
        except Exception as e:
            return self.error_json(HTTPStatus.BAD_GATEWAY, f"Couldn't update: {e}")
        needs_restart = any(f.endswith(".py") for f in res["files"])
        can_restart = needs_restart and os.name == "posix" and RESTART_ARGV is not None
        self.send_json({"ok": True, "files": len(res["files"]), "restarting": can_restart, "restartManually": needs_restart and not can_restart})
        if can_restart:
            print("Updated. Restarting…")
            # Replace this process with a fresh server on the same port, after the response has gone out.
            threading.Timer(0.5, lambda: os.execv(sys.executable, RESTART_ARGV)).start()

    def serve_upload(self, name):
        if not SAFE_NAME.match(name):
            return self.error_json(HTTPStatus.BAD_REQUEST, "Bad file name")
        target = os.path.join(UPLOAD_DIR, name)
        if not os.path.isfile(target):
            return self.error_json(HTTPStatus.NOT_FOUND, "Not found")
        ctype = mimetypes.guess_type(target)[0] or "application/octet-stream"
        with open(target, "rb") as f:
            data = f.read()
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


def is_our_app(port):
    """True if the server already on this port is Sketchbook Academy."""
    import urllib.request

    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/progress", timeout=1) as r:
            return r.headers.get("Server", "").startswith("SketchbookAcademy")
    except Exception:
        return False


def main():
    parser = argparse.ArgumentParser(description="Run Sketchbook Academy locally.")
    parser.add_argument("--port", type=int, default=None, help="Port (default 4817, or 4818 with --demo)")
    parser.add_argument("--no-browser", action="store_true", help="Don't open the browser automatically")
    parser.add_argument("--demo", action="store_true", help="Run with sample data in demo-data/ (real data is untouched)")
    parser.add_argument("--reset-demo", action="store_true", help="With --demo: regenerate the sample data first")
    args = parser.parse_args()

    if args.demo:
        set_data_dir(os.path.join(ROOT, "demo-data"))
        if args.reset_demo and os.path.isdir(DATA_DIR):
            shutil.rmtree(DATA_DIR)
        if not os.path.exists(PROGRESS_FILE):
            import demo_seed

            count = demo_seed.build(DATA_DIR, os.path.join(APP_DIR, "data", "curriculum.json"))
            print(f"Created demo data ({count} sample drawings) in demo-data/")
    if args.port is None:
        args.port = 4818 if args.demo else 4817

    ensure_dirs()
    httpd = None
    for port in range(args.port, args.port + 10):
        try:
            httpd = ThreadingHTTPServer(("127.0.0.1", port), Handler)
            break
        except OSError:
            if is_our_app(port):
                url = f"http://127.0.0.1:{port}"
                print(f"Sketchbook Academy is already running at {url}")
                if not args.no_browser:
                    webbrowser.open(url)
                return
    if httpd is None:
        print(f"Ports {args.port}-{args.port + 9} are all busy. Try: python3 server.py --port 5900")
        return
    global RESTART_ARGV
    RESTART_ARGV = [sys.executable, os.path.abspath(__file__), "--port", str(port), "--no-browser"] + (["--demo"] if args.demo else [])
    url = f"http://127.0.0.1:{port}"
    print(f"Sketchbook Academy{' (DEMO DATA)' if args.demo else ''} is running at {url}")
    print("Keep this window open while you use the app. Press Ctrl+C to stop.")
    if not args.no_browser:
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()
