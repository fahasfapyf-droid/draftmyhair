@echo off
setlocal EnableExtensions

cd /d "%~dp0"

echo.
echo === Draft My Hair - Gemini Profile Linker ===
echo.
echo This creates one isolated Chrome user-data directory per configured
echo Gemini profile and opens Gemini so you can authenticate that profile.
echo.
echo IMPORTANT:
echo - Use the Google/Gemini account intended for that profile.
echo - Do NOT put passwords or tokens in profiles.json or GitHub.
echo - Finish login in the opened Chrome window, then return here.
echo - Close the Chrome window before continuing to the next profile.
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js is not installed or not on PATH.
  exit /b 1
)

if not exist "profiles.json" (
  echo Creating local profile registry...
  copy /Y "profiles.example.json" "profiles.json" >nul
)

echo.
echo Profile 1:
echo   %%LOCALAPPDATA%%\DraftMyHair\GeminiProfiles\Profile-1
if not exist "%LOCALAPPDATA%\DraftMyHair\GeminiProfiles\Profile-1" mkdir "%LOCALAPPDATA%\DraftMyHair\GeminiProfiles\Profile-1"

start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --user-data-dir="%LOCALAPPDATA%\DraftMyHair\GeminiProfiles\Profile-1" "https://gemini.google.com/app"
echo.
echo Complete Gemini authentication for Profile 1 in the Chrome window.
pause

echo.
echo Profile 2:
echo   %%LOCALAPPDATA%%\DraftMyHair\GeminiProfiles\Profile-2
if not exist "%LOCALAPPDATA%\DraftMyHair\GeminiProfiles\Profile-2" mkdir "%LOCALAPPDATA%\DraftMyHair\GeminiProfiles\Profile-2"

start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --user-data-dir="%LOCALAPPDATA%\DraftMyHair\GeminiProfiles\Profile-2" "https://gemini.google.com/app"
echo.
echo Profile 2 is PAUSED by default. Authenticate it now so it is ready for rotation.
pause

echo.
echo Gemini profile linking complete.
echo Review tools\rnd-worker\profiles.json before starting the worker.
echo.
pause
