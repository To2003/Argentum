# Deploy paso a paso (Windows 10)

Cómo poner El Gran Negocio en internet: la **web en Vercel** y el **server de juego en Fly.io**.
Sin cuentas de usuario todavía (Supabase queda para otro hito).

Tiempo estimado: una hora la primera vez.

## Qué va dónde, y por qué

```
  Navegador ──HTTPS──▶  Vercel   (apps/web: archivos estáticos de Vite)
      │
      └──WebSocket──▶  Fly.io   (apps/server: Express + Socket.IO, 1 máquina)
                          └── volumen /data  (SQLite: seed + acciones de cada partida)
```

- **La web es estática** (HTML, JS, CSS): Vercel la sirve desde su CDN.
- **El server no puede ir en Vercel**: Socket.IO necesita conexiones largas (WebSocket) y un
  proceso que viva siempre, con las salas en memoria. Vercel corre funciones que nacen y mueren
  por pedido. Fly.io corre el contenedor de `apps/server/Dockerfile` como una máquina
  permanente.
- **Una sola máquina**: las salas viven en la memoria del proceso y en su volumen. Con dos
  máquinas, cada jugador podría caer en una distinta. `fly.toml` deja una sola, siempre prendida.

Archivos que intervienen (ya están en el repo):

| Archivo                  | Para qué                                                                     |
| ------------------------ | ---------------------------------------------------------------------------- |
| `fly.toml`               | App, región, variables, puerto, health check, volumen, tamaño de la máquina. |
| `apps/server/Dockerfile` | Imagen del server (Node 24.13.0, `NODE_ENV=production`).                     |
| `apps/web/vercel.json`   | Build de la web y la reescritura de `/sala/:codigo` a `index.html`.          |
| `.env.example`           | Todas las variables de entorno, explicadas.                                  |

## 0. Antes de empezar

1. **El código tiene que estar en GitHub** (Vercel lo despliega desde ahí). Desde la carpeta del
   proyecto:

   ```powershell
   git push origin main --tags
   ```

