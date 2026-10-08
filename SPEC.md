# SPEC.md — "El Gran Negocio" (título provisorio): juego de tablero argentino online

> Pegá este archivo en la raíz del repo y decile al agente:
> **"Leé SPEC.md completo. Trabajá un hito por vez (M0 → M10). No avances al siguiente hasta que se cumplan los criterios de aceptación del actual y los tests estén en verde. Si algo es ambiguo, preguntame antes de asumir."**

---

## 0. Roles que tenés que asumir (los dos a la vez)

1. **Ingeniero senior de videojuegos web** (TypeScript, arquitectura cliente-servidor autoritativa, netcode de juegos por turnos, animación y rendimiento en el navegador).
2. **Diseñador experto de juegos de mesa de estrategia** (economía, balance, reglas oficiales de Monopoly, UX de juegos de mesa digitales, prevención de estancamiento y de "kingmaking").

Cuando haya conflicto entre "lo más fácil de programar" y "lo que se siente bien jugando", gana lo segundo, salvo que rompa un criterio de aceptación.

---

## 1. Visión

Un juego de tablero económico **online multijugador** (2–6 jugadores, cada uno desde su compu o celular), basado en la mecánica clásica de comprar propiedades, cobrar alquileres, construir y llevar a los rivales a la quiebra, pero ambientado en **Argentina**: lugares iconicos del país como propiedades, subtes en lugar de ferrocarriles, servicios reales de luz y agua, cartas con humor argentino y una identidad visual **moderna** (no el estilo viejo/retro de los clásicos tipo "El Estanciero").

**Pilares de diseño**
- **Fiel a las reglas oficiales**: quien conoce Monopoly tiene que sentirse en casa.
- **Se siente argentino sin caer en caricatura**: humor, modismos rioplatenses ("che", "vos", "boludo" solo en tono amistoso y moderado), lugares reales, sin política partidaria ni personas reales.
- **Premium visual**: animaciones fluidas, dados 3D, feedback sonoro, todo con juego (juice).
- **Partidas confiables**: servidor autoritativo, reconexión, sin trampas.
- **Rápido de entrar**: crear sala, compartir código/link, jugar. Sin fricción.

**No-objetivos (por ahora)**: matchmaking global, ranking competitivo, monetización, app nativa, modo offline multijugador local en una sola pantalla (se puede dejar la arquitectura lista).

**Aviso legal (importante)**: no usar el nombre "Monopoly", logos, ni arte de Hasbro. Los nombres de empresas reales (Edenor, AySA, líneas de subte) y de lugares se cargan desde un archivo de datos y deben poder reemplazarse por nombres genéricos con un flag (`USE_REAL_BRANDS=true|false`). Todo el arte debe ser original, generado o con licencia libre.

---

## 2. Stack técnico (podés proponer cambios justificados, pero preguntame antes)

> Actualizado en M0: Vite en vez de Next.js, Socket.IO + Express, SQLite hasta M9, XState solo en el cliente. Ver ADRs 0001–0004 y §15.

- **Monorepo** con `pnpm` + Turborepo:
  - `packages/engine` → **motor de reglas puro en TypeScript** (sin DOM, sin red, sin `Math.random`). Testeable en aislamiento.
  - `packages/shared` → tipos, esquemas `zod`, constantes, datos del tablero y cartas.
  - `apps/server` → servidor de juego en tiempo real: **Node.js + Express 5 + Socket.IO** (mismo patrón de salas, tokens de asiento y reconexión que Tierra Austral). Server **autoritativo**; toda la lógica de reglas vive en el engine.
  - `apps/web` → cliente **Vite + React + React Router + TypeScript + Tailwind CSS**. SPA sin SSR (no hace falta).
- **Estado de UI**: Zustand. **Máquina de estados del turno**: en el engine, la fase es una unión discriminada con una tabla de transiciones explícita validada en `reduce` (sin XState). **XState solo en el cliente**, para secuenciar animaciones.
- **Animación/visuales**: Framer Motion para UI y tablero 2.5D en CSS/DOM; **React Three Fiber + Rapier** (`@react-three/rapier`) solo para dados 3D con física (la cara que cae la define el servidor; el cliente anima hacia ese resultado, nunca al revés). Alternativa a evaluar: PixiJS para fichas y efectos de partículas.
- **Audio**: Howler.js (efectos + música ambiente con on/off y volumen separados).
- **Persistencia**: hasta M9, salas en memoria + snapshot `seed + acciones[]` en **SQLite** (`node:sqlite`, como en Tierra Austral). **Auth/perfiles**: Supabase (Google + invitado) recién en M10, solo para cuentas, perfiles y estadísticas.
- **Validación**: `zod` en cada mensaje entrante del servidor.
- **i18n**: diccionario propio tipado en `packages/shared` (ADR 0005): claves y parámetros chequeados al compilar, plurales con `Intl.PluralRules`, plata con `Intl.NumberFormat`. Idioma por defecto **es-AR** (voseo). Idioma por defecto **es-AR** (voseo). Dejar la infraestructura lista para `en`.
- **Testing**: Vitest (unit del engine), **fast-check** (property-based testing para invariantes), Playwright (e2e con 2–4 clientes simulados), Storybook para componentes de UI.
- **Calidad**: ESLint, Prettier, `tsc --build` estricto (`strict: true`, project references), Husky + lint-staged, GitHub Actions (typecheck + lint + test + build, más e2e).
- **Deploy sugerido**: web en Vercel; servidor de juego (WebSockets persistentes) en Railway/Fly.io/Render. Docker para el servidor.

