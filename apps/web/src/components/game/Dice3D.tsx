import type { CSSProperties } from 'react';
import { Die } from '../ui.js';

/** Rotación que deja cada cara de frente (1 adelante, 6 atrás, 3/4 a los lados, 5/2 arriba y abajo). */
const FINAL: Readonly<Record<number, string>> = {
  1: 'rotateX(0deg) rotateY(0deg)',
  2: 'rotateX(90deg) rotateY(0deg)',
  3: 'rotateX(0deg) rotateY(-90deg)',
  4: 'rotateX(0deg) rotateY(90deg)',
  5: 'rotateX(-90deg) rotateY(0deg)',
  6: 'rotateX(0deg) rotateY(180deg)',
};

/** Dónde va cada cara en el cubo. */
const FACES: readonly (readonly [number, string])[] = [
  [1, 'rotateY(0deg)'],
  [6, 'rotateY(180deg)'],
  [3, 'rotateY(90deg)'],
  [4, 'rotateY(-90deg)'],
  [5, 'rotateX(90deg)'],
  [2, 'rotateX(-90deg)'],
];

/**
 * Un dado 3D hecho con transformaciones CSS (ADR 0007): no necesita WebGL.
 * Rueda (`rolling`) y termina mostrando la cara que decidió el server. Con
 * movimiento reducido se usa el dado 2D quieto.
 */
export function Dice3D({
  value,
  rolling,
  seed,
  reducedMotion,
}: {
  value: number;
  rolling: boolean;
  /** Cambia en cada tirada para reiniciar la animación con giros distintos. */
  seed: number;
  reducedMotion: boolean;
}) {
  if (reducedMotion) return <Die value={value} />;
  const spinX = 720 + ((seed * 97) % 4) * 90;
  const spinY = 540 + ((seed * 53) % 4) * 90;
  const style = {
    '--final': FINAL[value] ?? FINAL[1],
    '--spin-x': `${spinX}deg`,
    '--spin-y': `${spinY}deg`,
    transform: FINAL[value] ?? FINAL[1],
  } as CSSProperties;
  return (
    <span className="dice3d-scene" role="img" aria-label={String(value)}>
      <span key={seed} className={`dice3d-cube ${rolling ? 'dice3d-roll' : ''}`} style={style}>
        {FACES.map(([face, rotation]) => (
          <span
            key={face}
            className="dice3d-face"
            style={{ transform: `${rotation} translateZ(3.5cqw)` }}
          >
            <Die value={face} />
          </span>
        ))}
      </span>
    </span>
  );
}
