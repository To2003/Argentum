import { create } from 'zustand';

/**
 * El aspecto (SPEC.md §7.1): tema del tablero y colores de la app (claro,
 * oscuro o como el sistema). Se guarda en el navegador; sin storage, vale lo
 * que dura la pestaña.
 */
export const BOARD_THEMES = ['classic', 'night', 'topo'] as const;
export type BoardTheme = (typeof BOARD_THEMES)[number];
export const MODES = ['system', 'light', 'dark'] as const;
export type Mode = (typeof MODES)[number];

const KEY = 'gran-negocio:look';

interface Look {
  boardTheme: BoardTheme;
  mode: Mode;
}

function load(): Look {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Look>;
    return {
      boardTheme: BOARD_THEMES.includes(parsed.boardTheme as BoardTheme)
        ? (parsed.boardTheme as BoardTheme)
        : 'classic',
      mode: MODES.includes(parsed.mode as Mode) ? (parsed.mode as Mode) : 'system',
    };
  } catch {
    return { boardTheme: 'classic', mode: 'system' };
  }
}

/** Aplica el modo al `<html>` (el CSS redefine los colores con `data-mode`). */
export function applyMode(mode: Mode): void {
  if (mode === 'system') delete document.documentElement.dataset['mode'];
  else document.documentElement.dataset['mode'] = mode;
}

export const useLook = create<Look & { update: (patch: Partial<Look>) => void }>()((set, get) => ({
  ...load(),
  update: (patch) => {
    const next: Look = { boardTheme: get().boardTheme, mode: get().mode, ...patch };
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // Solo una comodidad.
    }
    applyMode(next.mode);
    set(next);
  },
}));