### Plugins, extensiones y herramientas que debés usar o configurar
- **MCP / herramientas del agente (si están disponibles)**: documentación actualizada de librerías (tipo Context7) **antes** de usar APIs de Vite, React Router, Socket.IO, R3F, XState; Playwright MCP para probar la UI real; Figma/Canva/Adobe si hay acceso, para definir assets.
- **Extensiones de VS Code a recomendar en `.vscode/extensions.json`**: ESLint, Prettier, Tailwind CSS IntelliSense, Vitest Explorer, Playwright Test, Error Lens, Mermaid Preview, GitLens, Pretty TypeScript Errors, Thunder Client (o REST Client).
- **Librerías de calidad visual** (usar con criterio, sin inflar el bundle): `framer-motion`, `@react-three/fiber`, `@react-three/drei`, `@react-three/rapier`, `howler`, `canvas-confetti`, `lottie-react` (para animaciones puntuales), `clsx`, `tailwind-merge`, `lucide-react`.
- **Librerías de lógica/mecánicas**: `xstate` (solo cliente), `zod`, `immer` (o reducers inmutables propios), PRNG propio determinista (`mulberry32`), `nanoid` para IDs, `fast-check`.

---

## 3. Arquitectura

### 3.1 Principios
1. **El engine es una función pura**: `reduce(state, action) -> { state, events }`. El estado del PRNG viaja dentro del estado (`GameState.rngState`), así que mismo estado + misma acción = mismo resultado.
2. **Servidor autoritativo**: el cliente envía *intenciones* (`ROLL_DICE`, `BUY_PROPERTY`, `BID`, `BUILD_HOUSE`, etc.); el servidor valida con el engine y difunde *eventos* y el estado público.
3. **Event sourcing liviano**: cada partida guarda `seed` + log de acciones. Permite replays, debugging y reconexión.
4. **Información**: todo es público en este juego (no hay manos ocultas); las cartas "Salí de la cárcel gratis" ya tomadas también son públicas. El seed, `rngState` y el orden de los mazos **nunca** salen del server: se filtran en una `PlayerView`.
5. **RNG**: el server genera el seed con `crypto` al crear la partida. El engine usa un PRNG determinista (**mulberry32**) cuyo estado vive en `GameState.rngState`; dados y barajado de mazos salen del mismo PRNG. `seed + acciones[]` reconstruye la partida exacta (test de replay obligatorio).
6. **Idempotencia y concurrencia**: cada acción lleva `actionId` (el servidor ignora duplicados) y `expectedVersion`; si no coincide con la versión actual del estado, el servidor responde `STALE_STATE` y no aplica nada.
7. **Separación render/lógica**: el cliente nunca decide resultados.

### 3.2 Estructura de carpetas sugerida
```
/apps/web
/apps/server
/packages/engine      (reducer, reglas, mazos, subastas, quiebra, comercio)
/packages/shared      (tipos, zod schemas, board.json, cards.json, i18n keys)
/packages/ui          (componentes reutilizables: Tile, Token, Dice, Card, Modal...)
/docs                 (ADR, diagramas Mermaid, reglas.md)
SPEC.md
```

### 3.3 Modelo de datos (tipos base — refinarlos)
```ts
type TileKind = 'go' | 'property' | 'subway' | 'utility' | 'tax' | 'chance' | 'community' | 'jail' | 'freeRest' | 'goToJail';
type ColorGroup = 'brown'|'lightBlue'|'pink'|'orange'|'red'|'yellow'|'green'|'darkBlue';

interface Tile { index: number; kind: TileKind; nameKey: string; /* i18n */ }
interface PropertyTile extends Tile { kind:'property'; group: ColorGroup; price: number; mortgage: number; houseCost: number; rent: [number,number,number,number,number,number]; /* base,1,2,3,4,hotel */ }
interface SubwayTile extends Tile { kind:'subway'; price: 200; mortgage: 100; rent: [25,50,100,200] }
interface UtilityTile extends Tile { kind:'utility'; price: 150; mortgage: 75; multipliers: [4,10] }
interface TaxTile extends Tile { kind:'tax'; amount: number }

interface PlayerState {
  id: string; name: string; tokenId: string; color: string;
  cash: number; position: number;
  inJail: boolean; jailTurns: number; jailFreeCards: number;
  bankrupt: boolean; isBot: boolean; connected: boolean;
  doublesStreak: number;
}
interface OwnedProperty { tileIndex: number; ownerId: string|null; houses: 0|1|2|3|4|5; /*5 = hotel*/ mortgaged: boolean }

interface GameState {
  id: string; phase: Phase; turnOrder: string[]; currentPlayerId: string;
  players: Record<string, PlayerState>; properties: Record<number, OwnedProperty>;
  bank: { houses: number /*32*/; hotels: number /*12*/ };
  decks: { chance: DeckState; community: DeckState };
  auction?: AuctionState; trade?: TradeState; pendingDebt?: DebtState;
  turnNumber: number; lastRoll?: [number, number]; rules: RulesConfig; log: GameEvent[];
  version: number;   // sube con cada acción aplicada (expectedVersion)
  rngState: number;  // estado de mulberry32; nunca sale del server
}
```

### 3.4 Máquina de estados del turno (diagrama obligatorio en `/docs/turn-fsm.mmd`)
**Implementación** (ADR 0004): la fase es una **unión discriminada** (`state.phase.kind`) y una **tabla de transiciones explícita** valida en `reduce` qué acción es legal en cada fase. Sin XState en el engine. Las fases interrumpibles (`AUCTION_OPEN`, `IN_DEBT`, `TRADE_OPEN`) llevan **`returnTo`** en el propio estado: la fase a la que se vuelve al cerrarse. Las tiradas (`ROLLING`) consumen el PRNG del estado (§3.1.5), nunca azar externo.

