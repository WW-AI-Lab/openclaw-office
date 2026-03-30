@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-openclaw-office.ps1"
set EXIT_CODE=%ERRORLEVEL%
if not "%EXIT_CODE%"=="0" (
  echo.
  echo 启动失败，退出码 %EXIT_CODE%。
  pause
)
exit /b %EXIT_CODE%
