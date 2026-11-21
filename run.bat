@echo off
rem ============================================================================
rem  Insightful - run the app (Windows)
rem  Use this after setup-and-run.bat has been run once (needs .env).
rem  - Installs packages only if node_modules is missing.
rem  - Builds the frontend only if dist is missing, or if "--build" is given.
rem  - Starts the server on http://localhost:3001 and opens the browser.
rem  Close the window to stop the server.
rem ============================================================================
setlocal EnableExtensions
title Insightful - Run
cd /d "%~dp0"

set "APP_PORT=3001"

where node >nul 2>&1
if errorlevel 1 (
  echo ERROR: Node.js was not found. Run setup-and-run.bat first, or install Node.js 18+ from https://nodejs.org
  pause
  exit /b 1
)

if not exist ".env" (
  echo ERROR: .env is missing. Run setup-and-run.bat first to create or restore it.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo Installing packages...
  if exist "package-lock.json" (call npm ci --no-audit --no-fund) else (call npm install --no-audit --no-fund)
  if errorlevel 1 goto fail
)

if /i "%~1"=="--build" goto build
if not exist "dist\index.html" goto build
goto start_server

:build
echo Building the app...
call npm run build
if errorlevel 1 goto fail

:start_server
echo.
echo ============================================================
echo  Insightful is starting on http://localhost:%APP_PORT%
echo  Keep this window open. Close it to stop the app.
echo ============================================================
start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 4; Start-Process 'http://localhost:%APP_PORT%'"
node server/index.js
echo.
echo The server has stopped.
pause
exit /b 0

:fail
echo.
echo Run failed. Fix the error above and run this file again.
pause
exit /b 1