`WAITING_ROLL → ROLLING → MOVING → RESOLVING_TILE → (DECISION_BUY | AUCTION | PAY_RENT | DRAW_CARD | TAX | JAIL) → POST_ACTION (construir, hipotecar, comerciar) → (si dobles y no 3: WAITING_ROLL) | END_TURN → siguiente jugador`
Estados transversales: `IN_DEBT` (el jugador debe juntar plata o quebrar), `TRADE_OPEN`, `AUCTION_OPEN`, `GAME_OVER`, `PAUSED_DISCONNECT`.

---

## 4. Tablero (40 casillas, orden horario desde Salida abajo a la derecha)

### 4.1 Geometría y tamaño (igual al clásico)
- **40 casillas**: 4 esquinas + 9 casillas por lado.
- Grilla CSS **11 × 11**: columnas `2fr repeat(9, 1fr) 2fr` y lo mismo en filas.
- **Esquinas**: cuadradas (2×2 unidades). **Casillas laterales**: 1 unidad de ancho × 2 de profundidad (ratio 1 : 2), texto rotado según el lado (90°, 180°, 270°).
- **Centro del tablero**: 9×9 unidades, libre para: mazos de Suerte y Barrio, dados, logo, log de eventos resumido y marcador de dinero.
- Tablero responsivo: cuadrado, `aspect-ratio: 1/1`, escalado al lado menor del viewport. En mobile, modo "vista completa" + modo "zoom a mi ficha" con pan y pinch.
- Cada propiedad tiene **banda de color** en el borde interno hacia el centro, nombre, ilustración/ícono iconic y precio.

### 4.2 Casillas (fuente de verdad: `packages/shared/data/board.json`)

| # | Casilla | Tipo | Precio |
|---|---|---|---|
| 0 | **Salida** (cobrás $200 al pasar o caer) | esquina | — |
| 1 | **Caminito (La Boca)** | marrón | 60 |
| 2 | **Barrio** (carta) | comunidad | — |
| 3 | **Feria de San Telmo** | marrón | 60 |
| 4 | **Impuesto a las Ganancias** | impuesto | pagás 200 |
| 5 | **Subte Línea A** (Plaza de Mayo – San Pedrito) | subte | 200 |
| 6 | **Cementerio de la Recoleta** | celeste | 100 |
| 7 | **Suerte** (carta) | suerte | — |
| 8 | **Rosedal de Palermo** | celeste | 100 |
| 9 | **Teatro Colón** | celeste | 120 |
| 10 | **Cárcel (Devoto) / Solo de visita** | esquina | — |
| 11 | **Tigre (Delta)** | rosa | 140 |
| 12 | **Edenor** (luz) | servicio | 150 |
| 13 | **La Plata (Catedral)** | rosa | 140 |
| 14 | **Mar del Plata** | rosa | 160 |
| 15 | **Subte Línea B** (L. N. Alem – J. M. de Rosas) | subte | 200 |
| 16 | **Monumento a la Bandera (Rosario)** | naranja | 180 |
| 17 | **Barrio** (carta) | comunidad | — |
| 18 | **Esteros del Iberá (Corrientes)** | naranja | 180 |
| 19 | **Cataratas del Iguazú (Misiones)** | naranja | 200 |
| 20 | **Fin de semana largo** (descanso, "estacionamiento libre") | esquina | — |
| 21 | **Villa Carlos Paz** | rojo | 220 |
| 22 | **Suerte** (carta) | suerte | — |
| 23 | **La Cumbrecita** | rojo | 220 |
| 24 | **Alta Gracia (Estancia Jesuítica)** | rojo | 240 |
| 25 | **Subte Línea C** (Constitución – Retiro) | subte | 200 |
| 26 | **Cafayate (Salta)** | amarillo | 260 |
| 27 | **Quebrada de Humahuaca (Jujuy)** | amarillo | 260 |
| 28 | **AySA** (agua) | servicio | 150 |
| 29 | **Cerro Aconcagua (Mendoza)** | amarillo | 280 |
| 30 | **Vas preso** (operativo policial) | esquina | — |
| 31 | **Glaciar Perito Moreno (Santa Cruz)** | verde | 300 |
| 32 | **San Carlos de Bariloche** | verde | 300 |
| 33 | **Barrio** (carta) | comunidad | — |
| 34 | **Ushuaia (Fin del Mundo)** | verde | 320 |
| 35 | **Subte Línea D** (Catedral – Congreso de Tucumán) | subte | 200 |
| 36 | **Suerte** (carta) | suerte | — |
| 37 | **Obelisco** | azul oscuro | 350 |
| 38 | **Impuesto de Lujo (Bienes Personales)** | impuesto | pagás 100 |
| 39 | **Puerto Madero (Puente de la Mujer)** | azul oscuro | 400 |

> Nota de diseño: los colores van de "barrios porteños" (barato) hasta "Buenos Aires premium + Patagonia" (caro). Mantener esa progresión de costo.

### 4.3 Alquileres y construcción (valores clásicos, todo en `board.json`)
Formato: `[base, 1 casa, 2 casas, 3 casas, 4 casas, hotel]`. Costo de casa/hotel por grupo entre paréntesis. Hipoteca = 50% del precio.

