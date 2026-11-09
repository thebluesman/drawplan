#!/bin/bash
# Double-click to try Sketchbook Academy with sample data (stored in demo-data/, separate from real progress).
cd "$(dirname "$0")"
python3 server.py --demo