2. **Cuentas**:
   - [fly.io](https://fly.io): pide una tarjeta aunque uses poco.
   - [vercel.com](https://vercel.com): conviene entrar con la cuenta de GitHub.

3. **Elegí los dos nombres**. Definen las URLs y hay que escribirlos en la configuración:

   | Qué                      | Ejemplo               | URL que resulta                       |
   | ------------------------ | --------------------- | ------------------------------------- |
   | App de Fly (server)      | `gran-negocio-server` | `https://gran-negocio-server.fly.dev` |
   | Proyecto de Vercel (web) | `gran-negocio`        | `https://gran-negocio.vercel.app`     |

   Los nombres son únicos en todo Fly y en todo Vercel. Si alguno está tomado, elegí otro y
   usalo igual en todos los pasos.

## 1. Instalar las herramientas (Windows 10)

Abrí **PowerShell**: menú Inicio, escribí "PowerShell" y Enter. Cuando dice "como
administrador", hacé clic derecho y elegí "Ejecutar como administrador".

### Node 24 y pnpm

Si ya corrés el proyecto en tu máquina, esto ya lo tenés: verificalo con `node --version`
(tiene que decir `v24.x`) y `pnpm --version`.

Si no:

1. Instalá Node 24 LTS desde [nodejs.org](https://nodejs.org) (el instalador `.msi`), o con
   winget:

   ```powershell
   winget install OpenJS.NodeJS.LTS
   ```

   `winget` viene con el "Instalador de aplicación" de la Microsoft Store. En Windows 10 viejos
   puede faltar: en ese caso usá el `.msi`.

2. En una PowerShell **como administrador**, activá pnpm:

   ```powershell
   corepack enable
   ```

3. Cerrá y volvé a abrir PowerShell.

### flyctl (la CLI de Fly)

```powershell
pwsh -Command "iwr https://fly.io/install.ps1 -useb | iex"
```

Si dice que `pwsh` no existe (Windows 10 trae la PowerShell vieja), usá el mismo comando con
`powershell`:

```powershell
powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"
```

Cerrá y volvé a abrir PowerShell, y verificá con `fly version`.

**No hace falta Docker en tu PC**: `fly deploy` construye la imagen en los servidores de Fly.

### Vercel CLI (opcional)

El camino recomendado (paso 3A) es el panel web de Vercel, sin CLI. Si preferís la terminal:

```powershell
npm i -g vercel
vercel --version
```

Si PowerShell dice que **"la ejecución de scripts está deshabilitada"** al correr `vercel`,
habilitá los scripts locales para tu usuario (una sola vez):

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

## 2. Server de juego en Fly.io

Todo desde la **carpeta raíz del proyecto**, donde está `fly.toml`.

1. **Editá `fly.toml`**:
   - `app = "gran-negocio-server"` → tu nombre de app de Fly.
   - `WEB_ORIGIN = "https://gran-negocio.vercel.app"` → la URL de tu web en Vercel, **exacta y
     sin barra final**. Si todavía no la sabés, poné la que vas a pedir y corregila en el paso 4.

2. **Iniciá sesión** (abre el navegador):

   ```powershell
   fly auth login
   ```

3. **Creá la app**:

   ```powershell
   fly apps create gran-negocio-server
   ```

4. **Creá el volumen donde se guardan las partidas**: 1 GB sobra, en la misma región que
   `fly.toml`. Fly avisa que un solo volumen no tiene réplica: respondé que sí, es lo esperado.

   ```powershell
   fly volumes create gran_negocio_data --region gru --size 1 -a gran-negocio-server
   ```

5. **Desplegá**:

   ```powershell
   fly deploy
   ```

   La primera vez tarda unos minutos (construye la imagen). Al final muestra la URL.

6. **Dejá una sola máquina** (Fly a veces crea dos para alta disponibilidad, y acá no sirve):

   ```powershell
   fly scale count 1 -a gran-negocio-server
   ```

7. **Verificá**:

   ```powershell
   Invoke-RestMethod https://gran-negocio-server.fly.dev/health
   ```

   Tiene que responder `ok: True` y `rooms: 0`. Para ver qué pasa adentro: `fly logs`.

## 3. Web en Vercel

### 3A. Desde el panel (recomendado)

1. En [vercel.com/new](https://vercel.com/new), **importá el repositorio** de GitHub.
2. **Project Name**: tu nombre de proyecto (`gran-negocio`).
3. **Root Directory** → **Edit** → elegí **`apps/web`**. Es clave: ahí está `vercel.json`, con
   el build y las reescrituras. Si queda en la raíz, el build falla, o `/sala/...` da 404.
4. **Framework**: Vite (lo detecta solo). Build, Output e Install salen de `vercel.json`: no
   los cambies.
5. **Environment Variables**: agregá
   - **Name**: `VITE_SERVER_URL`
   - **Value**: `https://gran-negocio-server.fly.dev` (tu app de Fly, sin barra final)
6. **Deploy**.

### 3B. Desde la terminal (alternativa)

Desde la **raíz del proyecto**, no desde `apps/web`:

```powershell
vercel login
vercel link
```

`vercel link` pregunta si querés crear un proyecto nuevo y **en qué carpeta está el código**:
respondé `apps/web`. Si no lo pregunta, configurá **Root Directory = `apps/web`** en el panel
(Settings → Build and Deployment).

Después:

```powershell
vercel env add VITE_SERVER_URL production
vercel --prod
```

El primer comando pide el valor: `https://gran-negocio-server.fly.dev`.

> Vite **mete `VITE_SERVER_URL` adentro del JavaScript al buildear**. Si la cambiás, hay que
> volver a desplegar la web (Deployments → ⋯ → Redeploy).

## 4. Conectar las dos puntas

El server solo acepta conexiones de la URL que dice `WEB_ORIGIN`: CORS más el filtro del
handshake del socket. Si la URL final de Vercel no es la que pusiste en el paso 2:

1. En `fly.toml`, cambiá `WEB_ORIGIN` por la URL real. Para varias (por ejemplo, un dominio
   propio), separalas con coma:
   `"https://gran-negocio.vercel.app,https://www.tudominio.com.ar"`.
2. Volvé a desplegar el server:

   ```powershell
   fly deploy
   ```

Los **deploys de vista previa** de Vercel (`gran-negocio-git-rama-usuario.vercel.app`) tienen
otra URL y el server los rechaza a propósito. Para probar uno, sumá su URL a `WEB_ORIGIN`.

## 5. Probar que anda

1. Abrí `https://gran-negocio.vercel.app`, poné un nombre y **Crear partida**.
2. Abrí el link de la sala en el celular, con datos móviles (no el wifi de tu casa): tiene que
   abrir directo en "Te invitaron a la sala…". Eso prueba la reescritura de `/sala/:codigo`.
3. Sumá un bot, empezá y jugá un par de turnos.
4. Recargá la página en medio de la partida: tiene que volver a la partida.
5. Opcional: `fly apps restart gran-negocio-server` y recargá. La partida sigue, porque se
   restaura del volumen.

## 6. Actualizar

- **Web**: cada `git push` a `main` la vuelve a desplegar sola (Vercel está conectado a GitHub).
- **Server**: desde la raíz, `fly deploy`. Mientras se reemplaza la máquina hay unos segundos
  sin server. Los jugadores ven "Reconectando…" y vuelven solos a su partida, que se restaura de
  SQLite.

## 7. Backup de las partidas

```powershell
fly ssh sftp get /data/gran-negocio.db .\backup-gran-negocio.db -a gran-negocio-server
```

## Problemas comunes

| Síntoma                                                   | Causa probable y arreglo                                                                                                                                                      |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| La web carga pero dice que no se puede conectar al server | `WEB_ORIGIN` no coincide **exacto** con la URL de la web: `https`, sin barra final, mismo subdominio. Corregí `fly.toml` y `fly deploy`. O falta `VITE_SERVER_URL` en Vercel. |
| `/sala/ABC234` da 404 en Vercel                           | El Root Directory del proyecto no es `apps/web`, así que no se leyó `vercel.json`.                                                                                            |
| El build de Vercel falla instalando dependencias          | Mismo motivo (Root Directory), o el `pnpm-lock.yaml` no está commiteado.                                                                                                      |
| Después de un deploy del server se perdieron las partidas | El volumen no está montado: `fly volumes list` tiene que mostrar `gran_negocio_data` adjunto a la máquina, en la misma región que `fly.toml`.                                 |
| `fly deploy` dice que no hay volumen en la región         | El volumen se creó en otra región: creálo en `gru` (o cambiá `primary_region`).                                                                                               |
| Hay dos máquinas (`fly status`)                           | `fly scale count 1`. Con dos, los jugadores de una misma sala pueden caer en máquinas distintas.                                                                              |
| `/dev/scenario/...` responde algo que no es 404           | No debería pasar nunca: `fly.toml` y el Dockerfile fijan `NODE_ENV=production`. Revisá que nadie lo haya sacado (hay un test que lo controla).                                |

## Qué se verificó y qué no

**Verificado en local, sin desplegar** (no hay credenciales de Fly ni de Vercel):

- `fly.toml` pasa `fly config validate`.
- La imagen de `apps/server/Dockerfile` construye y corre:
  - `/health` responde, y el health check de Docker da `healthy`;
  - `/dev/*` da 404;
  - CORS y el socket aceptan solo `WEB_ORIGIN`;
  - una partida sobrevive un reinicio con el volumen;
  - SIGTERM cierra ordenado y sale con 0.
- El build de Vercel, simulado sobre un clon limpio: el `installCommand` filtrado de
  `vercel.json` y `pnpm build`, con `VITE_SERVER_URL` embebida.
- La web de producción contra el contenedor de producción, con Playwright:
  - deep link a `/sala/CÓDIGO` desde un Pixel 7 emulado;
  - partida arrancada en los dos navegadores;
  - recarga en medio de la partida;
  - cero errores de consola.
- `apps/server/test/deploy.test.ts` mantiene coherentes `fly.toml`, el Dockerfile,
  `vercel.json`, `.env.example` y el código: puerto, ruta de la base dentro del volumen,
  `NODE_ENV`, versión de Node y variables documentadas.

**No verificado**:

- El deploy real en Fly y Vercel.
- La reescritura de Vercel en su plataforma (en local se probó con `vite preview`, que hace lo
  mismo; la sintaxis sale de la documentación de Vercel).
- Los comandos en un Windows 10 real: se escribieron con la documentación oficial de Fly y de
  Vercel de octubre de 2026.
