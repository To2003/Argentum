import { createGame, emptyStats, recordStats, toPlayerView } from '@gran-negocio/engine';
import { DEFAULT_RULES } from '@gran-negocio/shared';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { App } from '../src/App.js';
import { Chat } from '../src/components/Chat.js';
import { StatsPanel } from '../src/components/game/StatsPanel.js';
import { Tutorial } from '../src/components/Tutorial.js';
import { useLocale } from '../src/i18n.js';
import { useGame } from '../src/store/game.js';

beforeAll(() => {
  // jsdom no implementa showModal: lo simulamos como el navegador.
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.setAttribute('open', '');
    },
  });
});

afterEach(() => {
  act(() => {
    useLocale.getState().setLocale('es-AR');
  });
});

describe('idioma (M9)', () => {
  it('el selector cambia toda la app a inglés y lo recuerda', () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByRole('button', { name: 'Crear partida' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'English' }));
    expect(screen.getByRole('button', { name: 'Create game' })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('en');
    expect(localStorage.getItem('gran-negocio:locale')).toBe('en');
    expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('tutorial (M9)', () => {
  it('cinco pasos, con anterior y siguiente', () => {
    let closed = false;
    render(
      <Tutorial
        onClose={() => {
          closed = true;
        }}
      />,
    );
    expect(screen.getByText('Paso 1 de 5')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();
    for (let i = 0; i < 4; i += 1) fireEvent.click(screen.getByTestId('tutorial-next'));
    expect(screen.getByText('Cárcel y cartas')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '¡A jugar!' }));
    expect(closed).toBe(true);
  });
});

describe('estadísticas (M9)', () => {
  it('muestra el gráfico accesible, la tabla y lo más rentable', () => {
    const { state, events } = createGame({
      seed: '0123456789abcdef0123456789abcdef',
      rules: DEFAULT_RULES,
      players: [
        { id: 'p1', name: 'Ana', tokenId: 'mate' },
        { id: 'p2', name: 'Beto', tokenId: 'bombo' },
      ],
    });
    const base = recordStats(emptyStats(state), state, events);
    const stats = {
      ...base,
      rentByTile: { 39: 500, 1: 20 },
      landings: base.landings.map((_, i) => (i === 24 ? 7 : 0)),
    };
    render(<StatsPanel stats={stats} view={toPlayerView(state, 'p1')} />);
    expect(screen.getByRole('img', { name: /Patrimonio por ronda\. Ana: .*1\.500/ })).toBeVisible();
    const table = screen.getByRole('table');
    expect(within(table).getByRole('rowheader', { name: 'Beto' })).toBeInTheDocument();
    const top = screen.getByText('Las que más rindieron').parentElement!;
    const items = within(top).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent(/500/);
    expect(screen.getByText(/7 veces/)).toBeInTheDocument();
  });
});

describe('chat (M9)', () => {
  it('muestra mensajes y reacciones; el espectador no tiene para escribir', () => {
    useGame.setState({
      chat: [
        { id: 1, playerId: 'p1', name: 'Ana', at: 0, text: 'Hola', emote: null },
        { id: 2, playerId: 'p2', name: 'Beto', at: 0, text: null, emote: 'paga' },
      ],
    });
    const { rerender } = render(<Chat canWrite={false} />);
    const list = screen.getByTestId('chat-messages');
    expect(list).toHaveTextContent('Ana: Hola');
    expect(list).toHaveTextContent('Beto: ¡Pagá, loco!');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    rerender(<Chat canWrite />);
    expect(screen.getByRole('textbox', { name: 'Escribí algo…' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mandar' })).toBeDisabled();
    expect(screen.getByRole('group', { name: 'Reacciones rápidas' })).toBeInTheDocument();
  });
});
