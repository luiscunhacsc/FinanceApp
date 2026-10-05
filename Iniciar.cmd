@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Instale primeiro o Node.js 22.12 ou superior a partir de https://nodejs.org
  pause
  exit /b 1
)
if not exist node_modules (
  call npm ci
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
if not exist dist\index.html (
  call npm run build
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
call npm run preview -- --open
pause