- **Marrón** (casa $50): Caminito `[2,10,30,90,160,250]`; San Telmo `[4,20,60,180,320,450]`
- **Celeste** (casa $50): Recoleta `[6,30,90,270,400,550]`; Rosedal `[6,30,90,270,400,550]`; Teatro Colón `[8,40,100,300,450,600]`
- **Rosa** (casa $100): Tigre `[10,50,150,450,625,750]`; La Plata `[10,50,150,450,625,750]`; Mar del Plata `[12,60,180,500,700,900]`
- **Naranja** (casa $100): Monumento `[14,70,200,550,750,950]`; Iberá `[14,70,200,550,750,950]`; Iguazú `[16,80,220,600,800,1000]`
- **Rojo** (casa $150): Carlos Paz `[18,90,250,700,875,1050]`; Cumbrecita `[18,90,250,700,875,1050]`; Alta Gracia `[20,100,300,750,925,1100]`
- **Amarillo** (casa $150): Cafayate `[22,110,330,800,975,1150]`; Humahuaca `[22,110,330,800,975,1150]`; Aconcagua `[24,120,360,850,1025,1200]`
- **Verde** (casa $200): Perito Moreno `[26,130,390,900,1100,1275]`; Bariloche `[26,130,390,900,1100,1275]`; Ushuaia `[28,150,450,1000,1200,1400]`
- **Azul oscuro** (casa $200): Obelisco `[35,175,500,1100,1300,1500]`; Puerto Madero `[50,200,600,1400,1700,2000]`
- **Subtes** (4 en total): alquiler `25 / 50 / 100 / 200` según cuántas líneas tenga el dueño. Hipoteca $100.
- **Servicios** (Edenor, AySA): alquiler = **4× el resultado de los dados** si el dueño tiene 1; **10×** si tiene los 2. Hipoteca $75.

### 4.4 Esquinas y casillas especiales
- **Salida**: $200 al pasar o caer (configurable).
- **Cárcel / Solo de visita**: caer ahí por tiradas normales = solo visita, sin penalidad.
- **Fin de semana largo** (descanso): por defecto **no pasa nada** (regla oficial). Opción `rules.freeParkingPot = true` acumula impuestos y multas y se lleva el pozo quien caiga (regla de la casa, **desactivada por defecto**, mostrar advertencia de que alarga las partidas).
- **Vas preso**: mover a Cárcel sin cobrar Salida; termina el turno aunque hayas sacado dobles.
- **Impuestos**: pagan al banco (o al pozo si está activo). Opción de regla de la casa configurable.

---

## 5. Reglas del juego (implementar TODAS en el engine con tests)

### 5.1 Setup
- 2–6 jugadores (humanos y/o bots). Dinero inicial **$1500** (2×500, 2×100, 2×50, 6×20, 5×10, 5×5, 5×1 en versión visual de billetes; internamente un número).
- Banco: **32 casas y 12 hoteles**. Escasez real: si no hay casas, no se puede construir (importante, es parte de la estrategia).
- Orden de turnos: cada jugador tira 2 dados al inicio, orden descendente; desempate con re-tirada solo entre empatados.
- Elección de ficha (únicas por jugador). Fichas con identidad argentina (ver 7.3).

### 5.2 Turno
1. Tirar 2d6 (servidor). Mover en sentido horario. Pasar por Salida cobra $200.
2. **Dobles**: tirás de nuevo tras resolver la casilla. **Tres dobles seguidos → vas a la cárcel** sin resolver el tercer movimiento.
3. Resolver casilla:
   - **Propiedad sin dueño**: opción de comprar al precio de lista. Si **no compra**, se abre **subasta obligatoria** entre todos los jugadores activos (incluido el que rechazó), puja mínima +$1, arranca en $10 (configurable), tiempo límite por puja de 10 s con cuenta regresiva, gana la puja más alta cuando nadie supera a los X segundos.
   - **Propiedad con dueño**: pagar alquiler (salvo hipotecada o que sea propia).
   - **Monopolio (grupo completo sin construir)**: alquiler base **×2**.
   - **Servicios**: tirar dados para el cobro o usar los dados del movimiento actual (**usar los dados del movimiento**; si vino por carta "servicio más cercano", se vuelve a tirar y se paga 10×).
   - **Carta**: robar del mazo correspondiente, aplicar efecto, devolver al fondo salvo "Salí de la cárcel gratis" (se retiene).
   - **Impuesto**: pagar.
4. **Fase libre** (antes o después de tirar, siempre en tu turno): construir, vender edificios, hipotecar/deshipotecar, proponer intercambios.
5. Terminar turno.

### 5.3 Cárcel
- Se va a la cárcel por: casilla "Vas preso", tercer doble seguido, o carta.
- Para salir, al inicio de tu turno elegís: **pagar $50**, **usar carta "Salí gratis"**, o **tirar dados**: si sacás dobles, salís y movés esa tirada (pero **no** volvés a tirar). Si fallás 3 turnos seguidos, **pagás $50 obligatorio** y movés con esa tirada.
- Estando preso **sí podés** cobrar alquileres, construir, hipotecar y comerciar.

### 5.4 Construcción
- Solo con **grupo completo y sin propiedades hipotecadas** en ese grupo.
- **Construcción pareja obligatoria**: la diferencia de edificios dentro del grupo nunca puede ser mayor a 1. Lo mismo para vender.
- 4 casas → se puede construir **hotel** (devuelve las 4 casas al banco).
- Venta de edificios al banco: 50% del costo.
- Si no hay casas/hoteles en el banco: **no se puede construir** (si varios quieren la última casa, **subasta** entre los interesados, como en el reglamento oficial).

### 5.5 Hipotecas
- Hipotecar: cobrás 50% del precio; antes hay que **vender todos los edificios** del grupo. No cobrás alquiler de hipotecadas.
- Deshipotecar: pagás hipoteca + **10% de interés**.
- Al recibir una propiedad hipotecada por intercambio o quiebra, hay que pagar el 10% de interés inmediatamente (o deshipotecarla pagando su valor + 10%).

### 5.6 Intercambios (comercio completo entre jugadores)
- Cualquier jugador puede ofrecer en su turno (y el receptor puede contraofertar): propiedades (sin edificios; hay que venderlos antes), efectivo, cartas "Salí gratis". Combinaciones libres, **sin préstamos ni promesas futuras** (solo lo que existe hoy).
- UI: ventana de trueque con paneles de ambos lados, validación en vivo, botones Aceptar / Contraofertar / Rechazar, expiración configurable, historial.

