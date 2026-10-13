import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useParams } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WakeNotice } from '../src/components/WakeNotice.js';
import { Unreachable, WAKE_LIMIT_MS } from '../src/net/wake.js';

/**
 * El camino entero en la portada con la red simulada: el server no responde,
 * se muestra "Despertando…", se rinde a los ~90 s con "Reintentar", y al
 * reintentar con el server despierto se entra a la sala.
 */
const net = vi.hoisted(() => ({
  awake: false,
  requests: 0,
  pings: 0,
}));

vi.mock('../src/net/client.js', () => ({
  serverUrl: () => 'http://server.test',
  getSocket: () => ({ on: () => undefined, connected: false }),
  request: () => {
    net.requests += 1;
    return net.awake
      ? Promise.resolve({
          ok: true,
          session: { code: 'ABC234', playerId: 'p1', token: 'token-0000000001' },
        })
      : Promise.reject(new Unreachable());
  },
  pingHealth: () => {
    net.pings += 1;
    return Promise.resolve(net.awake);
  },
}));

const { Landing } = await import('../src/screens/Landing.js');

function RoomStub() {
  const { code } = useParams();
  return <p>sala {code}</p>;
}

function renderApp() {
  render(
    <MemoryRouter initialEntries={['/']}>
      <WakeNotice />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/sala/:code" element={<RoomStub />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  net.awake = false;
  net.requests = 0;
  net.pings = 0;
});
afterEach(() => {
  vi.useRealTimers();
});

describe('server dormido (Render gratis)', () => {
  it('avisa que despierta, se rinde a los ~90 s con Reintentar, y reintentar entra a la sala', async () => {
    renderApp();
    fireEvent.change(screen.getByLabelText('Tu nombre'), { target: { value: 'Ana' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear partida' }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByTestId('wake-notice')).toHaveTextContent('Despertando el server…');
    expect(screen.getByRole('progressbar', { name: 'Espera del server' })).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(screen.getByTestId('wake-notice')).toHaveTextContent(/Van \d+ s/);
    // Mientras /health no responde, el pedido no se repite.
    expect(net.requests).toBe(1);
    expect(net.pings).toBeGreaterThan(0);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(WAKE_LIMIT_MS);
    });
    expect(screen.queryByTestId('wake-notice')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('El server no respondió.');
    const pingsBefore = net.pings;

    // Rendido, no hay más consultas a /health.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(net.pings).toBe(pingsBefore);

    net.awake = true;
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByText('sala ABC234')).toBeInTheDocument();
  });

  it('si el server despierta durante la espera, la acción sigue sola', async () => {
    renderApp();
    fireEvent.change(screen.getByLabelText('Tu nombre'), { target: { value: 'Ana' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear partida' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(screen.getByTestId('wake-notice')).toBeInTheDocument();
    net.awake = true;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(screen.getByText('sala ABC234')).toBeInTheDocument();
    expect(screen.queryByTestId('wake-notice')).not.toBeInTheDocument();
  });
});
