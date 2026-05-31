@echo off
cd /d "%~dp0"
title Minefield Signal - Launcher

echo ==========================================
echo    MINEFIELD: SIGNAL - LAUNCHER
echo ==========================================
echo.

:: 1. Checks whether this is the correct folder
if not exist "package.json" (
    echo [ERROR] package.json not found!
    echo Make sure this script is in the project root.
    goto error
)

:: 2. Checks whether Node.js (npm) is installed
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo [CRITICAL ERROR] Node.js (npm) was not found!
    echo Official link: https://nodejs.org/
    goto error
)

:: 3. Keeps the default Vite entry without renaming the original file
if exist "CAMPOMINADO.html" (
    if not exist "index.html" (
        echo [WARNING] Creating index.html as a copy of CAMPOMINADO.html...
        copy "CAMPOMINADO.html" "index.html" >nul
    )
)

echo Choose a run option:
echo [1] DEV mode (fast, reloads automatically when you save code)
echo [2] PROD mode (builds and optimizes the final deploy version)
echo.
set /p opcao="Type 1 or 2 and press ENTER: "

echo.
echo Installing dependencies (if needed)...
call npm install
if %errorlevel% neq 0 goto error

if "%opcao%"=="1" (
    echo.
    echo Starting the development server...
    call npm run dev -- --open
    if %errorlevel% neq 0 goto error
) else if "%opcao%"=="2" (
    echo.
    echo Building the final project version...
    call npm run build
    if %errorlevel% neq 0 goto error

    echo Starting the production server...
    call npm run preview -- --open
    if %errorlevel% neq 0 goto error
) else (
    echo Invalid option. Exiting...
    pause
    exit /b
)

exit /b

:error
echo.
echo ==========================================
echo [FAILED] An error occurred during execution.
echo Read the message above to identify the problem.
echo ==========================================
pause