### 5.7 Deudas y quiebra
- Si debés más de lo que tenés en efectivo: entrás en estado `IN_DEBT`. Podés vender edificios, hipotecar y vender propiedades por trueque con otros jugadores para juntar fondos.
- **Quiebra ante otro jugador**: todos tus bienes (propiedades, cartas) van al acreedor; si hay hipotecadas, paga el 10% de interés o las deshipoteca.
- **Quiebra ante el banco** (impuestos, cartas): tus propiedades vuelven al banco y **se subastan una por una**; los edificios se destruyen.
- El jugador eliminado queda como espectador con chat.

### 5.8 Fin de partida
- **Ganador**: último jugador no quebrado.
- **Modo partida corta (opcional)**: límite de tiempo (30/60/90 min) o de rondas; al terminar gana quien tenga **mayor patrimonio neto** (efectivo + valor de propiedades + edificios al costo).
- Pantalla final con estadísticas: patrimonio por turno (gráfico), propiedades más rentables, plata cobrada y pagada, veces en la cárcel, casilla más pisada, etc.

### 5.9 Reglas configurables (`RulesConfig`)
`startingCash`, `salary`, `jailFine`, `maxJailTurns`, `freeParkingPot`, `auctionOnDecline` (true), `evenBuild` (true), `doubleRentOnMonopoly` (true), `turnTimerSeconds` (60), `auctionStartBid`, `maxPlayers`, `gameDurationMinutes`, `useRealBrands`. Mostrar un resumen de reglas activas al armar la sala.

---

## 6. Cartas (fuente: `packages/shared/data/cards.json`, textos en i18n es-AR)

Cada mazo: **16 cartas**, barajadas al inicio, robo por orden y la carta usada va al fondo. Tipos de efecto: `moveTo`, `moveToNearest`, `moveRelative`, `gain`, `pay`, `gainFromEach`, `payEach`, `repairs`, `goToJail`, `jailFreeCard`.

### 6.1 SUERTE (casillas 7, 22, 36)
1. Avanzá hasta la **Salida**. Cobrá $200. → `moveTo(0)`
2. Avanzá hasta **Alta Gracia**. Si pasás por la Salida, cobrá $200. → `moveTo(24)`
3. Avanzá hasta **Tigre**. Si pasás por la Salida, cobrá $200. → `moveTo(11)`
4. Avanzá hasta **Puerto Madero**. → `moveTo(39)`
5. Avanzá hasta el **servicio más cercano**. Si no tiene dueño, podés comprarlo; si tiene dueño, tirá los dados y pagá **10×** el resultado. → `moveToNearest(utility)`
6. Avanzá hasta la **línea de subte más cercana** y pagá al dueño **el doble** del alquiler. Si no tiene dueño, podés comprarla. → `moveToNearest(subway, x2)`
7. Ídem 6 (hay **2 copias** de esta carta).
8. **Retrocedé 3 casillas.** → `moveRelative(-3)`
9. **Vas preso.** Andá directo a la cárcel, sin pasar por la Salida. → `goToJail`
10. Te llegó el **aguinaldo**: cobrá $50. → `gain(50)`
11. **Salí de la cárcel gratis.** Guardá esta carta hasta que la necesites o la vendas. → `jailFreeCard`
12. Arreglos del **consorcio**: pagá $25 por cada casa y $100 por cada hotel que tengas. → `repairs(25,100)`
13. **Multa por estacionar mal**: pagá $15. → `pay(15)`
14. Hacé un viaje en la **Línea A** del subte. Si pasás por la Salida, cobrá $200. → `moveTo(5)`
15. Te eligieron **presidente del consorcio**: pagá $50 a cada jugador. → `payEach(50)`
16. Se te venció tu **plazo fijo**: cobrá $150. → `gain(150)`

### 6.2 BARRIO (casillas 2, 17, 33)
1. Avanzá hasta la **Salida**. Cobrá $200. → `moveTo(0)`
2. **Error del banco** a tu favor: cobrá $200. → `gain(200)`
3. Pagás la **prepaga**: $50. → `pay(50)`
4. Vendiste unos **dólares ahorrados**: cobrá $50. → `gain(50)`
5. **Salí de la cárcel gratis.** → `jailFreeCard`
6. **Vas preso.** Andá directo a la cárcel, sin cobrar la Salida. → `goToJail`
7. Se vence tu **plan de ahorro**: cobrá $100. → `gain(100)`
8. **Devolución de impuestos**: cobrá $20. → `gain(20)`
9. Es tu **cumpleaños**: cada jugador te da $10. → `gainFromEach(10)`
10. Cobrás tu **seguro de vida**: $100. → `gain(100)`
11. **Gastos del hospital**: pagá $100. → `pay(100)`
12. Pagás la **cuota del colegio**: $50. → `pay(50)`
13. Te pagan una **consultoría**: cobrá $25. → `gain(25)`
14. **Arreglo de calles** de tu barrio: pagá $40 por casa y $115 por hotel. → `repairs(40,115)`
15. Ganaste un **concurso de empanadas**: cobrá $10. → `gain(10)`
16. Te llegó una **herencia**: cobrá $100. → `gain(100)`

> Pedido al agente: podés proponer **4 cartas extra por mazo** como "mazo de eventos argentinos" opcional (feriado puente, paro de subte que te hace perder el próximo turno, etc.) pero **desactivado por defecto** y sin tocar el balance base. Evitar política partidaria, personas reales y clubes de fútbol.

---

## 7. Experiencia visual y de usuario

