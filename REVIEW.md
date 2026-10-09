# REVIEW — trabajo en modo autónomo (M3 → M9)

Registro para revisión humana. Cada decisión tomada sin consultar tiene: hito, duda, qué se
eligió, por qué y cómo revertirla. Criterio: reglamento oficial de Monopoly; si no alcanza, el
default más conservador y simple.

## Lo primero que tiene que revisar el humano

1. **Hacer push y mirar el CI.** Desde M3 nada pasó por GitHub: el entorno no tiene
   credenciales. Hay **unos 70 commits locales** sin publicar, con los tags `m3-done` …
   `m9-done`. Cada hito se verificó sobre un clon limpio en Linux (install, typecheck, lint,
   format, cobertura, build, e2e), pero **nunca en Windows**: la matriz del CI es lo primero
   que lo va a probar. Comando: `git push origin main --tags`.
2. **ADR 0007: no se usaron Framer Motion, React Three Fiber + Rapier ni Howler**, que nombra
   el SPEC. En su lugar: CSS, dados en CSS 3D y audio sintetizado con Web Audio. Es la decisión
   que más se aparta del SPEC. Se justificó por peso (~250 kB de JS + ~1,5 MB de wasm) y por los
   60 fps en gama media.
3. **Reglas decididas sin consultar (M3, tabla "Decisiones de reglas")**. Las que más cambian
   la partida:
   - recibir una hipotecada siempre cobra el 10 %;
   - solo se subasta la **última** casa u hotel;
   - un trueque nunca puede dejar a nadie en deuda;
   - lo que se le debía a un quebrado va al banco.
4. **Cómo juega el piloto automático (M4)**: por timeout rechaza las compras; si estás
   desconectado, compra solo si te quedan $500.
5. **Balance (M8, `docs/balance-report.md`)**:
   - en partidas de 4 bots, el 81 % llega al tope de turnos;
   - los subtes rinden más que los grupos de color.

   Hay ajustes propuestos, **no activados**.

6. **Probar a mano lo que no se pudo verificar acá**:
   - un celular real y Safari/iOS (solo hubo emulación Pixel 7 en Chromium);
   - cómo suena el audio;
   - un lector de pantalla real (NVDA, VoiceOver o TalkBack).
7. **El chat no se guarda**: un reinicio del server lo pierde (M9). No hay moderación más allá
   del límite de largo y del rate limit.
8. **La estética de las ilustraciones** (SVG propios, `assets/README.md`) y los textos con humor
   rioplatense (cartas, reacciones del chat): conviene que los lea alguien de acá.

### Cómo jugar una partida de 4 en tu compu

```sh
pnpm install
pnpm dev            # web en http://localhost:5173, server en :3001
```

- **Cuatro personas**: abrí `http://localhost:5173` y creá la sala. Mandá el link
  `/sala/CÓDIGO` a otras tres ventanas: un navegador distinto, una ventana de incógnito y un
  perfil nuevo. Cada ventana guarda su propia sesión, así que dos pestañas normales del mismo
  navegador cuentan como el mismo jugador. Todos eligen ficha y se marcan "Listo", y el host
  aprieta "Empezar la partida".
- **Desde otros dispositivos de tu red** (celulares en el mismo wifi): en vez de `pnpm dev`,
  levantá cada parte en su terminal, con la IP de tu PC:

  ```sh
  WEB_ORIGIN=http://IP-DE-TU-PC:5173 pnpm --filter @gran-negocio/server dev
  pnpm --filter @gran-negocio/web dev --host
  ```

  y abrí `http://IP-DE-TU-PC:5173` en cada dispositivo. _No lo probé con dispositivos reales;
  puede hacer falta abrir los puertos 5173 y 3001 en el firewall de Windows._

- **Vos contra tres bots**: creá la sala, apretá "Sumar un bot" tres veces (Fácil, Medio o
  Difícil) y empezá.
- **Mirar sin jugar**: en otra ventana, abrí el link de la sala y apretá "Mirar la partida".

---

## M3 — Engine avanzado

### Cambios a tests de hitos anteriores (justificados)

| Test                                                                        | Cambio                                                                             | Por qué                                                                                                                                                                           |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `engine/test/debt.test.ts`, `jail.test.ts`, `validate.test.ts`              | `gameOver` ahora incluye `reason`                                                  | §5.8: la partida puede terminar por último en pie, rondas o tiempo; la fase y el evento dicen por qué.                                                                            |
| `engine/test/turn.test.ts` (tres dobles), `jail.test.ts` (salir con dobles) | se apaga `auctionOnDecline` en ese test                                            | M3 enchufa la subasta al rechazar (SPEC §5.2). Esos tests son sobre dobles y cárcel; con la regla apagada siguen probando exactamente lo mismo.                                   |
| `engine/test/turn.test.ts` "rechazar deja la propiedad sin dueño…"          | renombrado a "sin auctionOnDecline, …" y con la regla apagada                      | Era el comportamiento provisorio de M2 (`TODO(M3)`); ahora es el de la sala sin subasta. La subasta tiene su propio test.                                                         |
| `engine/test/debt.test.ts` quiebra ante el banco                            | ahora espera la subasta de las propiedades (una por una) antes del turno siguiente | SPEC §5.7: "se subastan una por una" (era `TODO(M3)`).                                                                                                                            |
| `engine/test/debt.test.ts` "el quebrado no vuelve a jugar"                  | `auctionOnDecline: false`                                                          | El test es sobre el orden de turno, no sobre la subasta.                                                                                                                          |
| `engine/test/invariants.ts`                                                 | sale la invariante "en `inDebt` el deudor tiene menos efectivo que la deuda"       | En M3 el deudor puede juntar plata (vender, hipotecar, trueque) antes de pagar con `payDebt`: es normal tener la plata y todavía no haber pagado. Queda "toda deuda es positiva". |
| `engine/test/invariants.ts`                                                 | `actorOf` → `actorsOf`; "≤ 32/12" → "exactamente 32/12"                            | En una subasta pujan varios a la vez. El banco y el tablero ahora se reparten exactamente los edificios (la invariante se endurece).                                              |

