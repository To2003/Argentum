# 0004 — FSM del turno sin XState en el engine

- **Estado:** aceptada (M0)
- **Fecha:** 2026-10-07

## Contexto

El SPEC sugería XState para la máquina de estados del turno, en el engine o en una capa fina.

## Decisión

- En el engine, la fase es una **unión discriminada** (`phase.kind`) y una **tabla de
  transiciones explícita** define qué acciones son legales en cada fase. `reduce` la valida
  antes de aplicar nada y responde un error tipado si la acción no corresponde.
- Las fases interrumpibles (`AUCTION_OPEN`, `IN_DEBT`, `TRADE_OPEN`) llevan **`returnTo`** en
  el propio estado: la fase a la que se vuelve al cerrarse. No hay pila implícita.
- **XState solo en el cliente**, para secuenciar animaciones (dados → movimiento → resolución).
- Diagrama en `docs/turn-fsm.mmd`.

## Por qué

- El estado queda serializable y legible tal cual (snapshots, replays, PlayerView).
- fast-check puede generar acciones y la tabla responde cuáles son legales sin pasar por un
  intérprete de máquinas.
- Cero dependencias en el engine.

## Consecuencias

- No hay visualizador automático: el diagrama Mermaid se mantiene a mano y un test (M2)
  verifica que la tabla de transiciones y el diagrama nombren las mismas fases.