### 7.1 Dirección de arte
- **Moderna, limpia y vibrante**: estilo "flat + profundidad suave" (sombras, glassmorphism sutil, gradientes finos), tipografía con carácter (un display fuerte para títulos + una sans legible para datos). Paleta con identidad argentina (celeste, blanco, dorado, acentos cálidos) sin ser una bandera literal.
- Cada propiedad tiene una **ilustración vectorial minimalista** (monocroma o duotono) de su ícono: Obelisco, Puente de la Mujer, Perito Moreno, Cataratas, Caminito, etc. Proponé un pipeline: SVG propios o generados + optimización con SVGO. Tener un `assets/README.md` que documente origen y licencia de cada asset.
- Modo claro/oscuro, y un **selector de temas de tablero** (Clásico moderno, Noche en Buenos Aires, Mapa topográfico) con CSS variables.

### 7.2 Animaciones y "juice" (con Framer Motion / R3F)
- Dados 3D con física, cámara que acompaña, sonido de impacto, resultado resaltado.
- La ficha **salta casilla por casilla** (arco con easing y sombra), con squash & stretch leve; la cámara/zoom sigue al jugador activo en mobile.
- Al comprar: cartel de propiedad se "levanta" y vuela al panel del jugador; el borde de la casilla toma el color del dueño.
- Al cobrar/pagar: billetes que vuelan entre jugadores, contador de dinero con *count-up* y flash verde/rojo.
- Construcción: casitas que "brotan" con rebote; hotel con efecto especial.
- Cartas: flip 3D, texto con animación de aparición, sonido distintivo.
- Cárcel: reja que baja con shake de cámara. Quiebra: ficha se desvanece con partículas.
- Victoria: confeti (`canvas-confetti`), resumen animado.
- Respetar `prefers-reduced-motion` (reducir/eliminar animaciones intensas).

### 7.3 Fichas (tokens)
Seis fichas con identidad argentina, diseñadas como mini-íconos 3D/2.5D: **mate**, **bombo/ bombilla**, **alfajor**, **colectivo (el 60)**, **zorzal/hornero** (ave nacional), **sol de mayo**. Cada una con color asignado (sin repetir). Evitar íconos que representen personas reales o partidos.

### 7.4 Pantallas
1. **Landing**: título, "Crear partida", "Unirme con código", reglas rápidas, selector de idioma, login (Google / invitado).
2. **Lobby/Sala**: código de 6 caracteres + link para compartir, lista de jugadores con ficha y estado (listo/no listo), host configura reglas, agregar bots (3 dificultades), chat, botón "Empezar" (mín. 2).
3. **Partida** (la principal):
   - Centro: tablero. Alrededor/lateral: panel de jugadores (dinero, fichas, propiedades en miniatura agrupadas por color, indicador de turno, estado de conexión).
   - Panel de acciones contextual (solo muestra lo habilitado): *Tirar dados, Comprar, Subastar, Construir, Hipotecar, Comerciar, Terminar turno, Pagar fianza, Usar carta*.
   - **Log de eventos** en tiempo real con íconos (filtrable).
   - **Modales**: compra, subasta, carta, comercio, construcción (vista de grupo con +/−), quiebra, resumen final.
   - Chat con emotes/reacciones rápidas con humor rioplatense ("¡Qué bajón!", "Dale, che", "Pagá, loco").
4. **Detalle de propiedad** al tocar una casilla: tabla de alquileres, dueño, edificios, estado de hipoteca, historial de cobros.
5. **Fin de partida**: podio, estadísticas, "Revancha" (misma sala).
6. **Perfil/estadísticas** (opcional, M10).

### 7.5 Texto e identidad
Todo el copy de UI y cartas en **español rioplatense informal (voseo)**: "Tirá los dados", "Comprala", "Es tu turno, che". Humor liviano, nunca ofensivo. Cargar todo desde archivos i18n (cero strings hardcodeados en componentes).

### 7.6 Audio
Música de fondo suave (loop sin fatiga, que se pueda apagar), SFX: dados, pasos de ficha, caja registradora, carta, subasta (martillazo), cárcel, construcción, victoria. Mezcla con volúmenes separados y `mute` persistido.

### 7.7 Accesibilidad y mobile
- Contraste AA, foco visible, navegación por teclado en acciones principales, `aria-live` para anunciar eventos, no depender solo del color (agregar íconos/patrones en grupos de color).
- Layout **mobile-first**: tablero con zoom/pan, panel de acciones en bottom-sheet, modales a pantalla completa.
- Rendimiento: 60 fps objetivo en celulares de gama media, carga inicial < 3 s en 4G, bundle de la ruta de juego code-splitted, assets 3D con lazy loading y fallback 2D de dados si no hay WebGL.

---

## 8. Multijugador y red

- **Salas** con código corto y link directo `…/sala/ABC123`.
- Protocolo: mensajes tipados y validados con zod. Cliente → servidor: `intent`. Servidor → clientes: `stateSnapshot` (al unirse/reconectar) + `events[]` incrementales con número de secuencia.
- **Reconexión**: token de sesión; al volver, snapshot + cola de eventos pendientes. Si un jugador se desconecta en su turno, esperar `reconnectGraceSeconds` (60); luego **piloto automático** (tira, compra solo si le sobra efectivo X, termina turno) o lo toma un bot; si vuelve, recupera el control.
- **Timer de turno** con cuenta visible; al vencer, acción automática segura (nunca vender/hipotecar sin consentimiento, salvo en `IN_DEBT` crítico).
- **Anti-trampa**: todo validado en servidor, rate limiting por conexión, sin confiar en el cliente, sin exponer el seed ni el mazo.
- **Bots**: heurísticas por dificultad (Fácil: compra casi todo, nunca comercia; Medio: prioriza completar grupos y mantiene reserva de efectivo; Difícil: evalúa ROI por grupo, construye de forma agresiva en naranjas/rojos —los de mejor ROI en el clásico—, acepta/propone trueques con valuación). Los bots usan **el mismo canal de intents** que los humanos.
- **Espectadores** (solo lectura) y jugadores eliminados.
- Escalabilidad inicial: una instancia con N salas; dejar claro cómo escalar horizontalmente (sticky sessions/Redis presence) sin implementarlo todavía.

