import { useSoundSettings } from './settings.js';

/**
 * Efectos y música sintetizados con Web Audio (ADR 0007): sin archivos ni
 * licencias. El contexto se crea con el primer sonido, que siempre viene
 * después de un gesto del usuario (los navegadores bloquean el audio antes).
 */
export type SoundName =
  'dice' | 'step' | 'cash' | 'pay' | 'card' | 'hammer' | 'jail' | 'build' | 'victory';

let context: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === 'undefined' || typeof window.AudioContext !== 'function') return null;
  context ??= new window.AudioContext();
  if (context.state === 'suspended') void context.resume();
  return context;
}

function tone(
  ctx: AudioContext,
  {
    frequency,
    to,
    type = 'sine',
    start = 0,
    duration,
    gain,
  }: {
    frequency: number;
    to?: number;
    type?: OscillatorType;
    start?: number;
    duration: number;
    gain: number;
  },
  out: AudioNode,
): void {
  const at = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, at);
  if (to !== undefined) osc.frequency.exponentialRampToValueAtTime(to, at + duration);
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(gain, at + 0.01);
  env.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  osc.connect(env).connect(out);
  osc.start(at);
  osc.stop(at + duration + 0.02);
}

function noise(
  ctx: AudioContext,
  {
    start = 0,
    duration,
    gain,
    filter,
  }: { start?: number; duration: number; gain: number; filter: number },
  out: AudioNode,
): void {
  const at = ctx.currentTime + start;
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = filter;
  const env = ctx.createGain();
  env.gain.setValueAtTime(gain, at);
  env.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  source.connect(band).connect(env).connect(out);
  source.start(at);
}

const RECIPES: Record<SoundName, (ctx: AudioContext, out: AudioNode) => void> = {
  dice: (ctx, out) => {
    for (let i = 0; i < 5; i += 1)
      noise(ctx, { start: i * 0.07, duration: 0.05, gain: 0.5, filter: 2500 + i * 300 }, out);
  },
  step: (ctx, out) => {
    tone(ctx, { frequency: 520, to: 380, duration: 0.06, gain: 0.15, type: 'triangle' }, out);
  },
  cash: (ctx, out) => {
    tone(ctx, { frequency: 988, duration: 0.12, gain: 0.25 }, out);
    tone(ctx, { frequency: 1319, start: 0.08, duration: 0.25, gain: 0.25 }, out);
  },
  pay: (ctx, out) => {
    tone(ctx, { frequency: 660, to: 330, duration: 0.25, gain: 0.2, type: 'triangle' }, out);
  },
  card: (ctx, out) => {
    noise(ctx, { duration: 0.25, gain: 0.35, filter: 5000 }, out);
  },
  hammer: (ctx, out) => {
    tone(ctx, { frequency: 140, to: 60, duration: 0.25, gain: 0.6 }, out);
    noise(ctx, { duration: 0.08, gain: 0.4, filter: 900 }, out);
  },
  jail: (ctx, out) => {
    tone(ctx, { frequency: 220, duration: 0.4, gain: 0.18, type: 'square' }, out);
    tone(ctx, { frequency: 233, duration: 0.4, gain: 0.18, type: 'square' }, out);
  },
  build: (ctx, out) => {
    tone(ctx, { frequency: 300, to: 900, duration: 0.12, gain: 0.25 }, out);
  },
  victory: (ctx, out) => {
    [523, 659, 784, 1047].forEach((frequency, i) => {
      tone(ctx, { frequency, start: i * 0.12, duration: 0.35, gain: 0.25, type: 'triangle' }, out);
    });
  },
};

/** Toca un efecto con el volumen de la configuración. Sin Web Audio (tests, navegadores viejos), no hace nada. */
export function play(name: SoundName): void {
  const { muted, sfxVolume } = useSoundSettings.getState();
  if (muted || sfxVolume === 0) return;
  const ctx = audio();
  if (ctx === null) return;
  const out = ctx.createGain();
  out.gain.value = sfxVolume;
  out.connect(ctx.destination);
  RECIPES[name](ctx, out);
}

// ---------------------------------------------------------------- música

/** Una progresión suave (La menor, Fa, Do, Sol) en acordes largos de onda triangular. */
const CHORDS: readonly (readonly number[])[] = [
  [220, 261.63, 329.63],
  [174.61, 220, 261.63],
  [261.63, 329.63, 392],
  [196, 246.94, 293.66],
];
const BAR_SECONDS = 4;

let music: { gain: GainNode; timer: ReturnType<typeof setInterval> } | null = null;

/** Prende o apaga la música ambiente y ajusta su volumen. */
export function syncMusic(): void {
  const { muted, musicOn, musicVolume } = useSoundSettings.getState();
  const wanted = !muted && musicOn && musicVolume > 0;
  if (!wanted) {
    if (music !== null) {
      clearInterval(music.timer);
      music.gain.disconnect();
      music = null;
    }
    return;
  }
  const ctx = audio();
  if (ctx === null) return;
  if (music !== null) {
    music.gain.gain.value = musicVolume * 0.25;
    return;
  }
  const gain = ctx.createGain();
  gain.gain.value = musicVolume * 0.25;
  gain.connect(ctx.destination);
  let bar = 0;
  const playBar = () => {
    const chord = CHORDS[bar % CHORDS.length] ?? [];
    for (const frequency of chord) {
      tone(ctx, { frequency, duration: BAR_SECONDS, gain: 0.12, type: 'triangle' }, gain);
    }
    bar += 1;
  };
  playBar();
  music = { gain, timer: setInterval(playBar, BAR_SECONDS * 1000) };
}

useSoundSettings.subscribe(syncMusic);
