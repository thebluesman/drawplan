#!/bin/bash
# Double-click this file on a Mac to start Sketchbook Academy.
cd "$(dirname "$0")"
if ! command -v python3 >/dev/null 2>&1; then
  echo "Python 3 is needed. Install it from https://www.python.org/downloads/ and try again."
  read -n 1 -s -r -p "Press any key to close…"; exit 1
fi
python3 server.py
