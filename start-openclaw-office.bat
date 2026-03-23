@echo off
setlocal

title OpenClaw Office
cd /d "%~dp0"

set "HOST=localhost"
set "PORT=5180"
set "APP_URL=http://%HOST%:%PORT%/?resetConnection=1"

echo.
echo OpenClaw Office one-click launcher
echo Project: %CD%
echo Host:    %HOST%
echo Port:    %PORT%
echo Open:    %APP_URL%

if not exist "node_modules" (
  echo.
  echo [ERROR] Dependencies are missing. Run "pnpm install" first.
  exit /b 1
)

echo.
if exist ".env.local" (
  echo [INFO] Found .env.local. Starting with your OpenClaw Gateway configuration...
  echo [INFO] Close this window to stop the dev server.
  echo [INFO] Open %APP_URL% after the server is ready.
  echo.
  call pnpm dev --host %HOST% --port %PORT%
) else (
  echo [INFO] .env.local not found. Starting in mock mode...
  echo [INFO] Close this window to stop the dev server.
  echo [INFO] Open %APP_URL% after the server is ready.
  echo.
  set "VITE_MOCK=true"
  call pnpm dev --host %HOST% --port %PORT%
)

set "EXIT_CODE=%ERRORLEVEL%"
echo.
echo [INFO] OpenClaw Office exited with code %EXIT_CODE%.
exit /b %EXIT_CODE%
