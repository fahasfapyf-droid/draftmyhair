@echo off
setlocal
cd /d "%~dp0"

echo.
echo === Draft My Hair R&D Local Gemini Worker ===
echo Directory: %CD%
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js is not installed or not on PATH.
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo ERROR: npm is not installed or not on PATH.
  exit /b 1
)

if not exist "node_modules\playwright" (
  echo Installing R&D worker dependencies...
  call npm install
  if errorlevel 1 exit /b 1
)

if not exist ".env" (
  echo ERROR: tools\rnd-worker\.env is missing.
  echo Copy .env.example to .env and fill the required values.
  exit /b 1
)

if not exist "node_modules\.bin\playwright.cmd" (
  echo Installing Playwright Chromium...
  call npx playwright install chromium
  if errorlevel 1 exit /b 1
)

echo Starting local Gemini automation worker...
echo Keep this CMD window open while R&D is running.
echo.
call npm start
set EXIT_CODE=%ERRORLEVEL%

echo.
echo R&D worker stopped with exit code %EXIT_CODE%.
pause
exit /b %EXIT_CODE%
