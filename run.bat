@echo off
title SAtendify Launcher
echo ====================================================
echo   SAtendify - Academic Attendance System
echo ====================================================
echo.
echo Launching your local web browser ...
start http://localhost:8000/
echo.
echo Starting Python HTTP Server on Port 8000 ...
echo Press Ctrl+C in this terminal window to stop the server.
echo.
py -m http.server 8000
pause
