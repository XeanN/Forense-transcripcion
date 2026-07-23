# Herramienta Forense de Transcripcion

Aplicacion web local para transcribir videos/audios de interrogatorios, con enfoque en privacidad: ningun archivo ni transcripcion se guarda permanentemente en el servidor.

## Estado actual

Implementado:
- Autenticacion (login, JWT, recuperacion de contrasena por correo)
- Panel de administracion (crear/listar/revocar usuarios, log de actividad)
- Panel de usuario: subir video o audio, transcripcion con faster-whisper, extraccion de audio desde video, barra de progreso, descarga en .txt/.pdf/.mp3
- Borrado automatico de archivos temporales (original + chunks) al finalizar cada job

Pendiente:
- Despliegue en la nube (por ahora es solo local)

## Requisitos previos

- Node.js 18+ (probado con v22)
- Python 3.10+ (probado con 3.11)
- ffmpeg y ffprobe instalados y disponibles en el PATH (probado con el build de gyan.dev)
- Cuenta de Gmail con una **App Password** (no la contrasena normal) si se quiere usar la recuperacion de contrasena por correo
- Conexion a internet la primera vez que se transcribe: `faster-whisper` descarga el modelo elegido (ej. "small", ~500 MB) desde Hugging Face y lo cachea localmente para usos futuros

## Configuracion

### 1. Backend (Node)

```
cd backend
cp .env.example .env
npm install
```

Editar `.env` y completar al menos:
- `JWT_SECRET`: una cadena larga y aleatoria
- `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_EMAIL`: credenciales del usuario admin inicial
- `GMAIL_USER`, `GMAIL_APP_PASSWORD`: solo si se va a usar "olvide mi contrasena"

Luego inicializar la base de datos:

```
npm run seed
```

Esto crea la base SQLite (`src/db/forense.db`) con las tablas `users` y `activity_log`, y el usuario admin definido en `.env`.

### 2. Motor de transcripcion (Python + faster-whisper)

Se recomienda un entorno virtual dedicado dentro de `backend/python`:

```
cd backend/python
python -m venv .venv
./.venv/Scripts/pip install -r requirements.txt   # Windows
# source .venv/bin/activate && pip install -r requirements.txt   # Linux/Mac
```

En `backend/.env`, `PYTHON_BIN` ya apunta por defecto a `./python/.venv/Scripts/python.exe`. Si usas Linux/Mac o una ruta distinta, ajusta esa variable.

Variables relevantes en `.env`:
- `WHISPER_MODEL_SIZE`: `tiny`, `base`, `small`, `medium` o `large-v3`. `small` es un buen balance velocidad/precision en CPU; `tiny` es mas rapido pero menos preciso (util solo para pruebas).
- `WHISPER_COMPUTE_TYPE`: `int8` (mas rapido en CPU, recomendado).
- `WHISPER_LANGUAGE`: `es` fuerza espanol (mas rapido y preciso si los interrogatorios son en espanol). Vacio = autodetectar idioma.
- `CHUNK_DURATION_MINUTES`: duracion de cada fragmento para archivos largos (default 15).

El modelo se descarga automaticamente la primera vez que se transcribe algo; no requiere descarga manual.

## Correr el proyecto

```
cd backend
npm start
```

El servidor queda disponible en `http://localhost:3000` y sirve tanto la API (`/api/...`) como el frontend estatico.

- Login: `http://localhost:3000/login/index.html`
- Panel admin: `http://localhost:3000/admin-dashboard/index.html` (solo rol admin)
- Panel usuario: `http://localhost:3000/user-dashboard/index.html`

### Flujo de transcripcion

1. El usuario sube un video o audio (extensiones permitidas: mp4, mov, avi, mkv, mp3, wav, m4a).
2. Si es **video**, elige entre "Extraer Audio" (descarga un .mp3) o "Transcribir a Texto".
3. Si es **audio**, va directo a transcripcion.
4. Si el archivo es largo, se divide en chunks de `CHUNK_DURATION_MINUTES` minutos con ffmpeg y cada chunk se transcribe en orden con `faster-whisper` (proceso Python invocado por Node).
5. El frontend consulta `/api/job/:jobId/status` cada 1.5s para mostrar el progreso.
6. Al terminar, el texto se muestra en pantalla y se puede descargar como `.txt` o `.pdf` (generados al vuelo, sin guardarse en disco).
7. Inmediatamente despues de terminar, se borran el archivo original y todos los chunks del disco. El texto solo vive en memoria del servidor (nunca en disco) y se purga automaticamente tras 2 horas o al reiniciar el servidor.
8. Para "Extraer Audio", el .mp3 resultante se borra del disco justo despues de que el usuario lo descarga (o a los 30 minutos si nunca lo descarga).
9. Al iniciar el servidor, cualquier archivo temporal que haya quedado de una ejecucion anterior (por ejemplo, por un cierre inesperado) se borra automaticamente.

## Notas de seguridad

- Las contrasenas se almacenan siempre con `bcrypt`, nunca en texto plano.
- El `.env` nunca debe subirse a control de versiones (ya esta en `.gitignore`).
- El log de actividad guarda solo metadata (usuario, accion, nombre de archivo, tipo, duracion, fecha); nunca contenido de archivos ni transcripciones.
- Todas las rutas de admin, subida y procesamiento estan protegidas con JWT, y cada job solo es accesible por el usuario que lo creo.
- Los logs del servidor solo imprimen eventos (ej. "Job X completado"), nunca el contenido de una transcripcion.
