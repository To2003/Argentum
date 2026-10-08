import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import HotSeat from '../src/debug/HotSeat.js';

describe('HotSeat (debug)', () => {
  it('arma una partida con el seed dado y juega acciones legales', () => {
    render(<HotSeat />);
    fireEvent.change(screen.getByLabelText('seed'), {
      target: { value: '0123456789abcdef0123456789abcdef' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Nueva partida' }));
    expect(screen.getByText(/fase waitingRoll/)).toBeInTheDocument();
    const before = screen.getByTestId('events').textContent.split('\n').length;
    fireEvent.click(screen.getByRole('button', { name: 'rollDice' }));
    const after = screen.getByTestId('events').textContent.split('\n').length;
    expect(after).toBeGreaterThan(before);
    expect(screen.getByTestId('events').textContent).toContain('"type":"diceRolled"');
  });

  it('muestra el error si el seed es inválido', () => {
    render(<HotSeat />);
    fireEvent.change(screen.getByLabelText('seed'), { target: { value: 'nope' } });
    fireEvent.click(screen.getByRole('button', { name: 'Nueva partida' }));
    expect(screen.getByText(/Rechazada: RangeError/)).toBeInTheDocument();
  });

  it('Auto juega muchas acciones sin romper', () => {
    render(<HotSeat />);
    fireEvent.click(screen.getByRole('button', { name: 'Nueva partida' }));
    fireEvent.click(screen.getByRole('button', { name: 'Auto ×200' }));
    expect(screen.getByTestId('events').textContent.length).toBeGreaterThan(0);
    expect(screen.queryByText(/Rechazada/)).not.toBeInTheDocument();
  });

  it('el selector de vista muestra la PlayerView sin rngState', () => {
    render(<HotSeat />);
    fireEvent.click(screen.getByRole('button', { name: 'Nueva partida' }));
    expect(screen.getByText(/"rngState"/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('vista'), { target: { value: 'p1' } });
    expect(screen.queryByText(/"rngState"/)).not.toBeInTheDocument();
  });
});
