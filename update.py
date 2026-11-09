"""Update Sketchbook Academy to the latest version from GitHub.

Two ways in:
- In the app: Settings → "Check for updates" (server.py calls check() and apply() below).
- Double-click update.command (Mac) or update.bat (Windows), which runs this file.

Your progress and drawings in data/ are never touched: only the app's own files are replaced.
If this folder is a git clone, it uses `git pull`; otherwise it downloads the latest ZIP from GitHub.
The installed version (a commit id) is kept in .version so the app can tell when a newer one exists.
Python standard library only, like the rest of the app.
"""

import io
import os
import shutil
import subprocess
import sys
import urllib.error
import urllib.request
import zipfile

REPO = "thebluesman/drawplan"
BRANCH = "main"
ROOT = os.path.dirname(os.path.abspath(__file__))
VERSION_FILE = os.path.join(ROOT, ".version")
KEEP = {"data", "demo-data", ".git", ".version"}  # never overwritten
UA = {"User-Agent": "SketchbookAcademy-updater"}


def _is_git():
    return os.path.isdir(os.path.join(ROOT, ".git")) and shutil.which("git") is not None


def _git(*args):
    return subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True)


def current_version():
    """The installed commit id, or None if unknown (e.g. a ZIP that has never been updated)."""
    if _is_git():
        r = _git("rev-parse", "HEAD")
        return r.stdout.strip() or None
    try:
        with open(VERSION_FILE, encoding="utf-8") as f:
            return f.read().strip() or None
    except OSError:
        return None


def fetch(url, headers=None, timeout=60):
    """GET a URL. Falls back to the system's curl when Python can't verify HTTPS certificates,
    which is common with Python from python.org on a Mac ("Install Certificates" never run)."""
    headers = {**UA, **(headers or {})}
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=timeout) as r:
            return r.read()
    except urllib.error.URLError as e:
        if "CERTIFICATE" not in str(e).upper() or not shutil.which("curl"):
            raise
    args = ["curl", "-fsSL", "--max-time", str(timeout)]
    for k, v in headers.items():
        args += ["-H", f"{k}: {v}"]
    r = subprocess.run(args + [url], capture_output=True)
    if r.returncode != 0:
        raise RuntimeError(r.stderr.decode(errors="replace").strip() or "download failed")
    return r.stdout


def latest_version():
    return fetch(f"https://api.github.com/repos/{REPO}/commits/{BRANCH}", {"Accept": "application/vnd.github.sha"}, 15).decode().strip()


def check():
    """{'current', 'latest', 'available'}. Raises on network errors."""
    cur, latest = current_version(), latest_version()
    return {"current": cur, "latest": latest, "available": cur != latest}


def apply():
    """Install the latest version. Returns {'files': [...changed paths...], 'version': sha}."""
    if _is_git():
        before = current_version()
        r = _git("pull", "--ff-only")
        if r.returncode != 0:
            raise RuntimeError((r.stderr or r.stdout).strip() or "git pull failed")
        after = current_version()
        files = _git("diff", "--name-only", before, after).stdout.split() if before != after else []
        return {"files": files, "version": after}

    sha = latest_version()
    blob = fetch(f"https://github.com/{REPO}/archive/{sha}.zip", timeout=120)  # download everything before touching any file
    z = zipfile.ZipFile(io.BytesIO(blob))
    prefix = z.namelist()[0].split("/")[0] + "/"  # GitHub wraps everything in "drawplan-<sha>/"
    changed = []
    for info in z.infolist():
        rel = info.filename[len(prefix):]
        if not rel or info.is_dir():
            continue
        parts = rel.split("/")
        if parts[0] in KEEP or ".." in parts or os.path.isabs(rel):
            continue
        dest = os.path.join(ROOT, *parts)
        data = z.read(info)
        try:
            with open(dest, "rb") as f:
                if f.read() == data:
                    continue  # unchanged
        except OSError:
            pass
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        with open(dest, "wb") as out:
            out.write(data)
        if rel.endswith(".command"):
            os.chmod(dest, 0o755)  # keep the double-click scripts runnable on the Mac
        changed.append(rel)
    with open(VERSION_FILE, "w", encoding="utf-8") as f:
        f.write(sha + "\n")
    return {"files": changed, "version": sha}


def main():
    print("Sketchbook Academy updater\n")
    print("Your progress and drawings (the data folder) are left as they are.\n")
    try:
        info = check()
        if not info["available"]:
            print("You already have the latest version.")
            return 0
        print("Downloading the latest version…")
        res = apply()
    except Exception as e:  # offline, GitHub unreachable, etc.
        print(f"Couldn't update: {e}")
        print("Check you're online and try again. Your data folder was not touched.")
        return 1
    print(f"Updated {len(res['files'])} files.")
    print("\nDone. If the app is open, close its window and start it again, then reload the browser.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
