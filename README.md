# Herramienta Forense de Transcripcion

Aplicacion web local para transcribir videos/audios de interrogatorios, con enfoque en privacidad: ningun archivo ni transcripcion se guarda permanentemente en el servidor.

## Estado actual

Implementado:
- Autenticacion (login, JWT)
- Primer login obligatorio para usuarios nuevos: definen su propia contrasena y una pregunta de seguridad personalizada
- Recuperacion de contrasena: por correo (Gmail) solo para el admin; por pregunta de seguridad propia para usuarios normales, con limite de intentos y bloqueo temporal
- Panel de administracion (crear/listar/revocar usuarios, log de actividad)
- Panel de usuario: subir video o audio, transcripcion con faster-whisper, extraccion de audio desde video, barra de progreso, descarga en .txt/.pdf/.mp3
- Borrado automatico de archivos temporales (original + chunks) al finalizar cada job

Pendiente:
- Despliegue en la nube (por ahora es solo local)

---

## Inicio rapido (Windows)

**Para iniciar:** doble clic en `iniciar.bat`.
**Para detener el servidor:** doble clic en `detener.bat`.

Si ya tenes **Node.js, Python y ffmpeg instalados** (ver requisitos abajo), no hace falta seguir los pasos manuales: alcanza con hacer **doble clic en `iniciar.bat`**, en la raiz del proyecto.

El script automaticamente:
1. Verifica que Node, Python y ffmpeg/ffprobe esten instalados (si falta algo, te dice que instalar y de donde descargarlo, y se detiene).
2. Si es la primera vez, instala las dependencias de Node (`npm install`).
3. Si es la primera vez, crea el entorno virtual de Python e instala `faster-whisper`.
4. Si es la primera vez, crea `backend\.env` a partir de `.env.example` y lo abre en el Bloc de notas para que lo completes con tus datos (guardalo y cerralo para continuar).
5. Si es la primera vez, inicializa la base de datos y el usuario admin.
6. Levanta el servidor **minimizado** (en la barra de tareas, sin taparte la pantalla) y abre tu navegador en `http://localhost:3000/login/index.html` automaticamente.

Las siguientes veces, correr `iniciar.bat` de nuevo salta directo al paso 6 (todo lo demas ya quedo instalado).

Cuando termines de usar la app, hace doble clic en `detener.bat`: busca el proceso escuchando en el puerto del servidor (`PORT` en `.env`, `3000` por defecto) y lo cierra. Si lo olvidas, el servidor sigue corriendo minimizado hasta que cierres sesion o reinicies la PC.

`iniciar.bat` / `detener.bat` son especificos de Windows. En Linux/Mac segui los pasos manuales de la seccion siguiente.

## Instalacion desde cero (manual)

Pasos para clonar el repositorio en una maquina nueva y dejarlo funcionando sin usar `iniciar.bat` (por ejemplo, en Linux/Mac, o si preferis entender/controlar cada paso).

### Requisitos previos

