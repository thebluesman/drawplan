"""Start Sketchbook Academy automatically on a Mac, so it's always there for the phone.

Double-click start-automatically.command (or run `python3 autostart.py`). It installs a small
launchd agent that starts the server when you log in, and starts it again if it ever stops.
There's no Terminal window: the app just runs in the background. Run it again to turn it off.

    python3 autostart.py           # turn on (or, if it's already on, offer to turn it off)
    python3 autostart.py --off     # turn off
    python3 autostart.py --status

If you move this folder, run it again so it points at the new place.
"""

import argparse
import os
import plistlib
import subprocess
import sys
import time

LABEL = "com.sketchbookacademy.server"
ROOT = os.path.dirname(os.path.abspath(__file__))
PLIST = os.path.expanduser(f"~/Library/LaunchAgents/{LABEL}.plist")
LOG = os.path.expanduser("~/Library/Logs/Sketchbook Academy.log")
PORT = 4817
DOMAIN = f"gui/{os.getuid()}" if hasattr(os, "getuid") else ""


def launchctl(*args):
    return subprocess.run(["launchctl", *args], capture_output=True, text=True)


def is_loaded():
    return launchctl("print", f"{DOMAIN}/{LABEL}").returncode == 0


def is_running():
    """True if Sketchbook Academy answers on its port, however it was started."""
    import urllib.request

    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{PORT}/api/progress", timeout=1) as r:
            return r.headers.get("Server", "").startswith("SketchbookAcademy")
    except Exception:
        return False


def turn_on():
    was_running = is_running() and not is_loaded()  # e.g. started by double-clicking start.command
    if is_loaded():
        launchctl("bootout", f"{DOMAIN}/{LABEL}")  # reload, in case the folder or Python moved
    os.makedirs(os.path.dirname(PLIST), exist_ok=True)
    os.makedirs(os.path.dirname(LOG), exist_ok=True)
    with open(PLIST, "wb") as f:
        plistlib.dump({
            "Label": LABEL,
            # The Python running this script, by full path: launchd doesn't see the user's PATH.
            "ProgramArguments": [sys.executable, os.path.join(ROOT, "server.py"), "--no-browser"],
            "WorkingDirectory": ROOT,
            "RunAtLoad": True,
            "KeepAlive": True,  # start it again if it stops
            "ThrottleInterval": 30,
            "ProcessType": "Interactive",
            "EnvironmentVariables": {"PYTHONUNBUFFERED": "1"},  # so the log fills as it goes
            "StandardOutPath": LOG,
            "StandardErrorPath": LOG,
        }, f)
    r = launchctl("bootstrap", DOMAIN, PLIST)
    if r.returncode != 0:
        print(f"Couldn't turn it on: {(r.stderr or r.stdout).strip()}")
        return 1
    print("Done. Sketchbook Academy now starts by itself when you log in, with no window to keep open.")
    if was_running:
        print("\nIt's open in another window right now. Close that window (or press Ctrl+C in it).")
        print("The background copy takes over within a minute.")
    else:
        for _ in range(20):
            if is_running():
                break
            time.sleep(0.5)
        print(f"\nIt's running now at http://127.0.0.1:{PORT}" if is_running() else f"\nIt didn't start yet. Look in {LOG} for clues.")
    print("\nIf macOS asks whether Python can accept incoming connections or open files in this folder, click Allow.")
    print("Double-clicking start.command still works: it just opens the browser.")
    print("To turn this off, run start-automatically.command again.")
    return 0


def turn_off():
    if is_loaded():
        launchctl("bootout", f"{DOMAIN}/{LABEL}")  # also stops the server
    if os.path.exists(PLIST):
        os.remove(PLIST)
    print("Turned off. Sketchbook Academy no longer starts by itself. Use start.command to open it.")
    return 0


def main():
    if sys.platform != "darwin":
        print("Starting automatically is only set up for Macs.")
        return 1
    parser = argparse.ArgumentParser(description="Start Sketchbook Academy automatically at login.")
    parser.add_argument("--off", action="store_true", help="Turn automatic start off")
    parser.add_argument("--status", action="store_true", help="Say whether it's on")
    args = parser.parse_args()

    on = os.path.exists(PLIST)
    if args.status:
        print(f"Automatic start is {'on' if on else 'off'}; the app is {'running' if is_running() else 'not running'}.")
        return 0
    if args.off:
        return turn_off()
    if on:
        print("Sketchbook Academy already starts by itself when you log in.")
        try:
            answer = input("Turn that off? Type y and press Return, or just press Return to keep it on (and refresh it): ")
        except EOFError:
            answer = ""
        if answer.strip().lower().startswith("y"):
            return turn_off()
    return turn_on()


if __name__ == "__main__":
    sys.exit(main())
