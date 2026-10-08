import { DEFAULT_RULES } from '@gran-negocio/shared';
import { describe, expect, it } from 'vitest';
import { randomPlay } from './invariants.js';

describe('partida de bots (aceptación de M2)', () => {
  it('200 turnos con seed fijo, sin errores y con invariantes en verde', () => {
    const { state, log } = randomPlay(
      {
        seed: '6772616e206e65676f63696f20323032',
        rules: DEFAULT_RULES,
        players: ['ana', 'beto', 'caro', 'dani'].map((id) => ({ id, name: id, tokenId: id })),
      },
      { steps: 20_000, policySeed: 'b07b07b07b07b07b07b07b07b07b07b0', maxTurns: 200 },
    );
    // O llegó a 200 turnos, o la partida terminó antes por quiebras.
    expect(state.turnNumber > 200 || state.phase.kind === 'gameOver').toBe(true);
    expect(log.length).toBeGreaterThan(200);
  }, 60_000);
});
