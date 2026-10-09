import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { ZoomPan } from '../src/components/game/ZoomPan.js';

beforeAll(() => {
  // jsdom no trae PointerEvent: uno mínimo sobre MouseEvent (clientX/Y incluidos).
  if (!('PointerEvent' in window)) {
    class PointerEventPolyfill extends MouseEvent {
      readonly pointerId: number;
      readonly pointerType: string;
      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 1;
        this.pointerType = init.pointerType ?? 'touch';
      }
    }
    Object.defineProperty(window, 'PointerEvent', { value: PointerEventPolyfill });
  }
});

afterEach(() => {
  vi.useRealTimers();
});

function Harness({ onTile }: { onTile: () => void }) {
  const [scale, setScale] = useState(2);
  return (
    <>
      <span data-testid="scale">{scale}</span>
      <ZoomPan scale={scale} onScale={setScale}>
        <button type="button" onClick={onTile}>
          casilla
        </button>
      </ZoomPan>
    </>
  );
}

const finger = (id: number, x: number, y: number) => ({
  pointerId: id,
  pointerType: 'touch',
  clientX: x,
  clientY: y,
  bubbles: true,
});

describe('ZoomPan', () => {
  it('un toque quieto llega a la casilla', () => {
    const onTile = vi.fn();
    render(<Harness onTile={onTile} />);
    const tile = screen.getByRole('button', { name: 'casilla' });
    fireEvent.pointerDown(tile, finger(1, 50, 50));
    fireEvent.pointerUp(tile, finger(1, 52, 51));
    fireEvent.click(tile);
    expect(onTile).toHaveBeenCalledTimes(1);
  });

  it('el click que llega enseguida de un arrastre se descarta; uno posterior, no', () => {
    vi.useFakeTimers();
    const onTile = vi.fn();
    render(<Harness onTile={onTile} />);
    const tile = screen.getByRole('button', { name: 'casilla' });
    fireEvent.pointerDown(tile, finger(1, 50, 50));
    fireEvent.pointerMove(tile, finger(1, 120, 50));
    fireEvent.pointerUp(tile, finger(1, 120, 50));
    fireEvent.click(tile);
    expect(onTile).not.toHaveBeenCalled();
    // Más tarde es otro toque (o el teclado): pasa.
    vi.advanceTimersByTime(1000);
    fireEvent.click(tile);
    expect(onTile).toHaveBeenCalledTimes(1);
  });

  it('el pinch de dos dedos cambia la escala y no cuenta como toque', () => {
    vi.useFakeTimers();
    const onTile = vi.fn();
    render(<Harness onTile={onTile} />);
    const tile = screen.getByRole('button', { name: 'casilla' });
    fireEvent.pointerDown(tile, finger(1, 100, 100));
    fireEvent.pointerDown(tile, finger(2, 140, 100));
    // Se juntan a la mitad de la distancia: de 2 a 1.
    fireEvent.pointerMove(tile, finger(2, 120, 100));
    fireEvent.pointerUp(tile, finger(2, 120, 100));
    fireEvent.pointerUp(tile, finger(1, 100, 100));
    expect(screen.getByTestId('scale')).toHaveTextContent('1');
    expect(screen.getByTestId('board-viewport').style.touchAction).toBe('pan-x pan-y');
    fireEvent.click(tile);
    expect(onTile).not.toHaveBeenCalled();
  });

  it('con zoom no deja el gesto al navegador; sin zoom, sí (la página scrollea)', () => {
    render(<Harness onTile={vi.fn()} />);
    expect(screen.getByTestId('board-viewport').style.touchAction).toBe('none');
  });

  it('el mouse no entra en los gestos táctiles', () => {
    const onTile = vi.fn();
    render(<Harness onTile={onTile} />);
    const tile = screen.getByRole('button', { name: 'casilla' });
    fireEvent.pointerDown(tile, { ...finger(1, 50, 50), pointerType: 'mouse' });
    fireEvent.pointerMove(tile, { ...finger(1, 150, 50), pointerType: 'mouse' });
    fireEvent.pointerUp(tile, { ...finger(1, 150, 50), pointerType: 'mouse' });
    fireEvent.click(tile);
    expect(onTile).toHaveBeenCalledTimes(1);
  });
});
