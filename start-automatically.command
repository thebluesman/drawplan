#!/bin/bash
# Double-click this file on a Mac to make Sketchbook Academy start by itself when you log in.
# Double-click it again to turn that off.
cd "$(dirname "$0")"
if ! command -v python3 >/dev/null 2>&1; then
  echo "Python 3 is needed. Install it from https://www.python.org/downloads/ and try again."
  read -n 1 -s -r -p "Press any key to close…"; exit 1
fi
python3 autostart.py
echo
read -n 1 -s -r -p "Press any key to close…"
