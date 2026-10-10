# Deploy paso a paso (Windows 10)

Cómo poner El Gran Negocio en internet: la **web en Vercel** y el **server de juego en Render**
(plan gratis, con un Blueprint). Sin cuentas de usuario todavía (Supabase queda para otro hito).

Si querés que las partidas sobrevivan a reinicios y que el server no se duerma, al final está la
**alternativa de pago con Fly.io** (`fly.toml`).

Tiempo estimado: media hora la primera vez.

## Qué va dónde, y por qué

```
  Navegador ──HTTPS──▶  Vercel   (apps/web: archivos estáticos de Vite)
      │
      └──WebSocket──▶  Render   (apps/server: Express + Socket.IO, plan gratis)
                          └── /tmp/argentum.db  (SQLite, se borra al reiniciar)
```

- **La web es estática** (HTML, JS, CSS): Vercel la sirve desde su CDN.
- **El server no puede ir en Vercel**: Socket.IO necesita conexiones largas (WebSocket) y un
  proceso que viva siempre, con las salas en memoria. Vercel corre funciones que nacen y mueren
  por pedido. Render corre el contenedor de `apps/server/Dockerfile` como un servicio web.

Archivos que intervienen (ya están en el repo):

| Archivo                  | Para qué                                                                         |
| ------------------------ | -------------------------------------------------------------------------------- |
| `render.yaml`            | Blueprint de Render: servicio, plan gratis, Dockerfile, health check, variables. |
| `apps/server/Dockerfile` | Imagen del server (Node 24.13.0, `NODE_ENV=production`).                         |
| `apps/web/vercel.json`   | Build de la web y la reescritura de `/sala/:codigo` a `index.html`.              |
| `.env.example`           | Todas las variables de entorno, explicadas.                                      |
| `fly.toml`               | Solo para la alternativa de pago (Fly.io con disco).                             |

### Qué implica el plan gratis de Render

| Qué pasa                                           | Consecuencia para el juego                                                                                                                    |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **Se duerme a los 15 minutos sin tráfico**         | Una partida con jugadores conectados lo mantiene despierto: un WebSocket abierto cuenta como tráfico.                                         |
| **Tarda cerca de un minuto en despertar**          | Quien entra con el server dormido ve "Conectando…". La primera acción puede fallar: esperá un minuto y reintentá.                             |
| **No hay disco persistente**: la base va en `/tmp` | **Las salas se pierden** si el server se reinicia, se redespliega (cada push a `main`) o se duerme. El server lo avisa en el log al arrancar. |
| 750 horas gratis por mes y por workspace           | Alcanza para un servicio prendido todo el mes. Las horas dormido no cuentan.                                                                  |

Sin "keep-alive" a propósito: hacer ping para que no se duerma gasta las horas gratis y va
contra el espíritu del plan.

## 0. Antes de empezar

1. **El código tiene que estar en GitHub**: Render y Vercel despliegan desde ahí. Desde la
   carpeta del proyecto:

   ```powershell
   git push origin main --tags
   ```