---

## 9. Balance y calidad de reglas (hacé esto vos como diseñador)

- Implementá un **simulador headless** en `packages/engine/sim` que juegue miles de partidas bot vs bot con seeds para medir: duración media en turnos, tasa de partidas que no terminan (> N turnos), distribución de victorias por orden de turno, casillas más visitadas, ROI por grupo de color. Exponer un reporte en consola/Markdown.
- Detectar y documentar **estancamientos**. Proponer (sin activar) ajustes opcionales: techo de turnos con desempate por patrimonio, impuesto creciente, etc.
- Validar que los valores del tablero coinciden con el clásico (tests de snapshot de `board.json`).

---

## 10. Testing (obligatorio, no negociable)

- **Unit (Vitest)** del engine: movimiento y paso por Salida, dobles y tercer doble, cárcel (todas las vías de salida), compra, subasta (empates, un solo postor, todos pasan), alquileres (por grupo, monopolio ×2, subtes 1–4, servicios 4×/10×), construcción pareja, escasez de casas, hipotecas con 10%, cartas (todas), impuestos, intercambios (validaciones), deuda y quiebra (ante jugador y ante banco), fin de partida.
- **Property-based (fast-check)**: invariantes tras cualquier secuencia válida de acciones: *el dinero total del sistema es consistente con los flujos conocidos; nunca hay más de 32 casas/12 hoteles; ninguna propiedad con dos dueños; jugador no quebrado nunca tiene efectivo negativo fuera de IN_DEBT; construcción siempre pareja*.
- **Determinismo**: mismo seed + mismas acciones = mismo estado final (test de replay).
- **E2E (Playwright)**: 2 y 4 clientes en una sala, partida completa corta con seed fijo, reconexión, trueque y subasta.
- **Visual**: Storybook con estados de Tile, Token, Dice, Card y modales; capturas de regresión opcionales.
- Cobertura mínima del engine: **90 %**.
- CI: lint + typecheck + unit + e2e headless en cada PR.

---

## 11. Seguridad y legal

- Validación de entrada (zod), sanitización de nombres y chat, filtro básico de insultos, botón de reportar/mutear.
- Variables de entorno en `.env.example`, nunca secretos en el repo.
- Política de privacidad mínima y aviso de que es un proyecto fan/educativo sin afiliación con Hasbro ni con las marcas mencionadas.
- Licencias de assets y de librerías documentadas.

---

## 12. Hitos (trabajá en este orden y mostrame demo/resumen al cierre de cada uno)

**M0 — Fundaciones.** Monorepo, TS estricto, ESLint/Prettier, CI, Vitest, Playwright base, `.vscode/extensions.json`, `docs/` con ADRs iniciales y el diagrama de la FSM del turno.
*Aceptación:* `pnpm i && pnpm test && pnpm build` pasa en limpio; CI verde.

**M1 — Datos.** `board.json` (40 casillas), `cards.json` (2×16), `RulesConfig`, schemas zod, i18n es-AR de todos los textos.
*Aceptación:* tests de snapshot confirman 40 casillas, 22 propiedades, 4 subtes, 2 servicios, 2 impuestos, 3+3 cartas-casillas, y mazos de 16.

**M2 — Engine núcleo.** Dados, movimiento, Salida, compra, alquileres (propiedades, subtes, servicios), impuestos, cartas, cárcel, dobles.
*Aceptación:* un test "partida de bots de 200 turnos con seed fijo" corre sin errores; invariantes en verde.

**M3 — Engine avanzado.** Subastas, construcción pareja y escasez, hipotecas, trueques, deuda/quiebra, fin de partida, snapshot/replay.
*Aceptación:* todos los puntos de la sección 5 cubiertos por tests; property-based en verde; cobertura ≥ 90 %.

**M4 — Servidor de juego.** Salas, conexión, validación de intents, difusión de eventos, reconexión, timer de turno, rate limit.
*Aceptación:* e2e headless con 4 clientes termina una partida; cortar y restaurar conexión de un cliente no rompe la partida.

**M5 — Cliente base.** Landing, lobby, tablero 11×11 responsivo con datos reales, panel de jugadores, acciones contextuales, log. Sin animaciones todavía.
*Aceptación:* una partida completa jugable de punta a punta entre 2–4 navegadores, desktop y mobile.

**M6 — Juice y visuales.** Dados 3D con física, movimiento de fichas, animaciones de compra/cobro/cartas/construcción, temas de tablero, ilustraciones de propiedades, audio.
*Aceptación:* 60 fps en un celular de gama media, `prefers-reduced-motion` respetado, fallback sin WebGL.

**M7 — Subasta, comercio y construcción en la UI.** Modales completos y pulidos, validación en vivo, timers.
*Aceptación:* flujos de subasta, trueque y construcción jugables sin tocar la consola; tests e2e.

**M8 — Bots y simulador de balance.** Bots por dificultad, reporte de balance en Markdown.
*Aceptación:* bot Medio le gana al Fácil > 65 % en 1000 partidas simuladas; reporte generado.

**M9 — Pulido.** Accesibilidad, i18n en, estadísticas de fin de partida, revancha, espectadores, chat y emotes, onboarding/tutorial corto de reglas.
*Aceptación:* auditoría Lighthouse (Perf/A11y > 90 en mobile), checklist de accesibilidad hecho.

