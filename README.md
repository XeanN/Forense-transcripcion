# Herramienta Forense de Transcripcion

Aplicacion web local para transcribir videos/audios de interrogatorios, con enfoque en privacidad: ningun archivo ni transcripcion se guarda permanentemente en el servidor.

## Estado actual

Implementado:
- Autenticacion (login, JWT, recuperacion de contrasena por correo)
- Panel de administracion (crear/listar/revocar usuarios, log de actividad)
- Panel de usuario (base, sin subida de archivos todavia)

Pendiente (siguiente paso):
- Subida de video/audio
- Division en chunks con ffmpeg
- Transcripcion con faster-whisper
- Borrado automatico de archivos temporales
- Descarga de transcripcion en .txt / .pdf

## Requisitos previos

- Node.js 18+ (probado con v22)
- Python 3.10+ (probado con 3.11) con `faster-whisper` (se instalara en el siguiente paso)
- ffmpeg instalado y disponible en el PATH
- Cuenta de Gmail con una **App Password** (no la contrasena normal) si se quiere usar la recuperacion de contrasena por correo

## Configuracion

1. Entrar a `backend/` y copiar el archivo de variables de entorno:

   ```
   cd backend
   cp .env.example .env
   ```

2. Editar `.env` y completar al menos:
   - `JWT_SECRET`: una cadena larga y aleatoria
   - `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_EMAIL`: credenciales del usuario admin inicial
   - `GMAIL_USER`, `GMAIL_APP_PASSWORD`: solo si se va a usar "olvide mi contrasena"

3. Instalar dependencias e inicializar la base de datos:

   ```
   npm install
   npm run seed
   ```

   Esto crea la base SQLite (`src/db/forense.db`) con las tablas `users` y `activity_log`, y el usuario admin definido en `.env`.

## Correr el proyecto

```
cd backend
npm start
```

El servidor queda disponible en `http://localhost:3000` y sirve tanto la API (`/api/...`) como el frontend estatico.

- Login: `http://localhost:3000/login/index.html`
- Panel admin: `http://localhost:3000/admin-dashboard/index.html` (solo rol admin)
- Panel usuario: `http://localhost:3000/user-dashboard/index.html`

## Notas de seguridad

- Las contrasenas se almacenan siempre con `bcrypt`, nunca en texto plano.
- El `.env` nunca debe subirse a control de versiones (ya esta en `.gitignore`).
- El log de actividad guarda solo metadata (usuario, accion, nombre de archivo, fecha); nunca contenido de archivos ni transcripciones.
- Todas las rutas de admin y las futuras rutas de subida/transcripcion estan protegidas con JWT.
