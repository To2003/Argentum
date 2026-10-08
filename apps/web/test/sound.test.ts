import { describe, expect, it } from 'vitest';
import { loadSoundSettings, useSoundSettings } from '../src/audio/settings.js';
import { play, syncMusic } from '../src/audio/synth.js';

describe('sonido', () => {
  it('sin Web Audio (jsdom), tocar efectos y música no rompe', () => {
    expect(() => {
      play('dice');
      useSoundSettings.getState().update({ musicOn: true });
      syncMusic();
    }).not.toThrow();
  });

  it('las preferencias se guardan y se vuelven a leer, acotadas a 0–1', () => {
    useSoundSettings.getState().update({ muted: true, sfxVolume: 0.2 });
    expect(loadSoundSettings()).toMatchObject({ muted: true, sfxVolume: 0.2 });
    localStorage.setItem('gran-negocio:sound', JSON.stringify({ sfxVolume: 7, musicVolume: 'x' }));
    expect(loadSoundSettings()).toMatchObject({ sfxVolume: 1, musicVolume: 0.35, muted: false });
    localStorage.setItem('gran-negocio:sound', '{roto');
    expect(loadSoundSettings().sfxVolume).toBe(0.7);
  });
});
