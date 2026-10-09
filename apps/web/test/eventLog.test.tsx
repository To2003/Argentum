import { createGame, toPlayerView, type GameEvent } from '@gran-negocio/engine';
import { DEFAULT_RULES } from '@gran-negocio/shared';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EventLog } from '../src/components/game/EventLog.js';
import { eventCategory } from '../src/game/eventCategory.js';

const game = createGame({
  seed: '0123456789abcdef0123456789abcdef',
  rules: DEFAULT_RULES,
  players: [
    { id: 'p1', name: 'Ana', tokenId: 'mate' },
    { id: 'p2', name: 'Beto', tokenId: 'bombo' },
  ],
});
const view = toPlayerView(game.state, 'p1');

const events: GameEvent[] = [
  { type: 'turnStarted', playerId: 'p1', turnNumber: 1 },
  { type: 'diceRolled', playerId: 'p1', dice: [1, 2], reason: 'move' },
  { type: 'propertyBought', playerId: 'p1', tile: 3 },
  { type: 'moneyTransferred', from: 'p2', to: 'p1', amount: 60, reason: 'rent', tile: 3 },
  { type: 'cardDrawn', playerId: 'p2', deck: 'chance', cardId: 'chance.advanceToGo' },
];

describe('categorías del registro', () => {
  it('cada evento cae en plata, propiedades, cartas o turnos', () => {
    expect(events.map(eventCategory)).toEqual(['turns', 'turns', 'properties', 'money', 'cards']);
    expect(eventCategory({ type: 'playerBankrupt', playerId: 'p2', creditor: 'bank' })).toBe(
      'money',
    );
    expect(eventCategory({ type: 'tradeAccepted', tradeId: 1 })).toBe('properties');
  });
});

describe('registro filtrable (SPEC §7.4)', () => {
  it('filtra por categoría y vuelve a "Todo"', () => {
    render(<EventLog log={events.map((event, id) => ({ id, event }))} view={view} />);
    const list = () => within(screen.getByTestId('event-log')).getAllByRole('listitem');
    expect(list()).toHaveLength(5);

    fireEvent.click(screen.getByRole('button', { name: 'Plata' }));
    expect(screen.getByRole('button', { name: 'Plata' })).toHaveAttribute('aria-pressed', 'true');
    expect(list()).toHaveLength(1);
    expect(list()[0]).toHaveTextContent('60');

    fireEvent.click(screen.getByRole('button', { name: 'Turnos' }));
    expect(list()).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: 'Cartas' }));
    expect(list()).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Todo' }));
    expect(list()).toHaveLength(5);
  });

  it('una categoría sin eventos lo dice', () => {
    render(<EventLog log={[{ id: 1, event: events[0]! }]} view={view} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cartas' }));
    expect(screen.getByText('Nada de esto todavía.')).toBeInTheDocument();
  });
});
