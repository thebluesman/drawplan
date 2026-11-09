@echo off
REM Double-click this file on Windows to update Sketchbook Academy. Your progress (the data folder) is kept.
cd /d "%~dp0"
where py >nul 2>nul && (py -3 update.py & pause & goto :eof)
where python >nul 2>nul && (python update.py & pause & goto :eof)
echo Python 3 is needed. Install it from https://www.python.org/downloads/ (tick "Add to PATH") and try again.
pause
