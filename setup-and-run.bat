@echo off
rem ============================================================================
rem  Insightful - automatic install + autorun (Windows)
rem  First run : installs Node.js (if missing), restores .env from .env.enc
rem              (asks for password) or creates a new .env, installs packages,
rem              builds the app, adds an autorun entry to Windows Startup,
rem              then starts the server and opens the browser.
rem  Later runs: starts the server directly (also used by the Startup entry
rem              with the --run argument, which skips the browser).
rem  To remove autorun: delete "Insightful-Autorun.lnk" from the Startup folder
rem  (run "shell:startup" in Windows Run dialog).
rem ============================================================================
setlocal EnableExtensions
title Insightful - Setup and Run
cd /d "%~dp0"

set "APP_PORT=3001"
set "STARTUP_LNK=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\Insightful-Autorun.lnk"

if /i "%~1"=="--run" goto check_ready
goto setup

:check_ready
if not exist "node_modules\" goto setup
if not exist "dist\index.html" goto setup
if not exist ".env" goto setup
goto run_app

:setup
echo.
echo ==== [1/5] Checking Node.js ====
where node >nul 2>&1
if not errorlevel 1 goto node_ok

where winget >nul 2>&1
if errorlevel 1 goto no_winget

echo Node.js not found. Installing Node.js LTS with winget...
winget install -e --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
set "PATH=%ProgramFiles%\nodejs;%APPDATA%\npm;%PATH%"
where node >nul 2>&1
if errorlevel 1 goto no_node

:node_ok
for /f "delims=" %%v in ('node -v') do echo Found Node.js %%v
node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 18 ? 0 : 1)"
if errorlevel 1 goto old_node

echo.
echo ==== [2/5] Preparing configuration (.env) ====
if exist ".env" (
  echo .env already exists, keeping it.
  goto ensure_env
)
if exist ".env.enc" goto restore_env
goto create_env

:restore_env
echo Found .env.enc. Enter its password to restore .env.
set "TRIES=0"
:decrypt_try
set /a TRIES+=1
powershell -NoProfile -ExecutionPolicy Bypass -Command "$p=Read-Host 'Password' -AsSecureString; $b=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($p); $env:ENV_PASSWORD=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($b); [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b); node tools/env-crypt.mjs decrypt; exit $LASTEXITCODE"
if not errorlevel 1 goto ensure_env
if %TRIES% lss 3 (
  echo Wrong password or corrupted file. Try again.
  goto decrypt_try
)
echo Could not restore .env after 3 attempts.
goto fail

:create_env
echo No .env or .env.enc found. Creating a new .env with random secrets.
if not exist "server\.env.example" goto fail
node -e "const fs=require('fs');const c=require('crypto');const r=()=>c.randomBytes(48).toString('base64url');let t=fs.readFileSync('server/.env.example','utf8');t=t.replace('replace-with-a-long-random-secret',r()).replace('replace-with-a-different-random-encryption-secret',r()).replace('replace-with-a-one-time-random-setup-key',r()).replace('NODE_ENV=development','NODE_ENV=production').replace('# COOKIE_SECURE=false','COOKIE_SECURE=false');fs.writeFileSync('.env',t);console.log('Created .env with new random secrets.');"
if errorlevel 1 goto fail
echo IMPORTANT: copy the ADMIN_SETUP_KEY line from .env. You need it for the first-time admin sign-up.

:ensure_env
node tools/ensure-env.mjs
if errorlevel 1 goto fail

echo.
echo ==== [3/5] Installing packages ====
if exist "node_modules\" goto deps_ok
if exist "package-lock.json" call npm ci --no-audit --no-fund
if not exist "package-lock.json" call npm install --no-audit --no-fund
if errorlevel 1 goto fail

:deps_ok
echo.
echo ==== [4/5] Building the app ====
call npm run build
if errorlevel 1 goto fail

echo.
echo ==== [5/5] Adding autorun at Windows logon ====
powershell -NoProfile -ExecutionPolicy Bypass -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut('%STARTUP_LNK%'); $s.TargetPath='%~f0'; $s.Arguments='--run'; $s.WorkingDirectory='%~dp0'; $s.WindowStyle=1; $s.Description='Insightful auto start'; $s.Save()"
if errorlevel 1 echo Warning: could not create the Startup shortcut. The app will still run now.

:run_app
echo.
echo ============================================================
echo  Insightful is starting on http://localhost:%APP_PORT%
echo  Keep this window open. Close it to stop the app.
echo ============================================================
if /i not "%~1"=="--run" start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 4; Start-Process 'http://localhost:%APP_PORT%'"
node server/index.js
echo.
echo The server has stopped.
pause
exit /b 0

:no_winget
echo.
echo ERROR: Node.js is missing and winget is not available.
echo Install Node.js LTS manually from https://nodejs.org then run this file again.
goto fail

:no_node
echo.
echo ERROR: Node.js installation did not finish. Close this window, open a new one, and run this file again.
goto fail

:old_node
echo.
echo ERROR: Node.js 18 or newer is required. Update Node.js and run this file again.
goto fail

:fail
echo.
echo Setup failed. Fix the error above and run this file again.
pause
exit /b 1
