import { describe, expect, it } from 'vitest';
import { playBotGame, runMatchup, seedFor } from '../sim/simulate.js';

describe('simulador de balance (aceptación de M8)', () => {
  it('una partida de bots es determinista (mismo seed, mismo resultado)', () => {
    const seed = seedFor('0', 3);
    expect(playBotGame(seed, ['medium', 'easy'], 300)).toEqual(
      playBotGame(seed, ['medium', 'easy'], 300),
    );
  });

  it('todas las dificultades juegan sin trabarse ni proponer jugadas ilegales', () => {
    for (const seats of [
      ['easy', 'easy'],
      ['hard', 'hard', 'medium'],
      ['hard', 'medium', 'easy', 'easy'],
    ] as const) {
      const report = runMatchup({ label: seats.join('-'), seats }, 6, 'abc', 300);
      expect(report.results).toHaveLength(6);
    }
  }, 120_000);
});

describe('aceptación de M8', () => {
  it('el bot Medio le gana al Fácil en más del 65 % de 1000 partidas', () => {
    const report = runMatchup(
      { label: 'medio-fácil', seats: ['medium', 'easy'] },
      1000,
      '1234',
      400,
    );
    expect(report.winsByDifficulty.medium / report.games).toBeGreaterThan(0.65);
  }, 300_000);
});
