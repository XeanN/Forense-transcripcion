@echo off
cd /d "%~dp0"

echo ============================================
echo   Detener servidor - Herramienta Forense
echo ============================================
echo.

set "PORT=3000"
if exist "backend\.env" (
    for /f "usebackq tokens=1,2 delims==" %%A in ("backend\.env") do (
        if /i "%%A"=="PORT" set "PORT=%%B"
    )
)

echo Buscando el servidor en el puerto %PORT%...
echo.

set "PID="
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /r /c:":%PORT% .*LISTENING"') do set "PID=%%P"

if "%PID%"=="" (
    echo No se encontro ningun servidor corriendo en el puerto %PORT%.
    echo Puede que ya este detenido.
    echo.
    pause
    exit /b 0
)

echo Encontrado proceso con PID %PID% escuchando en el puerto %PORT%.
taskkill /F /PID %PID% >nul 2>nul
if errorlevel 1 (
    echo.
    echo [ERROR] No se pudo detener el proceso automaticamente.
    echo Cierralo manualmente desde el Administrador de Tareas ^(PID %PID%^).
    echo.
    pause
    exit /b 1
)

echo.
echo Servidor detenido correctamente.
echo.
pause
