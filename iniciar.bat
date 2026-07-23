@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ============================================
echo   Herramienta Forense de Transcripcion
echo ============================================
echo.
echo Verificando dependencias del sistema...
echo.

where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] No se encontro Node.js instalado o no esta en el PATH.
    echo Instalalo desde: https://nodejs.org/
    echo.
    pause
    exit /b 1
)
echo   [OK] Node.js encontrado

where python >nul 2>nul
if errorlevel 1 (
    echo [ERROR] No se encontro Python instalado o no esta en el PATH.
    echo Instalalo desde: https://www.python.org/downloads/
    echo IMPORTANTE: durante la instalacion, marca la casilla "Add Python to PATH".
    echo.
    pause
    exit /b 1
)
echo   [OK] Python encontrado

where ffmpeg >nul 2>nul
if errorlevel 1 (
    echo [ERROR] No se encontro ffmpeg instalado o no esta en el PATH.
    echo Descargalo desde: https://www.gyan.dev/ffmpeg/builds/ ^(build "essentials"^)
    echo Luego agrega la carpeta "bin" del zip descomprimido al PATH del sistema.
    echo.
    pause
    exit /b 1
)
where ffprobe >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Se encontro ffmpeg pero no ffprobe en el PATH ^(deberian venir juntos^).
    echo Revisa que la carpeta "bin" de tu instalacion de ffmpeg este completa y en el PATH.
    echo.
    pause
    exit /b 1
)
echo   [OK] ffmpeg / ffprobe encontrados
echo.

if not exist "backend\node_modules" (
    echo Instalando dependencias de Node ^(esto puede tardar unos minutos^)...
    pushd backend
    call npm install
    if errorlevel 1 (
        popd
        echo.
        echo [ERROR] Fallo "npm install". Revisa el mensaje de arriba.
        pause
        exit /b 1
    )
    popd
    echo.
) else (
    echo   [OK] Dependencias de Node ya instaladas
    echo.
)

if not exist "backend\python\.venv" (
    echo Creando entorno virtual de Python e instalando faster-whisper...
    pushd backend\python
    python -m venv .venv
    if errorlevel 1 (
        popd
        echo.
        echo [ERROR] No se pudo crear el entorno virtual de Python.
        pause
        exit /b 1
    )
    .venv\Scripts\python.exe -m pip install -r requirements.txt
    if errorlevel 1 (
        popd
        echo.
        echo [ERROR] Fallo la instalacion de dependencias de Python. Revisa el mensaje de arriba.
        pause
        exit /b 1
    )
    popd
    echo.
) else (
    echo   [OK] Entorno virtual de Python ya existe
    echo.
)

if not exist "backend\.env" (
    echo No se encontro backend\.env, creandolo desde .env.example...
    copy "backend\.env.example" "backend\.env" >nul
    echo.
    echo ============================================
    echo   IMPORTANTE - configura tu archivo .env
    echo ============================================
    echo Se creo backend\.env con valores de ejemplo. Debes editarlo con tus
    echo propios datos ^(JWT_SECRET, usuario/contrasena del admin, credenciales
    echo de Gmail, etc.^) antes de continuar. Se va a abrir en el Bloc de notas.
    echo.
    echo Guarda el archivo y cierra el Bloc de notas para continuar automaticamente.
    echo.
    notepad "backend\.env"
    echo.
)

if not exist "backend\src\db\forense.db" (
    echo Inicializando la base de datos y el usuario admin...
    pushd backend
    call npm run seed
    if errorlevel 1 (
        popd
        echo.
        echo [ERROR] Fallo la inicializacion de la base de datos. Revisa que backend\.env este bien completado.
        pause
        exit /b 1
    )
    popd
    echo.
)

echo Iniciando el servidor (en segundo plano, minimizado)...
pushd backend
start "Forense App - Servidor" /min cmd /k npm start
popd

timeout /t 3 /nobreak >nul

start "" "http://localhost:3000/login/index.html"

echo.
echo El servidor quedo corriendo minimizado (buscalo en la barra de tareas
echo como "Forense App - Servidor" si necesitas ver sus logs).
echo Para detenerlo, hace doble clic en detener.bat.
echo Esta ventana ya puede cerrarse.
echo.
pause
