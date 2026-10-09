import { useEffect, useRef, type ReactNode } from 'react';
import {
  clampScale,
  distance,
  midpoint,
  scrollForZoom,
  settleScale,
  type Point,
} from '../../game/zoom.js';

/**
 * Pinch-zoom y pan del tablero (SPEC.md §4.1, §7.7), con pointer events y sin
 * librerías.
 *
 * - El pan es el scroll del contenedor. Con el tablero entero, el dedo
 *   scrollea la página como siempre; con zoom, el pan de un dedo se hace acá
 *   (ver `touch-action` abajo). El mouse y el trackpad usan el scroll nativo.
 * - El pinch (dos dedos) cambia el ancho de layout del tablero y corrige el
 *   scroll para que lo que está entre los dedos no se mueva. Durante el gesto
 *   se toca el DOM directo (sin renders de React); al soltar se avisa la
 *   escala final con `onScale`.
 * - En escritorio, Ctrl + rueda (o el pinch del trackpad, que llega así).
 *
 * Después de un arrastre o un pinch se descarta un `click` que llegue enseguida
 * de soltar: en Chromium, un arrastre que mueve el scroll por programa puede
 * terminar en un click sobre lo que quedó bajo el dedo (reproducido en una
 * página mínima; en este tablero no apareció, así que es una defensa).
 *
 * `touch-action`: sin zoom, `pan-x pan-y` (la página scrollea y el navegador
 * no hace su propio zoom, así que el pinch llega acá). Con zoom, `none`: si
 * no, el navegador toma dos dedos sobre algo que scrollea como su propio pan
 * y cancela los pointer events en medio del pinch (lo encontró el e2e).
 */
/** Cuánto se puede mover el dedo y que siga siendo un toque (px). */
const TAP_SLOP = 10;
/** El click de un arrastre llega enseguida de soltar; después de esto, es otro toque. */
const CLICK_AFTER_DRAG_MS = 400;

export function ZoomPan({
  scale,
  onScale,
  children,
}: {
  scale: number;
  onScale: (scale: number) => void;
  children: ReactNode;
}) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const live = useRef(scale);
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<{ distance: number; mid: Point } | null>(null);
  /** Último punto del dedo que arrastra (pan de un dedo con zoom). */
  const drag = useRef<Point | null>(null);
  /** Dónde empezó el toque, para saber si fue un toque o un arrastre. */
  const origin = useRef<Point | null>(null);
  /** El toque en curso se movió (arrastre) o fue un pinch: no es un toque. */
  const moved = useRef(false);
  /** Hasta cuándo un click viene de un arrastre recién soltado (ms de `performance.now`). */
  const swallowUntil = useRef(0);

  useEffect(() => {
    live.current = scale;
  }, [scale]);

  /** Lleva el tablero a `next` dejando quieto `focal`, y desplaza `pan`. */
  const zoomTo = (next: number, focal: Point, pan: Point = { x: 0, y: 0 }) => {
    const box = outer.current;
    const content = inner.current;
    if (box === null || content === null) return;
    const scroll = scrollForZoom(
      { x: box.scrollLeft, y: box.scrollTop },
      focal,
      live.current,
      next,
    );
    content.style.width = `${next * 100}%`;
    box.scrollLeft = scroll.x - pan.x;
    box.scrollTop = scroll.y - pan.y;
    live.current = next;
  };

  // Ctrl + rueda: un listener no pasivo, para poder cancelar el zoom de la página.
  useEffect(() => {
    const box = outer.current;
    if (box === null) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      const rect = box.getBoundingClientRect();
      const next = clampScale(live.current * Math.exp(-event.deltaY * 0.01));
      zoomTo(next, { x: event.clientX - rect.left, y: event.clientY - rect.top });
      onScale(next);
    };
    box.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      box.removeEventListener('wheel', onWheel);
    };
  });

  const two = (): [Point, Point] | null => {
    const [a, b] = [...pointers.current.values()];
    return a === undefined || b === undefined ? null : [a, b];
  };

  const release = (id: number) => {
    pointers.current.delete(id);
    drag.current = null;
    if (pointers.current.size === 0 && moved.current) {
      swallowUntil.current = performance.now() + CLICK_AFTER_DRAG_MS;
    }
    if (gesture.current === null || pointers.current.size >= 2) return;
    gesture.current = null;
    const final = settleScale(live.current);
    zoomTo(final, { x: 0, y: 0 });
    if (final === 1 && outer.current !== null) {
      outer.current.scrollLeft = 0;
      outer.current.scrollTop = 0;
    }
    onScale(final);
  };

  return (
    <div
      ref={outer}
      data-testid="board-viewport"
      data-scale={scale}
      className={`relative mx-auto aspect-square w-full ${scale > 1 ? 'overflow-auto' : 'overflow-hidden'}`}
      style={{
        touchAction: scale > 1 ? 'none' : 'pan-x pan-y',
        maxWidth: 'min(100%, calc(100dvh - 2rem))',
      }}
      onPointerDown={(event) => {
        if (event.pointerType === 'mouse') return;
        pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        drag.current = { x: event.clientX, y: event.clientY };
        if (pointers.current.size === 1) {
          origin.current = { x: event.clientX, y: event.clientY };
          moved.current = false;
        }
        const pair = two();
        if (pair !== null && gesture.current === null) {
          gesture.current = { distance: distance(...pair), mid: midpoint(...pair) };
          moved.current = true;
        }
      }}
      onPointerMove={(event) => {
        if (!pointers.current.has(event.pointerId)) return;
        pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        const start0 = origin.current;
        if (
          start0 !== null &&
          distance(start0, { x: event.clientX, y: event.clientY }) > TAP_SLOP
        ) {
          moved.current = true;
        }
        const box = outer.current;
        // Un dedo con zoom: pan (el navegador no lo hace con touch-action: none).
        if (pointers.current.size === 1 && gesture.current === null && box !== null) {
          const last = drag.current;
          if (last !== null && live.current > 1) {
            box.scrollLeft -= event.clientX - last.x;
            box.scrollTop -= event.clientY - last.y;
          }
          drag.current = { x: event.clientX, y: event.clientY };
          return;
        }
        const pair = two();
        const start = gesture.current;
        if (pair === null || start === null || box === null) return;
        const now = distance(...pair);
        const mid = midpoint(...pair);
        if (start.distance === 0) return;
        const rect = box.getBoundingClientRect();
        zoomTo(
          clampScale((live.current * now) / start.distance),
          { x: mid.x - rect.left, y: mid.y - rect.top },
          { x: mid.x - start.mid.x, y: mid.y - start.mid.y },
        );
        gesture.current = { distance: now, mid };
      }}
      onClickCapture={(event) => {
        if (performance.now() >= swallowUntil.current) return;
        swallowUntil.current = 0;
        event.preventDefault();
        event.stopPropagation();
      }}
      onPointerUp={(event) => {
        release(event.pointerId);
      }}
      onPointerCancel={(event) => {
        release(event.pointerId);
      }}
    >
      <div ref={inner} style={{ width: `${scale * 100}%` }}>
        {children}
      </div>
    </div>
  );
}
