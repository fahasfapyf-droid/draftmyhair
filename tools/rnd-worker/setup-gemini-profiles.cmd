@echo off
setlocal
cd /d "%~dp0"

echo.
echo === Draft My Hair - Gemini Profile Linker ===
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js is not installed or not on PATH.
  exit /b 1
)

if not exist "node_modules\.bin\tsx.cmd" (
  echo Installing R&D worker dependencies...
  call npm install
  if errorlevel 1 exit /b 1
)

if not exist "profiles.json" (
  echo Creating local Gemini profile registry from profiles.example.json...
  copy /Y "profiles.example.json" "profiles.json" >nul
)

call npx tsx link-gemini-profiles.ts
set EXIT_CODE=%ERRORLEVEL%

echo.
echo Gemini profile linker exited with code %EXIT_CODE%.
pause
exit /b %EXIT_CODE%
