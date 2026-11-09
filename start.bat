@echo off
REM Double-click this file on Windows to start Sketchbook Academy.
cd /d "%~dp0"
where py >nul 2>nul && (py -3 server.py & goto :eof)
where python >nul 2>nul && (python server.py & goto :eof)
echo Python 3 is needed. Install it from https://www.python.org/downloads/ (tick "Add to PATH") and try again.
pause
