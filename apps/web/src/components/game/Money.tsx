import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '../../animation/useReducedMotion.js';
import { i18n } from '../../i18n.js';

/**
 * Plata que cuenta hasta el valor nuevo y destella verde si subió o rojo si
 * bajó (SPEC.md §7.2). Con movimiento reducido, cambia directo (el destello,
 * que no es movimiento, queda).
 */
export function Money({ value, testId }: { value: number; testId?: string }) {
  const reducedMotion = useReducedMotion();
  const [shown, setShown] = useState(value);
  const [flash, setFlash] = useState<{ key: number; up: boolean } | null>(null);
  const previous = useRef(value);
  const flashes = useRef(0);

  useEffect(() => {
    const from = previous.current;
    previous.current = value;
    if (from === value) return undefined;
    flashes.current += 1;
    const flashKey = flashes.current;
    const raf = requestAnimationFrame(() => {
      setFlash({ key: flashKey, up: value > from });
    });
    if (reducedMotion) {
      const instant = requestAnimationFrame(() => {
        setShown(value);
      });
      return () => {
        cancelAnimationFrame(raf);
        cancelAnimationFrame(instant);
      };
    }
    const start = performance.now();
    const duration = 650;
    let frame = requestAnimationFrame(function tick(now) {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - progress) ** 3;
      setShown(Math.round(from + (value - from) * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    });
    return () => {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(frame);
    };
  }, [value, reducedMotion]);

  return (
    <span
      key={flash?.key}
      data-testid={testId}
      data-value={value}
      className={`rounded px-1 tabular-nums ${flash === null ? '' : flash.up ? 'money-up' : 'money-down'}`}
    >
      {i18n.money(shown)}
    </span>
  );
}