| Herramienta | Version minima | Notas |
|---|---|---|
| [Git](https://git-scm.com/) | cualquiera reciente | para clonar el repo |
| [Node.js](https://nodejs.org/) | 18+ (probado con v22) | incluye `npm` |
| [Python](https://www.python.org/) | 3.10+ (probado con 3.11) | usado por el motor de transcripcion |
| [ffmpeg](https://www.gyan.dev/ffmpeg/builds/) | cualquiera reciente | debe incluir `ffprobe` y estar en el `PATH` (probado con el build "essentials" de gyan.dev en Windows) |

Verifica que todo este instalado y en el `PATH` antes de continuar:

```
git --version
node --version
python --version
ffmpeg -version
ffprobe -version
```

### 1. Clonar el repositorio

```
git clone https://github.com/XeanN/Forense-transcripcion.git
cd Forense-transcripcion
```

### 2. Instalar el backend (Node)

```
cd backend
npm install
```

### 3. Crear el entorno virtual de Python e instalar faster-whisper

```
cd python
python -m venv .venv
./.venv/Scripts/pip install -r requirements.txt   # Windows
# source .venv/bin/activate && pip install -r requirements.txt   # Linux/Mac
cd ..
```

Esto queda dentro de `backend/python/.venv` y **no se sube a git** (ver seccion de `.gitignore` mas abajo).

### 4. Crear y completar el `.env`

```
cp .env.example .env
```

(Seguis parado en `backend/`. Si usas PowerShell: `Copy-Item .env.example .env`)

Abre `backend/.env` y completa cada variable:

| Variable | Que es | Como completarla |
|---|---|---|
| `PORT` | Puerto del servidor | `3000` esta bien para uso local |
| `NODE_ENV` | Entorno de ejecucion | `development` en local |
| `JWT_SECRET` | Clave para firmar las sesiones (JWT) | Genera una cadena larga y aleatoria, ej: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `JWT_EXPIRES_IN` | Duracion de la sesion | `8h` es razonable para una jornada de trabajo |
| `ADMIN_USERNAME` | Usuario del admin inicial | El que vas a usar para entrar la primera vez |
| `ADMIN_PASSWORD` | Contrasena del admin inicial | Se usa solo una vez, al correr `npm run seed`. Cambiala despues del primer login |
| `ADMIN_EMAIL` | Correo del admin | Usado para el link de "olvide mi contrasena" del admin |
| `DB_PATH` | Ruta del archivo SQLite | Dejar el default `./src/db/forense.db` |
| `GMAIL_USER` | Cuenta de Gmail que envia los correos de recuperacion | Solo la usa el admin (ver mas abajo como generar el App Password) |
| `GMAIL_APP_PASSWORD` | Contrasena de aplicacion de Gmail (16 caracteres) | Ver instrucciones abajo. **No es tu contrasena normal de Gmail** |
| `FRONTEND_URL` | URL base de la app | `http://localhost:3000` en local |
| `MAX_FILE_SIZE_MB` | Limite de tamano de subida | `2048` (2 GB) por defecto, ajustalo segun tu disco/red |
| `CHUNK_DURATION_MINUTES` | Duracion de cada fragmento para archivos largos | `15` por defecto |
| `PYTHON_BIN` | Ruta al Python del venv que instalaste en el paso 3 | Ya viene apuntando a `./python/.venv/Scripts/python.exe`. En Linux/Mac cambialo a `./python/.venv/bin/python` |
| `WHISPER_MODEL_SIZE` | Tamano del modelo de Whisper | `tiny`, `base`, `small`, `medium` o `large-v3`. `small` es buen balance velocidad/precision en CPU |
| `WHISPER_COMPUTE_TYPE` | Precision numerica de inferencia | `int8` (mas rapido en CPU, recomendado) |
| `WHISPER_LANGUAGE` | Idioma forzado | `es` para espanol (mas rapido y preciso que auto-detectar). Vacio = auto-detectar |
| `HF_HUB_OFFLINE` | Si Whisper puede salir a internet a buscar el modelo | `0` para la primera vez (necesita descargar el modelo). Cambialo a `1` despues de la primera transcripcion exitosa, para que la app nunca vuelva a intentar conectarse a Hugging Face |

#### Como generar un Gmail App Password

Solo hace falta para que el **admin** pueda usar "olvide mi contrasena" (los usuarios normales usan pregunta de seguridad, no correo).

1. Activa la verificacion en dos pasos en la cuenta de Gmail que vas a usar: `https://myaccount.google.com/security`
2. Ve a `https://myaccount.google.com/apppasswords` (requiere tener la verificacion en dos pasos activada)
3. Crea una nueva contrasena de aplicacion (nombre libre, ej. "Forense App")
4. Copia el codigo de 16 caracteres que te muestra Google (sin espacios) y pegalo en `GMAIL_APP_PASSWORD`
5. En `GMAIL_USER` pon la direccion de Gmail completa

### 5. Inicializar la base de datos

Seguis en `backend/`:

```
npm run seed
```

Esto crea `src/db/forense.db` con las tablas `users` y `activity_log`, y el usuario admin definido en `.env`.

### 6. Correr el proyecto

```
npm start
```

El servidor queda en `http://localhost:3000` y sirve tanto la API (`/api/...`) como el frontend:

- Login: `http://localhost:3000/login/index.html`
- Panel admin: `http://localhost:3000/admin-dashboard/index.html` (solo rol admin)
- Panel usuario: `http://localhost:3000/user-dashboard/index.html`

### Nota sobre el modelo de Whisper

La primera vez que alguien transcribe algo, `faster-whisper` descarga el modelo elegido en `WHISPER_MODEL_SIZE` desde Hugging Face (ej. "small" ≈ 500 MB) y lo guarda en cache local (`~/.cache/huggingface/hub`, o `%USERPROFILE%\.cache\huggingface\hub` en Windows). **Requiere internet solo esa primera vez**; las siguientes transcripciones usan el modelo ya cacheado, incluso sin conexion si `HF_HUB_OFFLINE=1`.

---

## Solucion de problemas

### La descarga del modelo de Whisper se cuelga o es muy lenta

En conexiones lentas o inestables, la descarga inicial del modelo (paso "Nota sobre el modelo de Whisper" arriba) puede fallar o parecer trabada. Prueba en este orden:

**1. Reintentar.** Las descargas de Hugging Face retoman donde quedaron; simplemente volver a transcribir suele bastar.

**2. Aumentar el timeout.** Agrega esto a `backend/.env` antes de reintentar:
```
HF_HUB_DOWNLOAD_TIMEOUT=120
```

**3. Descargar con `huggingface-cli`** (incluido en el venv, con barra de progreso y reintentos):
```
cd backend/python
./.venv/Scripts/huggingface-cli download Systran/faster-whisper-small
```
Cambia `faster-whisper-small` si usas otro `WHISPER_MODEL_SIZE` (ej. `faster-whisper-medium`).

**4. Descarga 100% manual** (si lo anterior falla, por ejemplo por un firewall/proxy que bloquea el cliente de Python pero permite el navegador):

   a. Abre `https://huggingface.co/Systran/faster-whisper-small/tree/main` en el navegador (cambia `small` por tu modelo) y descarga cada archivo listado (`config.json`, `model.bin`, `tokenizer.json`, `vocabulary.txt` u otros que aparezcan) a una carpeta temporal.

   b. Obten el commit hash de la rama `main`:
   ```
   git ls-remote https://huggingface.co/Systran/faster-whisper-small main
   ```
   (te devuelve algo como `a1b2c3d4...    refs/heads/main`; el hash es la primera columna)

   c. Crea a mano esta estructura de carpetas dentro de la cache de Hugging Face:
   - Windows: `%USERPROFILE%\.cache\huggingface\hub\models--Systran--faster-whisper-small\`
   - Linux/Mac: `~/.cache/huggingface/hub/models--Systran--faster-whisper-small/`

   ```
   models--Systran--faster-whisper-small/
     refs/
       main              <- archivo de texto plano que contiene SOLO el commit hash, sin salto de linea
     snapshots/
       <commit_hash>/
         config.json
         model.bin
         tokenizer.json
         vocabulary.txt
   ```

   d. Copia ahi los archivos que descargaste en el paso (a), dentro de la carpeta `snapshots/<commit_hash>/`.

   e. Con `HF_HUB_OFFLINE=1` en `.env`, la app usara directamente ese modelo cacheado sin intentar conectarse a internet.

### El servidor no arranca / puerto en uso

Otro proceso ya esta usando el puerto `3000`. Cierra el otro proceso o cambia `PORT` en `.env`.

### ffmpeg / ffprobe no encontrado

Verifica que `ffmpeg -version` y `ffprobe -version` funcionen desde la misma terminal donde corres `npm start`. Si no, revisa que la carpeta `bin` de tu instalacion de ffmpeg este en la variable de entorno `PATH` del sistema (hace falta abrir una terminal nueva despues de agregarla).

---

## Que nunca debe subirse a git

El `.gitignore` del proyecto ya excluye lo siguiente; si alguna vez ves alguno de estos listado en `git status`, no lo agregues:

- `backend/.env` — contiene secretos reales (JWT secret, contrasena del admin, credenciales de Gmail)
- `node_modules/` — se reconstruye con `npm install`
- `backend/python/.venv/` — se reconstruye con los pasos 3 de instalacion
- `backend/temp/*` — archivos temporales de video/audio en procesamiento; por diseno nunca deben persistir
- `*.db` — la base de datos SQLite local (usuarios, log de actividad)

## Correr el proyecto (resumen)

En Windows: doble clic en `iniciar.bat` para iniciar, doble clic en `detener.bat` para detener (ver "Inicio rapido" arriba). Manualmente:

```
cd backend
npm start
```

### Primer login y recuperacion de contrasena (usuarios normales)

1. El admin crea un usuario nuevo desde su panel; recibe una contrasena temporal (`must_change_password = true`).
2. En su primer login, el usuario es forzado a: (1) definir su contrasena definitiva y (2) escribir su propia pregunta de seguridad y respuesta (ej. "¿Nombre de mi primera mascota?"). La respuesta se guarda hasheada con `bcrypt`, igual que la contrasena.
3. Si despues olvida su contrasena, en "¿Olvidaste tu contrasena?" ingresa su usuario, el sistema le muestra **su propia pregunta** (nunca la del admin) y, si la responde correctamente, puede definir una contrasena nueva ahi mismo.
4. Tras 5 respuestas incorrectas, ese flujo se bloquea 15 minutos para ese usuario (para dificultar fuerza bruta). Los intentos, exitos y bloqueos quedan en el log de actividad (nunca la respuesta real).
5. El admin sigue usando exclusivamente la recuperacion por correo (Gmail + App Password), sin pregunta de seguridad.

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

### Concurrencia (varios usuarios subiendo a la vez)

Los jobs se procesan **de a uno**, en orden de llegada, con una cola simple en memoria (un solo worker en `jobManager.js`). Si dos usuarios suben archivos casi al mismo tiempo, el segundo espera en cola mientras se procesa el primero; no se ejecutan transcripciones en paralelo. Cada job tiene su propia carpeta con UUID (`backend/temp/{jobId}/`), asi que los archivos de distintos jobs nunca se mezclan, y la limpieza al terminar solo afecta la carpeta de ese job especifico.

Probado manualmente: video de 1 hora transcrito y descargado sin problemas, y dos videos subidos casi en simultaneo desde dos navegadores distintos — el segundo esperó en cola correctamente, sin cruces de resultados ni archivos huerfanos.

### Integridad forense (cadena de custodia)

Apenas se sube un archivo (antes de procesarlo o borrarlo), el servidor calcula su hash **SHA-256** con el modulo nativo `crypto` de Node. Esto permite demostrar despues que el archivo procesado fue exactamente ese, sin alteraciones, incluso aunque el original ya no exista en el servidor.

- El hash queda guardado en `activity_log` (columna `file_hash`), junto con `started_at`, `completed_at` y `processing_seconds` (tiempo real que tardo el procesamiento, distinto de `duration_seconds` que es la duracion del video/audio en si).
- Al terminar una transcripcion, el hash se muestra en pantalla junto al texto, y tambien queda documentado como pie de pagina en las descargas `.txt` y `.pdf` (con fecha en formato ISO 8601 UTC, sin ambiguedad dia/mes) por si se necesita citar como evidencia.
- En el panel admin, la columna **"Duracion"** del log de actividad muestra el tiempo de procesamiento en formato legible (ej. "10m 32s"); pasa el mouse sobre esa celda para ver el hash SHA-256 completo.

### Log de actividad a prueba de alteraciones (append-only)

El log de actividad esta encadenado con hashes, al estilo de un ledger: cada entrada guarda `previous_hash` (el hash de la entrada anterior) y `entry_hash` (SHA-256 de todos sus propios campos + `previous_hash`). Si alguien con acceso directo a la base de datos edita o borra el contenido de una entrada vieja, el hash de esa entrada deja de coincidir con lo guardado, y se puede detectar.

- Boton **"Verificar integridad del log"** en el panel admin: recorre toda la tabla y confirma si la cadena es consistente. Muestra "✅ Log integro, sin alteraciones detectadas" o, si encuentra un problema, "⚠️ Se detecto una inconsistencia en la entrada #X" indicando exactamente donde se rompio la cadena.
- Las entradas que ya existian antes de esta funcionalidad se incorporan automaticamente a la cadena la primera vez que arranca el servidor con este cambio (backfill retroactivo, se ve en la consola: "se calculo la cadena de integridad retroactiva para N entradas existentes").
- Esto detecta alteraciones del **contenido** de entradas pasadas, pero no reemplaza un backup: no evita que alguien borre la tabla o el archivo de base de datos entero.

### Proteccion contra fuerza bruta

- **Login:** 5 intentos fallidos bloquean esa cuenta especifica por 15 minutos (el mensaje de error indica cuantos intentos quedan, y cuantos minutos falta si ya esta bloqueada). El contador se reinicia solo al iniciar sesion con exito, o automaticamente en el primer intento despues de que el bloqueo anterior expiro. Cada intento fallido y cada bloqueo quedan en el log de actividad (accion `login_failed`), sin guardar la contrasena.
- **Recuperacion de contrasena** (`/api/auth/forgot-password` y `/api/auth/recovery-start`): maximo 5 solicitudes cada 15 minutos por conexion (limite compartido entre ambos endpoints, para que no se pueda evadir alternando entre uno y otro). Pensado para evitar spam de correos y sondeo de usuarios, no para bloquear una cuenta puntual.
- El paso de respuesta a la pregunta de seguridad (`/api/auth/security-answer`) ya tenia su propio limite de 5 intentos / bloqueo de 15 minutos por usuario (ver seccion de primer login mas arriba).

## Notas de seguridad

- Las contrasenas (y las respuestas de seguridad) se almacenan siempre con `bcrypt`, nunca en texto plano.
- El `.env` nunca debe subirse a control de versiones (ya esta en `.gitignore`).
- El log de actividad guarda solo metadata (usuario, accion, nombre de archivo, tipo, duracion, hash SHA-256, tiempos de procesamiento, fecha); nunca contenido de archivos, transcripciones ni respuestas de seguridad.
- Todas las rutas de admin, subida y procesamiento estan protegidas con JWT, y cada job solo es accesible por el usuario que lo creo.
- Los logs del servidor solo imprimen eventos (ej. "Job X completado"), nunca el contenido de una transcripcion.
