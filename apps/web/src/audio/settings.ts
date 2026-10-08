import { create } from 'zustand';

/**
 * Preferencias de sonido (SPEC.md §7.6): efectos y música con volumen
 * separado y silencio persistido. La música arranca apagada: nadie quiere
 * que una pestaña empiece a sonar sola.
 */
export interface SoundSettings {
  muted: boolean;
  sfxVolume: number;
  musicOn: boolean;
  musicVolume: number;
}

const KEY = 'gran-negocio:sound';
const DEFAULTS: SoundSettings = { muted: false, sfxVolume: 0.7, musicOn: false, musicVolume: 0.35 };

const clamp = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback;

export function loadSoundSettings(): SoundSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === null) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<SoundSettings>;
    return {
      muted: parsed.muted === true,
      sfxVolume: clamp(parsed.sfxVolume, DEFAULTS.sfxVolume),
      musicOn: parsed.musicOn === true,
      musicVolume: clamp(parsed.musicVolume, DEFAULTS.musicVolume),
    };
  } catch {
    return DEFAULTS;
  }
}

function save(settings: SoundSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Sin storage, la preferencia dura lo que la pestaña.
  }
}

export const useSoundSettings = create<
  SoundSettings & { update: (patch: Partial<SoundSettings>) => void }
>()((set, get) => ({
  ...loadSoundSettings(),
  update: (patch) => {
    const { update: _update, ...current } = get();
    const next = { ...current, ...patch };
    save(next);
    set(next);
  },
}));
