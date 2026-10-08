# REVIEW — trabajo en modo autónomo (M3 → M9)

Registro para revisión humana. Cada decisión tomada sin consultar tiene: hito, duda, qué se
eligió, por qué y cómo revertirla. Criterio: reglamento oficial de Monopoly; si no alcanza, el
default más conservador y simple.

## Lo primero que tiene que revisar el humano

_(Se completa al final.)_

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