2. **Cuentas** (en las dos conviene entrar con GitHub):
   - [render.com](https://render.com): el plan gratis no pide tarjeta;
   - [vercel.com](https://vercel.com).

3. **Los nombres** definen las URLs:

   | Qué                      | En el repo                        | URL que resulta                     |
   | ------------------------ | --------------------------------- | ----------------------------------- |
   | Servicio de Render       | `name: argentum` en `render.yaml` | `https://argentum.onrender.com`     |
   | Proyecto de Vercel (web) | se elige al importar              | `https://argentum-lemon.vercel.app` |

   Si el nombre de Render ya está tomado, Render le agrega un sufijo. **La URL real es la que
   muestra el panel del servicio**: usá esa en el paso 2.

## 1. Herramientas (Windows 10)

Render y Vercel se manejan desde el navegador: **no hace falta instalar nada para desplegar**.

Solo si querés correr el proyecto en tu PC (o usar la CLI de Vercel):

1. Abrí **PowerShell**: menú Inicio, escribí "PowerShell" y Enter. Para "como administrador",
   hacé clic derecho y elegí "Ejecutar como administrador".
2. Instalá Node 24 LTS desde [nodejs.org](https://nodejs.org) (el instalador `.msi`), o con
   winget:

   ```powershell
   winget install OpenJS.NodeJS.LTS
   ```

   `winget` viene con el "Instalador de aplicación" de la Microsoft Store. En Windows 10 viejos
   puede faltar: en ese caso usá el `.msi`.

3. En una PowerShell **como administrador**, activá pnpm: `corepack enable`.
4. Cerrá y volvé a abrir PowerShell, y verificá con `node --version` (`v24.x`) y
   `pnpm --version`.

**CLI de Vercel** (opcional; el paso 3A no la usa):

```powershell
npm i -g vercel
vercel --version
```

Si PowerShell dice que **"la ejecución de scripts está deshabilitada"**, habilitalos para tu
usuario (una sola vez):

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

## 2. Server de juego en Render (Blueprint)

1. **Revisá `render.yaml`** antes de subirlo:
   - `WEB_ORIGIN` → la URL de tu web en Vercel, **exacta y sin barra final**. Si todavía no la
     sabés, poné la que vas a pedir y corregila en el paso 4.
   - `name` → el nombre del servicio (define la URL).
   - `region` → `virginia`. Elegí antes de crear el servicio: después no se puede cambiar.
     Render no tiene región en Sudamérica.

   Si cambiaste algo, commiteá y hacé push.

2. En el [panel de Render](https://dashboard.render.com): **New → Blueprint**.
3. **Connect** al lado del repositorio. Si es la primera vez, Render pide permiso para leer tus
   repos de GitHub.
4. Poné un nombre al Blueprint (por ejemplo, `argentum`) y elegí la rama **`main`**. El archivo
   está en la raíz, así que **Blueprint Path** queda vacío (`render.yaml`).
5. Render muestra lo que va a crear: **un servicio web `argentum`, Docker, plan Free**. Si
   muestra errores del archivo, revisalos antes de seguir.
6. **Deploy Blueprint**. El primer build tarda unos minutos: construye la imagen de
   `apps/server/Dockerfile`.
7. Cuando el servicio diga **Live**, abrí en el navegador:

   ```
   https://argentum.onrender.com/health
   ```

   Tiene que mostrar `{"ok":true,...,"rooms":0}`.

En **Logs** vas a ver este aviso al arrancar. **Es esperado** en el plan gratis:

```
AVISO: DB_PATH=/tmp/argentum.db está en un directorio temporal. Las salas NO sobreviven a un reinicio, ...
```

> Los valores de `render.yaml` mandan: si cambiás una variable en el panel y después hacés push
> de un `render.yaml` distinto, Render la pisa con la del archivo. Cambialas en el archivo.

## 3. Web en Vercel

### 3A. Desde el panel (recomendado)

1. En [vercel.com/new](https://vercel.com/new), **importá el repositorio** de GitHub.
2. **Project Name**: el nombre de tu proyecto. Define `https://<nombre>.vercel.app`.
3. **Root Directory** → **Edit** → elegí **`apps/web`**. Es clave: ahí está `vercel.json`, con
   el build y las reescrituras. Si queda en la raíz, el build falla, o `/sala/...` da 404.
4. **Framework**: Vite (lo detecta solo). Build, Output e Install salen de `vercel.json`: no
   los cambies.
5. **Environment Variables**: agregá
   - **Name**: `VITE_SERVER_URL`
   - **Value**: `https://argentum.onrender.com` (la URL de tu servicio de Render, sin barra
     final)
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

El primer comando pide el valor: `https://argentum.onrender.com`.

> Vite **mete `VITE_SERVER_URL` adentro del JavaScript al buildear**. Si la cambiás, hay que
> volver a desplegar la web (Deployments → ⋯ → Redeploy).

## 4. Conectar las dos puntas

El server solo acepta conexiones de la URL que dice `WEB_ORIGIN`: CORS más el filtro del
handshake del socket. Si la URL final de Vercel no es la que pusiste en `render.yaml`:

1. Cambiá `WEB_ORIGIN` en `render.yaml`. Para varias (por ejemplo, un dominio propio),
   separalas con coma:
   `https://argentum-lemon.vercel.app,https://www.tudominio.com.ar`.
2. Commit y push: Render sincroniza el Blueprint y redespliega solo.

Los **deploys de vista previa** de Vercel (`argentum-git-rama-usuario.vercel.app`) tienen otra
URL y el server los rechaza a propósito. Para probar uno, sumá su URL a `WEB_ORIGIN`.

## 5. Probar que anda

1. Si el server estuvo un rato sin uso, **despertalo**: abrí `https://argentum.onrender.com/health`
   y esperá a que responda (hasta un minuto).
2. Abrí la web, poné un nombre y **Crear partida**.
3. Abrí el link de la sala en el celular, con datos móviles (no el wifi de tu casa): tiene que
   abrir directo en "Te invitaron a la sala…". Eso prueba la reescritura de `/sala/:codigo`.
4. Sumá un bot, empezá y jugá un par de turnos.
5. Recargá la página en medio de la partida: tiene que volver a la partida, porque el server
   sigue despierto.

## 6. Actualizar

- **Web**: cada `git push` a `main` la vuelve a desplegar sola.
- **Server**: cada `git push` a `main` también lo redespliega (`autoDeployTrigger: commit`).
  En el plan gratis, **eso borra las salas en curso**. Si hay gente jugando, esperá a que
  terminen para hacer push, o desactivá el auto-deploy en el panel del servicio y desplegá a
  mano (Manual Deploy).

## Problemas comunes

| Síntoma                                                   | Causa probable y arreglo                                                                                                                                                                            |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| La web dice que no se puede conectar al server            | El server está dormido (esperá un minuto y reintentá). O `WEB_ORIGIN` no coincide **exacto** con la URL de la web: `https`, sin barra final, mismo subdominio. O falta `VITE_SERVER_URL` en Vercel. |
| El Blueprint falla en el build con "Dockerfile not found" | `dockerfilePath` tiene que ser `./apps/server/Dockerfile` y `dockerContext` `.` (la raíz). Hay un test que lo controla.                                                                             |
| `/sala/ABC234` da 404 en Vercel                           | El Root Directory del proyecto no es `apps/web`, así que no se leyó `vercel.json`.                                                                                                                  |
| El build de Vercel falla instalando dependencias          | Mismo motivo (Root Directory), o el `pnpm-lock.yaml` no está commiteado.                                                                                                                            |
| Las salas desaparecieron                                  | En el plan gratis es esperado después de un reinicio, un deploy o de dormirse (ver el aviso en Logs). Para conservarlas: la alternativa de pago.                                                    |
| Cambié una variable en el panel de Render y volvió atrás  | El Blueprint la pisó con la de `render.yaml`: cambiala en el archivo.                                                                                                                               |
| `/dev/scenario/...` responde algo que no es 404           | No debería pasar nunca: `render.yaml` y el Dockerfile fijan `NODE_ENV=production` (hay un test que lo controla).                                                                                    |

## Alternativa de pago: Fly.io con disco persistente

Con Fly.io el server queda **siempre prendido** y la base vive en un **volumen**: las partidas
sobreviven a reinicios y deploys, y se restauran solas. Pide tarjeta. `fly.toml` (en la raíz)
ya está listo:

- región `gru` (São Paulo);
- una sola máquina;
- volumen en `/data`;
- health check en `/health`.

1. **Instalá flyctl** en PowerShell:

   ```powershell
   pwsh -Command "iwr https://fly.io/install.ps1 -useb | iex"
   ```

   Si `pwsh` no existe (Windows 10 trae la PowerShell vieja), usá `powershell` en su lugar.
   Cerrá y volvé a abrir PowerShell, y verificá con `fly version`. **No hace falta Docker en tu
   PC**: Fly construye la imagen en sus servidores.

2. En `fly.toml`, cambiá `app` (define `https://<app>.fly.dev`) y `WEB_ORIGIN`.
3. Desde la raíz del proyecto:

   ```powershell
   fly auth login
   fly apps create gran-negocio-server
   fly volumes create gran_negocio_data --region gru --size 1 -a gran-negocio-server
   fly deploy
   fly scale count 1 -a gran-negocio-server
   Invoke-RestMethod https://gran-negocio-server.fly.dev/health
   ```

   Fly avisa que un solo volumen no tiene réplica: respondé que sí, es lo esperado. Con una sola
   máquina, cada jugador cae siempre en el mismo proceso; con dos, una misma sala podría
   repartirse entre máquinas distintas.

4. En Vercel, `VITE_SERVER_URL` = `https://gran-negocio-server.fly.dev`, y Redeploy.
5. Backup de las partidas:

   ```powershell
   fly ssh sftp get /data/gran-negocio.db .\backup-gran-negocio.db -a gran-negocio-server
   ```

Con la base en `/data` el server **no** muestra el aviso de salas efímeras. Si conviene apagar
el servicio de Render, borralo desde su panel.

## Qué se verificó y qué no

**Verificado en local, sin desplegar** (no hay credenciales de Render, Fly ni Vercel):

- **El contenedor como lo corre Render**:
  - con `PORT=10000` escucha en ese puerto, en todas las interfaces;
  - con `DB_PATH=/tmp/argentum.db` arranca y loguea el aviso;
  - `/health` responde;
  - CORS y el socket aceptan solo `WEB_ORIGIN`;
  - un contenedor nuevo (lo que hace un redeploy) arranca con 0 salas.
- **El contenedor con volumen** (Fly):
  - una partida sobrevive un reinicio y se retoma con el token;
  - SIGTERM cierra ordenado;
  - `fly.toml` pasa `fly config validate`.
- **El build de Vercel**, simulado sobre una copia limpia, y la web de producción contra el
  contenedor con Playwright:
  - deep link a `/sala/CÓDIGO` desde un Pixel 7 emulado;
  - recarga en medio de la partida;
  - cero errores de consola.
- **`apps/server/test/deploy.test.ts`** mantiene coherentes `render.yaml`, `fly.toml`, el
  Dockerfile, `vercel.json`, `.env.example` y el código:
  - ruta y nombre del Dockerfile;
  - `DB_PATH` (el nombre que lee el server);
  - `NODE_ENV`;
  - versión de Node;
  - puerto;
  - variables documentadas.

**No verificado**:

- El deploy real en Render, Vercel o Fly.
- La lectura del Blueprint por parte de Render: los campos salen de su documentación de octubre
  de 2026.
- La reescritura de Vercel en su plataforma: se probó lo mismo con `vite preview`.
- Los pasos en un Windows 10 real.