**M10 — Deploy y cuentas.** Auth con Supabase (Google + invitado), perfiles y estadísticas en Supabase (las partidas siguen en SQLite), deploy (web + servidor), monitoreo básico, README con instrucciones.
*Aceptación:* URL pública donde 4 personas reales juegan una partida completa.

---

## 13. Acuerdos de trabajo con vos (agente)

1. **Un hito por vez.** Al terminar cada uno: resumen de qué hiciste, qué decisiones tomaste, qué quedó pendiente, cómo probarlo.
2. **Antes de escribir código de un hito, listá tu plan en pasos y esperá mi OK** si el hito toca arquitectura (M0, M2, M4, M6).
3. **Nunca inventes APIs**: consultá la documentación actualizada de cada librería antes de usarla.
4. **Preguntame ante cualquier ambigüedad de reglas** en vez de asumir. Si dudás entre dos interpretaciones del reglamento oficial, mostrame ambas con ventajas y desventajas.
5. **Commits chicos y atómicos** con mensajes convencionales (`feat:`, `fix:`, `test:`, `docs:`).
6. **No agregues dependencias pesadas** sin justificar el costo en bundle.
7. **Todo texto visible al usuario** pasa por i18n en es-AR (voseo).
8. **Registrá decisiones** en `docs/adr/NNNN-titulo.md`.
9. Si algo del SPEC es contradictorio o mejorable, **proponelo explícitamente** con pros/contras en vez de desviarte en silencio.

---

## 14. Definición de "terminado" (DoD) del proyecto

- Partida completa de 2–6 jugadores online sin errores, con todas las reglas de la sección 5.
- Engine determinista con ≥ 90 % de cobertura y property-based tests en verde.
- UI moderna, animada, accesible y usable en celular.
- Bots funcionales con 3 dificultades y reporte de balance.
- Deploy público, README claro y `docs/` actualizado.

**Empezá ahora por M0: mostrame primero tu plan en pasos y esperá mi confirmación.**

---

## 15. Aclaraciones de reglas y decisiones

Registro de decisiones tomadas durante el desarrollo. Ante conflicto con el resto del SPEC, **manda esta sección**. Las decisiones de arquitectura tienen su ADR en `docs/adr/`.

### 15.1 Arquitectura (M0)
- **Server**: Socket.IO + Express 5 (ADR 0002). Cada intent lleva `actionId` (idempotencia) y `expectedVersion` (si no coincide → `STALE_STATE`).
- **Web**: Vite + React + React Router, sin Next.js ni SSR (ADR 0001).
- **FSM**: unión discriminada + tabla de transiciones en el engine; XState solo en el cliente para animaciones; fases interrumpibles con `returnTo` (ADR 0004).
- **RNG**: seed con `crypto` en el server; mulberry32 en el engine con estado en `GameState.rngState`; dados y mazos del mismo PRNG; `rngState` y orden de mazos filtrados en la `PlayerView` (ADR 0003).
- **Persistencia**: memoria + snapshot SQLite (`seed + acciones[]`) hasta M9; Supabase solo para cuentas/perfiles en M10.
- **Entorno**: el desarrollo es en Windows 10. Scripts multiplataforma, `.gitattributes` con `eol=lf`.
- **Pureza del engine**: ESLint prohíbe en `packages/engine/src` y `packages/shared/src`: `Math.random`, `Date`, `performance`, `crypto`, `process`, `fetch`, `console`, timers e imports `node:*`/`fs`/`path`/`crypto`.
- **Fuzz de invariantes**: desde que existan compra y alquiler (M2), test de fuzz con fast-check: dinero conservado, ≤ 32 casas / ≤ 12 hoteles, una propiedad = un dueño.

### 15.2 Datos e i18n (M1)
- **i18n propio** (ADR 0005). Plata del juego: `$ 1.500` en es-AR y `$1,500` en inglés, sin decimales. En inglés los nombres de lugares quedan en castellano (son nombres propios).
- **`useRealBrands = false` genericiza solo las empresas**: Edenor → "Compañía de Luz", AySA → "Compañía de Agua". Lugares y líneas de subte se quedan (son geografía pública). En board.json las casillas de marca llevan `brand: true` y su nombre genérico vive en `${nameKey}.generic`.
- **`useRealBrands` es una regla por sala** (`RulesConfig.useRealBrands`). Su valor por defecto lo pone el server desde la variable de entorno `USE_REAL_BRANDS` (M4); `packages/shared` no lee el entorno.
- **`RulesConfig`, campos agregados a §5.9**: `auctionBidSeconds` (10, el "tiempo límite por puja" de §5.2) y `maxRounds` (`null` = sin límite; la partida corta por rondas de §5.8). `gameDurationMinutes` admite `30 | 60 | 90 | null`. `turnTimerSeconds = 0` desactiva el timer. Rangos válidos en `schemas/rules.ts`.
- **Cartas**: el texto de las que mencionan la Salida usa `{salary}` de la sala, para no mentir si el host cambia el cobro. "Servicio más cercano": si tiene dueño se **vuelve a tirar** y se paga 10× (§5.2). "Subte más cercano": 2× el alquiler que corresponde según cuántas líneas tenga el dueño; hay 2 copias con ids distintos y el mismo texto.
- **Validación de datos**: board.json y cards.json se validan con zod en los tests y en el arranque del server (`validateGameData`), **no** al cargar el módulo: eso metía zod en el bundle del cliente (+30 kB gzip).

### 15.3 Reglas de juego
_(Se completa a medida que se resuelvan ambigüedades.)_

**Pendientes de decidir (se preguntan al llegar al hito):**
- Redondeo del 10 % de interés de hipoteca cuando no da entero (ej.: AySA, hipoteca $75 → $7,50). (M3)