### Qué quedó hecho

- Subasta (`auction`, fase con `returnTo`) enchufada en `onPurchaseDeclined()`, y también para la quiebra ante el banco (una por una) y para la última casa/hotel.
- Construcción pareja con escasez real (32/12), hotel que devuelve 4 casas, venta pareja, `sellAllBuildings`.
- Hipotecas y levantamiento con `mortgageLiftCost`; recibir hipotecadas cobra el 10 %.
- Trueques completos (estado superpuesto `state.trade`): proponer, contraofertar, aceptar, rechazar, cancelar.
- Deuda completa: juntar plata (vender, hipotecar, trueque) y `payDebt`; quiebra ante jugador o banco.
- Fin de partida por último en pie, por rondas (`maxRounds`) y por tiempo (`timeUp` del actor `system`), con patrimonio neto y desempate.
- `legalActions` con parámetros; `actorsOf` para saber quién puede actuar (lo usan el fuzz, el hot-seat y lo va a usar el server para los timers).
- Fuzz ampliado: dos escenarios (partida desde cero y partida avanzada con grupos completos y escasez de casas) con invariantes de construcción pareja, 32/12 exactos, hipotecas coherentes, trueque y subasta coherentes.

### Decisiones de reglas (M3)

| Duda                                                                   | Qué elegí                                                                                                    | Por qué                                                                                                                   | Cómo revertirlo                                                |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| ¿Cómo se cierra una subasta sin reloj en el engine?                    | Cierra cuando todos los demás pasan; el server pasa por los que no van ganando al vencer `auctionBidSeconds` | El engine es puro y sin tiempo; el timer es del server (como el del turno)                                                | Agregar una acción `closeAuction` del actor `system`           |
| Quiebra ante el banco del jugador del turno: ¿en qué turno se subasta? | Termina su turno, arranca el del siguiente y ahí se subasta                                                  | Así el jugador del turno nunca es un quebrado (invariante)                                                                | `declareBankruptcy` en `reducer.ts`: sacar el `endTurn` previo |
| Escasez: ¿cuándo se subasta?                                           | Solo la **última** casa (u hotel), si otro jugador podría construirla y pagar su precio de lista             | El reglamento dice "si dos o más quieren más de las que hay"; sin construir fuera de turno, la última es el caso concreto | `buildHouse` en `rules/build.ts` (`lastOne`)                   |
| Puja mínima de la casa escasa                                          | El costo de casa del grupo de cada postor                                                                    | Que la subasta no abarate la casa por debajo de la lista                                                                  | `minBidFor` en `rules/auction.ts`                              |
| ¿Dónde va la casa si gana otro?                                        | En su primera propiedad válida por índice                                                                    | Determinista y sin pedirle otra decisión                                                                                  | `buildingTarget`; o agregar `tile` a la puja                   |
| Vender un hotel sin 4 casas en el banco                                | No se puede de a uno; `sellAllBuildings` vende el grupo entero                                               | El oficial obliga a desarmar; esto es lo más simple que nunca rompe la construcción pareja                                | `sellError` en `rules/checks.ts`                               |
| Recibir una hipotecada: ¿pagar el 10 % o levantarla en el acto?        | Siempre se cobra el 10 % y queda hipotecada (levantarla después cuesta valor + 10 %)                         | Simple y sin una decisión extra; el oficial deja elegir                                                                   | `acceptTrade` en `rules/trade.ts` y `goBankrupt`               |
| ¿Un trueque puede dejar a alguien en deuda?                            | No: solo es válido si cada lado puede pagar el 10 % de lo que recibe                                         | Conservador: aceptar un trueque nunca abre una deuda                                                                      | `tradeContentError`                                            |
| ¿Quién propone trueques y cuándo?                                      | El del turno en su fase libre, o el deudor; uno a la vez; `endTurn` lo cancela                               | §5.6 "en su turno"; un trueque colgado entre turnos complica todo                                                         | `PHASE_ACTIONS` y `endTurn`                                    |
| ¿Se puede juntar plata para comprar?                                   | Sí: vender e hipotecar en `awaitingPurchase`                                                                 | Regla oficial (SPEC §15.4 #11 lo anticipaba)                                                                              | `PHASE_ACTIONS.awaitingPurchase`                               |
| Patrimonio de una hipotecada                                           | Precio − hipoteca                                                                                            | Es lo que vale descontando la deuda con el banco                                                                          | `netWorth` en `rules/endgame.ts`                               |
| Desempate por patrimonio                                               | Más efectivo; después, orden de turno                                                                        | Determinista                                                                                                              | `endGame`                                                      |
| ¿Cuándo termina por rondas?                                            | Al pasar de `maxRounds` rondas completas, en el cambio de turno                                              | Todos juegan la misma cantidad de turnos                                                                                  | `startNextTurn` en `rules/turn.ts`                             |
| Fin por tiempo a mitad de una subasta                                  | Corta igual y valúa como está                                                                                | El tiempo es el tiempo                                                                                                    | `timeUp` en `validate.ts`                                      |
| A quién va lo que se le debía a un quebrado                            | Al banco                                                                                                     | No puede cobrar alguien que ya no juega                                                                                   | `declareBankruptcy` en `reducer.ts`                            |

### Deuda técnica (M3)

- `legalActions` devuelve solo la puja mínima: un bot que quiera pujar más arma el monto él mismo.
- El hot-seat de debug no tiene UI de trueques (llega en M7).

### Qué NO se pudo verificar (M3)

- El CI de GitHub de M3: el entorno no tiene credenciales para hacer push (ver "Lo primero que tiene que revisar el humano").

### Cómo probarlo a mano (M3)

`pnpm dev`, abrir `http://localhost:5173/?debug=1`, nueva partida, y usar "Auto ×200": aparecen subastas (botones `bid`/`passAuction` de cada participante), construcción e hipotecas.

---

## M4 — Server de juego

### Qué quedó hecho

- `apps/server`: salas en memoria (`RoomManager`, sin sockets, testeable), protocolo tipado con
  esquemas zod para todo lo que entra, handlers de Socket.IO, rate limit por socket.
- Lobby: crear, unirse por código (6 caracteres), reconectar con token, elegir ficha única,
  listo/no listo, reglas del host (validadas con `resolveRules`), arrancar.
- Intents con `actionId` (idempotencia) y `expectedVersion` (`STALE_STATE`); cada asiento
  recibe su `PlayerView` filtrada después de cada acción.
- Timers de turno, subasta, trueque y partida corta; piloto automático por timeout y por
  desconexión (en el engine: `autopilotAction`, puro y testeado).
- Persistencia en SQLite (seed + acciones), restauración por replay, barrido de salas viejas,
  `validateGameData()` al arrancar, `USE_REAL_BRANDS` como default de la regla por sala.
- Fichas (`TOKENS`) en `shared`, con nombre en es-AR y en.

### Decisiones (M4)

| Duda                                     | Qué elegí                                                                                                             | Por qué                                                                                                    | Cómo revertirlo                       |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| ¿Desde cuándo cuenta el timer del turno? | Desde que cambia la decisión pendiente (fase/actor/turno)                                                             | Si se reiniciara con cada acción de gestión, alguien podría colgar la partida hipotecando y deshipotecando | `resetWaiting` en `rooms.ts`          |
| ¿Qué hace el piloto en un timeout?       | Tira, rechaza la compra, termina el turno, pasa en subastas, rechaza trueques; vende/hipoteca solo en deuda impagable | SPEC §8: "acción automática segura"                                                                        | `bots/autopilot.ts`                   |
| ¿Y por un desconectado?                  | Lo mismo, pero compra si le quedan $500                                                                               | SPEC §8 "compra solo si le sobra efectivo X"; X = $500                                                     | `DISCONNECTED_BUY_RESERVE`            |
| ¿Irse de una partida en curso?           | Es desconectarse para siempre: lo toma el piloto                                                                      | No hay abandono/expulsión en el SPEC hasta M9                                                              | `leave` en `rooms.ts`                 |
| ¿Arrancar sin que todos estén listos?    | No: todos menos el host tienen que estar listos                                                                       | SPEC §7.4 muestra "listo/no listo"                                                                         | `start` en `rooms.ts`                 |
| Ventana de idempotencia                  | Los últimos 64 `actionId` por jugador, en memoria                                                                     | Un reintento real llega en segundos; tras un reinicio, `expectedVersion` frena igual el duplicado          | `IDEMPOTENCY_WINDOW`                  |
| Rate limit                               | 30 de golpe, 10/s sostenidos por socket                                                                               | Alcanza para jugar rápido; corta un cliente que spamea                                                     | `DEFAULT_RATE_LIMIT` en `handlers.ts` |

### Cambios a tests de hitos anteriores

| Test                              | Cambio                             | Por qué                                                         |
| --------------------------------- | ---------------------------------- | --------------------------------------------------------------- |
| `server/test/health.test.ts` (M0) | `/health` ahora incluye `rooms: 0` | El health reporta cuántas salas hay (útil para monitoreo, M10). |

### Proceso (M4)

- La verificación sobre un clon limpio detectó que el piloto automático bajaba la cobertura de
  ramas del engine a 89,75 %. No se tocó el umbral: se simplificó el piloto a una tabla de
  preferencias por fase (sin ramas muertas) y se agregaron tests de sus casos de borde.

### Deuda técnica (M4)

- Espectadores, chat, revancha: M9.
- Escalar horizontalmente (sticky sessions + adapter de Redis) está documentado en la ADR 0002, no implementado.
- `node:sqlite` imprime un `ExperimentalWarning` al arrancar (Node 24); es inofensivo.

### Qué NO se pudo verificar (M4)

- El CI de GitHub de este hito (sin credenciales para hacer push).
- No probé el server en Windows (el CI con matriz lo cubre cuando se haga push).

### Cómo probarlo a mano (M4)

`pnpm --filter @gran-negocio/server dev` y conectarse con cualquier cliente de Socket.IO; o
esperar a M5, que trae la UI. Los tests `apps/server/test/game.test.ts` juegan una partida de 4
clientes por red real, con un corte y una reconexión.

---

## M5 — Cliente base

### Qué quedó hecho

- Inicio (crear o unirse con código), sala por link `/sala/CÓDIGO` (pide el nombre si no hay
  sesión), lobby (código, copiar link, jugadores, fichas únicas, listo, reglas editables por el
  host y resumen para el resto, empezar), partida (tablero 11 × 11, jugadores, panel de acciones
  contextual con subasta y deuda, detalle de casilla con alquileres y acciones, registro de
  eventos, fin de partida con patrimonio).
- Store de Zustand + socket tipado con el protocolo del server; reconexión con el token al
  recargar o al volver la conexión.
- Todo texto visible por i18n (es-AR y en, mismas claves).
- e2e: dos navegadores (escritorio y Pixel 7) juegan una partida completa por la UI, incluida
  una recarga al final.

### Revisión visual (Playwright, escritorio 1440 × 900 y Pixel 7)

Jugué partidas cortas en los dos y revisé capturas. Lo que encontré y arreglé:

| Problema                                                                                                      | Arreglo                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| En celular, con el tablero entero, los nombres de las casillas quedaban de ~4 px y se rompían ("Cumb recita") | Container query: bajo 560 px se ocultan nombres y precios; se leen con zoom o tocando la casilla                                    |
| El detalle de casilla no se abría                                                                             | Bug real: los efectos dobles de StrictMode cerraban el `<dialog>` apenas se abría. Arreglado, con test de regresión                 |
| Al recargar en plena partida, la pantalla quedaba sin estado                                                  | Bug real: el cliente borraba la vista recibida en el snapshot (que llega antes que el ack). Arreglado; el e2e recarga y lo verifica |
| Al terminar la partida quedaba un panel vacío                                                                 | El panel de acciones se oculta en `gameOver`                                                                                        |
| "El GranNegocio" sin espacio para lectores de pantalla                                                        | Espacio antes del `<br>`                                                                                                            |

### Decisiones (M5)

| Duda                                   | Qué elegí                                                      | Por qué                                                                                | Cómo revertirlo                            |
| -------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------ |
| Texto rotado en las casillas laterales | Rotado (90°, 180°, 270°) como pide §4.1                        | Es lo que dice el SPEC; la fila de arriba queda cabeza abajo como en el tablero físico | `placement().rotation` en `boardLayout.ts` |
| Celular, vista completa                | Sin nombres en las casillas; zoom con scroll a la propia ficha | Ilegible si no; el pinch nativo queda para M6                                          | `@container` en `index.css`                |
| Construir/hipotecar desde dónde        | Desde el detalle de la casilla                                 | Es la acción sobre una propiedad concreta; los modales completos son M7                | `TileDialog.tsx`                           |
| Fichas                                 | Discos de color con inicial                                    | Las ilustraciones de las fichas son M6                                                 | `TokenBadge`                               |

### Cambios a tests de hitos anteriores

| Test                                                                       | Cambio                                                                                | Por qué                                                                             |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `web/test/App.test.tsx` (M0) "muestra la sala con el código en mayúsculas" | Ahora espera el formulario para entrar ("Te invitaron a la sala ABC123"), asincrónico | La pantalla placeholder de M0 se reemplazó por la sala real; la ruta se carga lazy. |

### Deuda técnica (M5)

- Trueques sin UI (se ven, se pueden aceptar/rechazar, pero no proponer): M7.
- Subasta con un input numérico simple; el modal completo con cuenta regresiva es M7.
- Sin animaciones, ilustraciones, audio ni temas: M6.
- Accesibilidad completa (patrones además del color, navegación por teclado del tablero): M9.

### Qué NO se pudo verificar (M5)

- Un celular real (solo la emulación Pixel 7 de Playwright). Ni Safari/iOS.
- El CI de GitHub (sin credenciales para hacer push).

### Cómo probarlo a mano (M5)

```sh
pnpm dev            # web en :5173, server en :3001
```

Abrir `http://localhost:5173` en dos navegadores (o una ventana de incógnito), crear la sala en
uno y entrar con el código o el link en el otro.

---

## M7 — Subasta, trueque y construcción en la UI

### Qué quedó hecho

- Diálogo de subasta (se abre solo, cuenta regresiva, participantes, puja con atajos, pasar).
- Editor de trueques con validación en vivo y motivo, aviso de interés por hipotecadas,
  propuesta, contraoferta, aceptar, rechazar y retirar; se abre solo al receptor.
- "Tus propiedades": construir/vender parejo, hipotecar/levantar, vender todo el grupo, con
  el motivo cuando algo no se puede.
- Escenarios de desarrollo del server para los e2e (y para probar a mano).
- e2e de los tres flujos con dos navegadores (escritorio + Pixel 7), sin consola.

### Revisión visual

Capturas de los tres diálogos en escritorio y Pixel 7. Encontré y arreglé: en el editor de
trueques, una propiedad hipotecada decía "no cobra alquiler" en vez de avisar el interés que
paga quien la recibe (lo detectó el e2e).

### Decisiones (M7)

| Duda                                    | Qué elegí                                                                  | Por qué                                       | Cómo revertirlo                    |
| --------------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------- | ---------------------------------- |
| ¿La subasta se abre sola?               | Sí, para los participantes; si la cierran, queda un botón "Ver la subasta" | Es una decisión de todos a la vez y con reloj | `autoAuction` en `GameScreen.tsx`  |
| ¿Y el trueque?                          | Se abre solo al receptor                                                   | Tiene que responder                           | `autoTrade`                        |
| Atajos de puja                          | Suman al monto escrito (+$1, +$10, +$50)                                   | Lo más predecible                             | `AuctionDialog.tsx`                |
| Explicar por qué no se puede            | Con los chequeos del engine sobre un `RulesView`                           | Mismas reglas que el server, sin duplicarlas  | `game/rulesView.ts`                |
| Probar flujos que dependen de los dados | Escenarios de desarrollo (no persistidos, nunca en producción)             | E2e deterministas                             | `apps/server/src/dev/scenarios.ts` |

### Cambios a tests de hitos anteriores

| Test                    | Cambio                                                                  | Por qué                                            |
| ----------------------- | ----------------------------------------------------------------------- | -------------------------------------------------- |
| `e2e/game.spec.ts` (M5) | En una subasta, el jugador automático aprieta "Paso" dentro del diálogo | M7 movió la subasta del panel a un diálogo propio. |

### Proceso (M7)

- El tag `m7-done` se creó una primera vez antes de tiempo (el commit de los e2e había fallado
  en el hook de lint). Era local y nunca se publicó: se borró, se corrigió el lint y se volvió a
  crear después de verificar sobre un clon limpio.

### Deuda técnica (M7)

- El historial de trueques es el registro de eventos (no hay una lista aparte).
- La expiración del trueque es `turnTimerSeconds`; con el timer en 0, no vence.

### Qué NO se pudo verificar (M7)

- Celular real; el CI de GitHub (sin credenciales para hacer push).

### Cómo probarlo a mano (M7)

Con `pnpm dev`, crear un escenario y entrar como cada jugador:

```sh
curl -X POST http://localhost:3001/dev/scenario/trade   # o auction, build
```

La respuesta trae el código y los tokens; lo más simple es correr `pnpm e2e` con
`--headed` para verlo en vivo: `pnpm exec playwright test e2e/flows.spec.ts --headed --project desktop`.

---

## M6 — Juice y visuales

Primero lo básico, cada cosa en su commit: secuenciador + saltos de ficha, flip de carta,
plata que cuenta, edificios, shake de la cárcel, quiebra y confeti. Después dados 3D, audio,
temas e ilustraciones.

### Qué quedó hecho

- Secuenciador de animaciones con XState (`animation/sequencer.ts`) alimentado por los eventos
  de cada actualización; fichas en una capa encima del tablero que saltan casilla por casilla.
- Carta que se da vuelta en el centro (tocarla la saltea), plata con conteo y destello
  verde/rojo, casas y hoteles que "brotan", tablero que tiembla al ir preso, ficha que se
  desvanece al quebrar, confeti al ganar.
- Dados 3D en CSS que caen en el resultado del server.
- Audio sintetizado (dados, pasos, cobro, pago, carta, martillazo, cárcel, construcción,
  victoria) y música ambiente, con Ajustes (silencio, volúmenes, música on/off).
- Temas de tablero (3) y modo claro/oscuro, en Ajustes.
- Ilustraciones SVG propias de todas las casillas y fichas.

### Verificación

| Qué                        | Cómo                                                                                                                    | Resultado                                                                                   |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Saltos casilla por casilla | e2e `motion.spec.ts`: a los 250 ms la ficha no llegó                                                                    | ✅                                                                                          |
| `prefers-reduced-motion`   | e2e: con `reduce`, la ficha llega directo                                                                               | ✅                                                                                          |
| 60 fps                     | Build de producción, Pixel 7 emulado, CPU 4× más lenta (CDP), midiendo `requestAnimationFrame` durante turnos completos | 59,5 fps promedio, p95 16,7 ms, 0,4 % de frames > 33 ms                                     |
| Sin WebGL                  | Nada usa WebGL (dados en CSS)                                                                                           | ✅ por construcción                                                                         |
| Temas y modo oscuro        | Capturas en escritorio y Pixel 7                                                                                        | Arreglado: fichas en la misma casilla se pisaban; corridas al borde para no tapar el nombre |

### Decisiones (M6)

| Duda                                | Qué elegí                                               | Por qué                                                                                           | Cómo revertirlo                                          |
| ----------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Framer Motion, R3F + Rapier, Howler | No; CSS, cubos CSS 3D y Web Audio (**ADR 0007**)        | Ahorra ~250 kB de JS + ~1,5 MB de wasm; 60 fps en gama media; sin archivos de audio que licenciar | ADR 0007 describe cómo enchufar R3F detrás de `import()` |
| Dados "con física"                  | Sin física: animación que cae en la cara del server     | El resultado lo decide el server de todas formas                                                  | `Dice3D.tsx`                                             |
| Música                              | Apagada por defecto                                     | Que una pestaña no empiece a sonar sola                                                           | `DEFAULTS` en `audio/settings.ts`                        |
| Modo oscuro y tablero               | El tema del tablero es independiente del modo de la app | Cada uno elige por separado                                                                       | `look.ts`                                                |

### Qué NO se pudo verificar (M6)

- **60 fps en un celular real de gama media**: medí en Chromium headless con CPU throttling,
  que es una aproximación (la GPU y el compositor de un teléfono real son otros).
- Cómo suena el audio (no tengo parlantes): los sonidos se sintetizan y el test verifica que no
  rompan sin Web Audio, pero el balance y el volumen hay que escucharlos.
- Safari/iOS (transformaciones 3D y Web Audio tienen particularidades ahí).

### Cómo probarlo a mano (M6)

`pnpm dev`, jugar una partida y abrir **Ajustes** (arriba a la derecha) para probar sonido,
temas y modo oscuro. Para ver la versión sin movimiento: activar "reducir movimiento" en el
sistema operativo.

---

## M8 — Bots y simulador de balance

### Qué quedó hecho

- Bots Fácil, Medio y Difícil (engine, deterministas, mismo canal de intents).
- Bots en la sala: el host los suma o saca en el lobby; el server los hace jugar.
- Simulador headless y `pnpm sim`, que escribe `docs/balance-report.md`.
- **Aceptación**: Medio le gana al Fácil en el **84,3 %** de 1000 partidas (96,4 % contando
  solo las que terminaron). Hay un test que lo verifica sobre 1000 partidas.

### Hallazgos de balance (ver `docs/balance-report.md`)

| Hallazgo                                                                             | Lectura                                                                                                       |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| Difícil vs. Medio: 54 % / 46 %                                                       | El trueque y la valuación por retorno suman, pero poco con dos jugadores.                                     |
| En partidas de 4 (Difícil, Medio, Fácil, Fácil), el 81 % llega al tope de 400 turnos | Sin trueques, con cuatro jugadores casi nadie completa un grupo y nadie quiebra. Es el estancamiento clásico. |
| Ventaja del primero en partidas de 4: 29,5 % vs. 19,9 % del cuarto                   | Esperable: el primero llega antes a las propiedades libres.                                                   |
| Los subtes tienen el mejor retorno (1,46) y los grupos de color ~0,4                 | Con tan poca construcción, mandan los alquileres base; con más trueques cambiaría.                            |

Ajustes propuestos (documentados en el reporte, **no activados**): sugerir `maxRounds` en
partidas de 2, impuesto creciente, subasta forzada de propiedades sueltas, bots más dispuestos
a trocar.

### Decisiones (M8)

| Duda                                      | Qué elegí                                         | Por qué                                                                                                                              | Cómo revertirlo              |
| ----------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------- |
| ¿El Fácil construye?                      | No                                                | "Compra casi todo, nunca comercia": no aprovechar los grupos es lo que lo hace fácil. Con construcción, el Medio solo ganaba el 57 % | `PROFILES.easy.buildReserve` |
| Bots con azar                             | No: deterministas                                 | El reporte se reproduce exacto y los tests no son frágiles                                                                           | `bots.ts`                    |
| ¿Cómo se gana una partida que no termina? | Por patrimonio neto al llegar al tope (como §5.8) | Si no, el 28 % de las partidas con el Fácil no tendría ganador                                                                       | `playBotGame`                |
| Memoria de los bots                       | Solo "ya propuse un trueque este turno"           | Para no proponer lo mismo en bucle                                                                                                   | `BotMemory`                  |

### Cambios a tests de hitos anteriores

| Test                             | Cambio                                                                             | Por qué                           |
| -------------------------------- | ---------------------------------------------------------------------------------- | --------------------------------- |
| `server/test/rooms.test.ts` (M4) | El asiento público incluye `bot: null`; el `manager()` de prueba pasa `botDelayMs` | Campo y dependencia nuevos de M8. |

### Proceso (M8)

- La verificación sobre un clon limpio frenó el cierre: los bots bajaban la cobertura de ramas
  del engine a 86,8 %. Se escribieron tests unitarios de cada decisión de bot y aparecieron
  **dos problemas reales**: (1) para comprar la propiedad que le completaba un grupo, el bot
  hipotecaba otra del mismo grupo (que después no podía construir); (2) el bot Fácil pujaba
  por la última casa aunque nunca construye. Ambos arreglados.
- **Corrección (hecha en M9)**: acá decía que el reporte de balance se había regenerado
  después de esos arreglos, y no era cierto. Se regeneró en M9 (commit `c91bece`). Los
  números se movieron menos de 0,3 puntos y las conclusiones de arriba siguen valiendo.
- El script de verificación ahora falla por código de salida en cada paso (antes un fallo de
  cobertura se veía pero no frenaba).

### Qué NO se pudo verificar (M8)

- Que el bot Difícil "se sienta" difícil para una persona: está medido contra otros bots, no
  contra humanos.

### Cómo probarlo a mano (M8)

`pnpm dev`, crear una sala, "Sumar un bot" (Fácil/Medio/Difícil) y empezar. `pnpm sim` vuelve
a generar el reporte (~2 minutos).

---

## M9 — Pulido

### Qué quedó hecho

- **Estadísticas de fin de partida** (engine, `stats.ts`):
  - patrimonio por ronda, en un gráfico SVG propio con trazo y marcador distintos por jugador;
  - cobrado y pagado, alquileres y veces preso por jugador;
  - las tres propiedades que más rindieron y la casilla más pisada.

  Salen de los eventos: un replay da las mismas. El fuzz verifica en cada paso que cierren con
  el efectivo de todos.

- **Revancha**: la misma sala vuelve al lobby (solo el host, al terminar).
- **Espectadores**: "Mirar la partida" desde el link de la sala.
- **Chat**: texto y 6 reacciones rápidas, en el lobby y en la partida. Los quebrados escriben;
  los espectadores solo leen.
- **Inglés completo**, con selector en la portada y en Ajustes.
- **Tutorial de reglas** de 5 pasos ("Cómo se juega", en la portada).
- **Accesibilidad**: checklist en `docs/accessibility.md`.
  - Contraste AA del texto secundario.
  - Un patrón por grupo de color, en el tablero, los diálogos y las miniaturas.
  - Enlace "Saltar a las acciones".
  - Nombres accesibles de las casillas que empiezan por lo que se lee.
  - `lang` que sigue al idioma.
- e2e nuevo (`e2e/polish.spec.ts`), con un host y un espectador:
  - chat con reacciones;
  - el espectador mira en inglés;
  - la partida se juega hasta el final, con estadísticas;
  - la revancha vuelve al lobby.

### Lighthouse (mobile, build de producción)

| Página  | Performance | Accesibilidad | Buenas prácticas |
| ------- | ----------: | ------------: | ---------------: |
| Inicio  |          98 |           100 |              100 |
| Partida |          97 |           100 |              100 |

Antes de los arreglos: accesibilidad 95 en el inicio (contraste) y buenas prácticas 96 en la
partida.

### Revisión visual (Playwright, escritorio 1350 × 940 y Pixel 7)

Jugué partidas cortas contra dos bots en los dos tamaños, con capturas del tutorial, el lobby
con chat, la partida, el fin con estadísticas y la versión en inglés. **Encontré un bug real que
venía de M5**:

- Con 3 o más jugadores, en celular, la tira de jugadores (que scrollea de costado) ensanchaba
  la grilla: la página medía 622 px en un teléfono de 412 px.
- Ni el e2e ni las revisiones anteriores lo vieron porque usaban 2 jugadores.
- Arreglo: `min-w-0` en las columnas. Ahora mide 412 px.

### Decisiones (M9)

| Duda                                      | Qué elegí                                                                                  | Por qué                                                                     | Cómo revertirlo                               |
| ----------------------------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- | --------------------------------------------- |
| ¿Los espectadores escriben en el chat?    | No, solo leen                                                                              | No tienen asiento ni nombre; lo más conservador contra spam de desconocidos | `RoomManager.chat` + `canWrite` en `Chat.tsx` |
| ¿Se puede mirar desde el lobby?           | No: en el lobby se entra con asiento                                                       | En el lobby no hay partida que mirar                                        | `room:watch` en `handlers.ts`                 |
| ¿Se guarda el chat?                       | Solo en memoria, últimos 50                                                                | No es parte de la partida (`seed + acciones`); guardarlo pide moderación    | `Room.chat`                                   |
| Revancha: ¿quién vuelve?                  | Todos los asientos conectados y los bots; las personas tienen que volver a marcarse listas | Que nadie quede "listo" sin haber visto la revancha                         | `RoomManager.rematch`                         |
| ¿Cuándo viajan las estadísticas?          | Solo al terminar la partida                                                                | Durante la partida no se muestran y pesan                                   | `statsOf` en `handlers.ts`                    |
| Idioma por defecto                        | es-AR siempre (no se detecta el del navegador)                                             | SPEC §2: "Idioma por defecto es-AR"                                         | `load()` en `apps/web/src/i18n.ts`            |
| Cambio de idioma                          | Vuelve a montar la app con la clave del idioma                                             | Ningún componente necesita suscribirse; el estado vive en los stores        | `App.tsx`                                     |
| ¿El tutorial se abre solo la primera vez? | No, botón "Cómo se juega"                                                                  | No interrumpir a quien ya sabe jugar (y no romper los e2e)                  | `Landing.tsx`                                 |
| Gráfico de patrimonio                     | SVG propio, sin librería                                                                   | Sin dependencias nuevas (ADR 0007)                                          | `StatsPanel.tsx`                              |
| Reacción "¡Qué suerte!"                   | "¡Qué suerte, che!" (descarté "¡Qué orto!")                                                | SPEC §7.5: humor rioplatense moderado, nunca ofensivo                       | `emote.suerte` en `es-AR.ts`                  |

### Cambios a tests de hitos anteriores

| Test                                           | Cambio                                                                                         | Por qué                                                |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `engine/test/invariants.ts` (fuzz, M2/M3)      | Se **agrega** una verificación: las estadísticas cierran con el efectivo de todos en cada paso | Ampliar el fuzz con cada regla nueva; no se quitó nada |
| `server/test/rooms.test.ts` (persistencia, M4) | Se **agrega** que las estadísticas se rearman igual tras la restauración                       | Las estadísticas tienen que sobrevivir a un reinicio   |

### Deuda técnica (M9)

- ~~El registro de eventos no se puede filtrar~~ → resuelto en M9.1.
- En celular, con el tablero entero, las casillas no muestran texto (decisión de M5): se lee
  tocando la casilla o acercando el tablero (pinch desde M9.1).
- Sin moderación del chat (palabras, silenciar a alguien).
- Al cambiar de idioma se reinician las animaciones en curso (por el remontado).
- El perfil y las estadísticas históricas por jugador son de M10 (no se hizo, como se pidió).

### Qué NO se pudo verificar (M9)

- Un lector de pantalla real. Se verificó el árbol de accesibilidad (Testing Library por rol y
  nombre) y Lighthouse/axe.
- El contraste en modo oscuro y en los temas "Noche" y "Topográfico": Lighthouse mide el modo
  claro. Se revisaron a ojo en capturas.
- Lighthouse sobre un deploy real (CDN, HTTP/2, compresión): se midió contra `vite preview` en
  local.

### Cómo probarlo a mano (M9)

- **Partida**: `pnpm dev`, crear sala, "Sumar un bot", escribir en el chat y apretar una
  reacción, empezar.
- **Espectador**: en otra ventana de incógnito, abrir el link de la sala y apretar "Mirar la
  partida". Para verlo en inglés, apretar primero "English" en la portada.
- **Final**: con "Límite de rondas: 10" y "Tiempo por turno: Sin límite" la partida termina en
  pocos minutos. Abajo de la tabla de patrimonio salen las estadísticas, y "Revancha" vuelve al
  lobby.
- **Lighthouse**, repetible:
  1. `pnpm --filter @gran-negocio/web build`;
  2. `WEB_ORIGIN=http://localhost:4173 pnpm --filter @gran-negocio/server start:e2e`;
  3. `pnpm --filter @gran-negocio/web preview`;
  4. `npx lighthouse@12.8.2 http://localhost:4173/`.

  Para la pantalla de partida hace falta una sesión: crear la sala en un perfil de Chrome y
  correr Lighthouse con ese `--user-data-dir` y `--disable-storage-reset`.

---

## M9.1 — Seguridad de /dev, pinch-zoom y registro filtrable

Pedido después de aprobar M3–M9. Tag `m9.1-done`.

### 1. Rutas `/dev/*` en producción

**Cómo está protegido** (tres capas):

1. `apps/server/src/config.ts`: `readConfig(env)` es una función pura. Da `devRoutes: false`
   cuando `NODE_ENV === 'production'`, y `index.ts` usa solo eso.
2. `apps/server/src/app.ts`: aunque un llamador pase `devRoutes: true`, `createGameServer` **no**
   monta `/dev/scenario/:name` si `NODE_ENV=production` (segunda barrera).
3. El contenedor de producción fija `NODE_ENV=production` (`Dockerfile` y `fly.toml`, punto 4).

**Tests** (`apps/server/test/config.test.ts`):

- `readConfig` con y sin `NODE_ENV=production`;
- `createGameServer({ devRoutes: true })` con `NODE_ENV=production` responde 404;
- **de punta a punta**: se levanta el proceso real (`src/index.ts`) con `NODE_ENV=production`, y
  `POST /dev/scenario/{build,trade,auction}` da 404 mientras `/health` da 200. Sin `NODE_ENV`, el
  escenario responde 200.

Verifiqué que los tests muerden: con la condición rota a propósito, fallan los tres de seguridad.

**Antes** la decisión vivía en `index.ts` sin test: solo estaba probado `createGameServer` con
`devRoutes: false`.

### 2. Pinch-zoom y pan del tablero

- `ZoomPan.tsx` con pointer events, sin librerías.
  - **El zoom cambia el ancho de layout del tablero**, no un `transform`. Así la container query
    de M5 (que oculta los nombres por debajo de 560 px) ve el tamaño real: **a partir de ~1,5×
    aparecen los nombres**.
  - El pinch corrige el scroll para que lo que está entre los dedos no se mueva. La matemática
    está en `game/zoom.ts`, con tests.
- Sin zoom, `touch-action: pan-x pan-y`: un dedo scrollea la página como siempre. Con zoom,
  `touch-action: none`, y el pan de un dedo lo hace el componente.
- "Acercar a mi ficha" sigue igual (2,2×). "Ver todo el tablero" aparece siempre que hay zoom,
  también en escritorio, donde Ctrl + rueda o el pinch del trackpad acercan.
- **e2e en Pixel 7 con toques reales de dos dedos** (CDP), con capturas en `test-results/`:
  1. pinch hacia afuera: los nombres aparecen;
  2. pan de un dedo;
  3. tocar una casilla abre su detalle;
  4. pinch hacia adentro: vuelve a 1 sin scroll residual.

**Lo que encontré en el camino**:

- **Primero usé `pan-x pan-y` siempre**, para tener el pan nativo con inercia. El e2e mostró que,
  con el tablero acercado, el navegador toma los dos dedos como su propio pan y cancela los
  pointer events: el pinch hacia adentro no andaba. De ahí `touch-action: none` con zoom.
- **Click después de un arrastre**: en una página mínima, Chromium generó un `click` al soltar un
  arrastre que mueve el scroll por programa. En el tablero real no lo pude reproducir, ni con el
  arrastre pasando sobre las casillas. Igual dejé una defensa barata: se descarta un `click` que
  llegue hasta 400 ms después de un arrastre o un pinch. La cubre un test unitario de
  `ZoomPan`, que falla si se quita la defensa. El e2e no detecta su ausencia, porque el bug no
  aparece en la app.

### 3. Registro filtrable

- Filtro por **Todo / Plata / Propiedades / Cartas / Turnos** (botones con `aria-pressed`).
- `game/eventCategory.ts` es un `switch` exhaustivo: si el engine suma un evento, no compila
  hasta asignarle categoría.

### Decisiones (M9.1)

| Duda                                    | Qué elegí                                                       | Por qué                                                       | Cómo revertirlo               |
| --------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------- | ----------------------------- |
| ¿Dev routes por opt-in (`ENABLE_DEV…`)? | No: apagadas con `NODE_ENV=production`, más una segunda barrera | No rompe `pnpm dev` ni los e2e; el contenedor siempre lo fija | `readConfig` en `config.ts`   |
| Zoom máximo                             | 3×                                                              | A 3× una casilla mide ~100 px en un Pixel 7: se lee todo      | `MAX_SCALE` en `game/zoom.ts` |
| Quiebra en el filtro                    | En "Plata"                                                      | Es la consecuencia de no poder pagar                          | `eventCategory.ts`            |
| Filtro de una o varias categorías       | Una a la vez (o Todo)                                           | Lo más simple; alcanza para "¿cuánto pagué?"                  | `EventLog.tsx`                |
| Tipos de DOM en los e2e                 | `lib: DOM` en `e2e/tsconfig.json`                               | Lo que va dentro de `page.evaluate` corre en el navegador     | `e2e/tsconfig.json`           |

### Qué NO se pudo verificar (M9.1)

- **Pinch en un celular real** (iOS Safari y Chrome Android): los toques fueron emulados por CDP
  en Chromium. Safari maneja `touch-action` y los gestos a su manera; es lo primero para probar
  en un teléfono.

### Cómo probarlo a mano (M9.1)

- **Celular**: `pnpm --filter @gran-negocio/web dev --host` y el server con
  `WEB_ORIGIN=http://IP:5173` (ver "Cómo jugar una partida de 4"). Abrir una partida,
  pellizcar el tablero, arrastrar con un dedo y tocar casillas.
- **Escritorio**: Ctrl + rueda sobre el tablero.
- **Seguridad**: `NODE_ENV=production pnpm --filter @gran-negocio/server start:e2e` y después
  `curl -X POST http://localhost:3001/dev/scenario/build`, que tiene que dar 404.
