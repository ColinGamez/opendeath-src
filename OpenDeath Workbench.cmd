@echo off
set "ELECTRON_RUN_AS_NODE="
set "WORKBENCH=%~dp0packages\desktop\dist-workbench\win-unpacked\opendeath Dev.exe"
if not exist "%WORKBENCH%" (
  echo The Windows workbench package has not been built yet.
  pause
  exit /b 1
)
start "" "%WORKBENCH%"
