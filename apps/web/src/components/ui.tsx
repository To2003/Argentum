import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { t } from '../i18n.js';

type Variant = 'primary' | 'secondary' | 'danger' | 'quiet';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-sol text-tinta hover:brightness-95 shadow-[0_2px_0_0_rgba(20,40,58,0.35)]',
  secondary: 'bg-white text-tinta ring-2 ring-tinta/80 hover:bg-celeste-claro',
  danger: 'bg-fileteado text-white hover:brightness-110',
  quiet: 'bg-transparent text-tinta underline-offset-4 hover:underline',
};

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      className={`rounded-xl px-4 py-2.5 font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}

/**
 * Un diálogo modal accesible (el `<dialog>` nativo: foco, Escape y fondo).
 * En celular ocupa toda la pantalla (SPEC.md §7.7).
 */
export function Dialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    // Sin cleanup que lo cierre: al desmontarse, el elemento sale del DOM y se
    // va con él. Cerrarlo a mano disparaba `onClose` y, con los efectos dobles
    // de StrictMode, el diálogo se cerraba apenas se abría.
    const dialog = ref.current;
    if (dialog !== null && !dialog.open) dialog.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={onClose}
      onCancel={onClose}
      className="m-0 h-dvh max-h-none w-full max-w-none bg-papel p-0 text-tinta backdrop:bg-tinta/50 sm:m-auto sm:h-auto sm:max-h-[90dvh] sm:max-w-md sm:rounded-2xl"
    >
      <div className="flex items-center justify-between gap-4 border-b border-tinta/10 px-5 py-4">
        <h2 className="font-display text-xl font-extrabold">{title}</h2>
        <Button variant="quiet" onClick={onClose}>
          {t('action.close')}
        </Button>
      </div>
      <div className="px-5 py-4">{children}</div>
    </dialog>
  );
}

const PIPS: Record<number, readonly [number, number][]> = {
  1: [[50, 50]],
  2: [
    [28, 28],
    [72, 72],
  ],
  3: [
    [28, 28],
    [50, 50],
    [72, 72],
  ],
  4: [
    [28, 28],
    [72, 28],
    [28, 72],
    [72, 72],
  ],
  5: [
    [28, 28],
    [72, 28],
    [50, 50],
    [28, 72],
    [72, 72],
  ],
  6: [
    [28, 26],
    [72, 26],
    [28, 50],
    [72, 50],
    [28, 74],
    [72, 74],
  ],
};

/** Un dado 2D (los dados 3D llegan en M6 con este como fallback). */
export function Die({ value, size = 40 }: { value: number; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={String(value)}>
      <rect
        x="4"
        y="4"
        width="92"
        height="92"
        rx="18"
        fill="#fff"
        stroke="#14283a"
        strokeWidth="5"
      />
      {(PIPS[value] ?? []).map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="9" fill="#14283a" />
      ))}
    </svg>
  );
}

/** La ficha de un jugador: un disco de su color con la inicial de la ficha. */
export function TokenBadge({
  color,
  label,
  size = '1.5rem',
  active = false,
}: {
  color: string;
  label: string;
  size?: string;
  active?: boolean;
}) {
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={`inline-grid shrink-0 place-items-center rounded-full font-bold text-white ${active ? 'ring-2 ring-sol ring-offset-1' : ''}`}
      style={{ backgroundColor: color, width: size, height: size, fontSize: `calc(${size} * 0.5)` }}
    >
      {label.slice(0, 1)}
    </span>
  );
}
