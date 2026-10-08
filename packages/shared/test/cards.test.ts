import { describe, expect, it } from 'vitest';
import cardsJson from '../data/cards.json' with { type: 'json' };
import { cardById, DECK_SIZE, DECKS, DecksSchema, tileAt, type CardEffect } from '../src/index.js';

/** SPEC.md §6, transcripto a mano: [id sin mazo, efecto]. */
const CHANCE: readonly (readonly [string, CardEffect])[] = [
  ['advanceToGo', { type: 'moveTo', tile: 0 }],
  ['advanceToAltaGracia', { type: 'moveTo', tile: 24 }],
  ['advanceToTigre', { type: 'moveTo', tile: 11 }],
  ['advanceToPuertoMadero', { type: 'moveTo', tile: 39 }],
  ['nearestUtility', { type: 'moveToNearest', target: 'utility', diceMultiplier: 10 }],
  ['nearestSubway1', { type: 'moveToNearest', target: 'subway', rentMultiplier: 2 }],
  ['nearestSubway2', { type: 'moveToNearest', target: 'subway', rentMultiplier: 2 }],
  ['goBack3', { type: 'moveRelative', steps: -3 }],
  ['goToJail', { type: 'goToJail' }],
  ['aguinaldo', { type: 'gain', amount: 50 }],
  ['jailFree', { type: 'jailFreeCard' }],
  ['consorcioRepairs', { type: 'repairs', perHouse: 25, perHotel: 100 }],
  ['parkingFine', { type: 'pay', amount: 15 }],
  ['rideLineA', { type: 'moveTo', tile: 5 }],
  ['consorcioPresident', { type: 'payEach', amount: 50 }],
  ['plazoFijo', { type: 'gain', amount: 150 }],
];

const COMMUNITY: readonly (readonly [string, CardEffect])[] = [
  ['advanceToGo', { type: 'moveTo', tile: 0 }],
  ['bankError', { type: 'gain', amount: 200 }],
  ['prepaga', { type: 'pay', amount: 50 }],
  ['savedDollars', { type: 'gain', amount: 50 }],
  ['jailFree', { type: 'jailFreeCard' }],
  ['goToJail', { type: 'goToJail' }],
  ['savingsPlan', { type: 'gain', amount: 100 }],
  ['taxRefund', { type: 'gain', amount: 20 }],
  ['birthday', { type: 'gainFromEach', amount: 10 }],
  ['lifeInsurance', { type: 'gain', amount: 100 }],
  ['hospital', { type: 'pay', amount: 100 }],
  ['schoolFees', { type: 'pay', amount: 50 }],
  ['consulting', { type: 'gain', amount: 25 }],
  ['streetRepairs', { type: 'repairs', perHouse: 40, perHotel: 115 }],
  ['empanadaContest', { type: 'gain', amount: 10 }],
  ['inheritance', { type: 'gain', amount: 100 }],
];

describe('cards.json', () => {
  it('cada mazo tiene 16 cartas', () => {
    expect(DECK_SIZE).toBe(16);
    expect(DECKS.chance).toHaveLength(16);
    expect(DECKS.community).toHaveLength(16);
  });

  it('Suerte coincide con el SPEC', () => {
    expect(DECKS.chance.map((card) => [card.id, card.effect])).toEqual(
      CHANCE.map(([id, effect]) => [`chance.${id}`, effect]),
    );
  });

  it('Barrio coincide con el SPEC', () => {
    expect(DECKS.community.map((card) => [card.id, card.effect])).toEqual(
      COMMUNITY.map(([id, effect]) => [`community.${id}`, effect]),
    );
  });

  it('las dos copias del subte más cercano comparten texto', () => {
    expect(cardById('chance.nearestSubway1').textKey).toBe(
      cardById('chance.nearestSubway2').textKey,
    );
    const keys = DECKS.chance.map((card) => card.textKey);
    expect(new Set(keys).size).toBe(15);
  });

  it('cada mazo tiene exactamente una "Salí de la cárcel gratis"', () => {
    for (const deck of [DECKS.chance, DECKS.community]) {
      expect(deck.filter((card) => card.effect.type === 'jailFreeCard')).toHaveLength(1);
    }
  });

  it('los moveTo apuntan a las casillas que nombra el texto', () => {
    expect(tileAt(24).id).toBe('altaGracia');
    expect(tileAt(11).id).toBe('tigre');
    expect(tileAt(39).id).toBe('puertoMadero');
    expect(tileAt(5).id).toBe('subwayA');
  });

  it('coincide con el snapshot', () => {
    expect(DECKS).toMatchSnapshot();
  });

  it('cardById rechaza ids desconocidos', () => {
    expect(() => cardById('chance.lottery')).toThrow(RangeError);
  });
});

describe('DecksSchema', () => {
  const clone = () =>
    JSON.parse(JSON.stringify(cardsJson)) as {
      chance: Record<string, unknown>[];
      community: Record<string, unknown>[];
    };

  it('acepta los mazos reales', () => {
    expect(DecksSchema.safeParse(cardsJson).success).toBe(true);
  });

  it('rechaza un mazo de 15 cartas', () => {
    const decks = clone();
    decks.chance.pop();
    expect(DecksSchema.safeParse(decks).success).toBe(false);
  });

  it('rechaza una carta del otro mazo', () => {
    const decks = clone();
    decks.chance[0] = decks.community[1] as Record<string, unknown>;
    expect(DecksSchema.safeParse(decks).success).toBe(false);
  });

  it('rechaza ids repetidos', () => {
    const decks = clone();
    (decks.community[1] as Record<string, unknown>)['id'] = 'community.advanceToGo';
    expect(DecksSchema.safeParse(decks).success).toBe(false);
  });

  it('rechaza efectos mal formados', () => {
    const zeroSteps = clone();
    (zeroSteps.chance[7] as Record<string, unknown>)['effect'] = { type: 'moveRelative', steps: 0 };
    expect(DecksSchema.safeParse(zeroSteps).success).toBe(false);

    const crossed = clone();
    (crossed.chance[4] as Record<string, unknown>)['effect'] = {
      type: 'moveToNearest',
      target: 'utility',
      rentMultiplier: 2,
    };
    expect(DecksSchema.safeParse(crossed).success).toBe(false);

    const unknown = clone();
    (unknown.chance[9] as Record<string, unknown>)['effect'] = { type: 'lottery', amount: 1000 };
    expect(DecksSchema.safeParse(unknown).success).toBe(false);
  });
});
