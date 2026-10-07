# 0002 — Red: Socket.IO + Express

- **Estado:** aceptada (M0)
- **Fecha:** 2026-10-07

## Contexto

El SPEC ofrecía Colyseus o Socket.IO + Fastify. El engine es un reducer puro sobre objetos
planos, y el protocolo ya está definido (snapshot + eventos con secuencia, `actionId`).

## Decisión

**Socket.IO 4 sobre Express 5.**

- Colyseus sincroniza estado con clases `Schema` decoradas y mutables: obligaría a mantener el
  estado dos veces (engine + schema) y pelearía con el reducer puro.
- Socket.IO da transporte, salas y reconexión del transporte; el resto (salas de juego, tokens
  de asiento, reconexión con snapshot) se reutiliza del patrón de Tierra Austral.
- Express en vez de Fastify: el HTTP es mínimo (`/health` y poco más) y es el patrón que el
  equipo ya conoce. Fastify no aporta nada concreto con este volumen.

## Protocolo (se implementa en M4)

- Cliente → server: `intent` con `{ actionId, expectedVersion, action }`, validado con zod.
- Si `actionId` ya fue aplicado: se ignora (idempotencia). Si `expectedVersion` no coincide con
  `GameState.version`: se responde `STALE_STATE` y no se aplica nada.
- Server → cliente: `stateSnapshot` (al unirse/reconectar, como `PlayerView`) y `events[]`
  incrementales con número de secuencia.

## Consecuencias

- Escalar horizontalmente requiere sticky sessions + adapter de Redis (documentado, no
  implementado).
