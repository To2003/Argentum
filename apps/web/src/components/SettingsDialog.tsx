import { useSoundSettings } from '../audio/settings.js';
import { syncMusic } from '../audio/synth.js';
import { t } from '../i18n.js';
import { Dialog } from './ui.js';

/** Ajustes (SPEC.md §7.1, §7.6): sonido y, desde el commit de temas, el tablero y los colores. */
export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const sound = useSoundSettings();
  return (
    <Dialog title={t('settings.open')} onClose={onClose}>
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 font-display text-lg font-extrabold">{t('settings.sound')}</legend>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={sound.muted}
            onChange={(event) => {
              sound.update({ muted: event.target.checked });
            }}
          />
          {t('settings.mute')}
        </label>
        <label className="flex flex-col gap-1">
          {t('settings.effects')}
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={sound.sfxVolume}
            disabled={sound.muted}
            onChange={(event) => {
              sound.update({ sfxVolume: Number(event.target.value) });
            }}
          />
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={sound.musicOn}
            disabled={sound.muted}
            onChange={(event) => {
              sound.update({ musicOn: event.target.checked });
              // Prenderla es un gesto del usuario: el navegador permite arrancar el audio.
              syncMusic();
            }}
          />
          {t('settings.music')}
        </label>
        <label className="flex flex-col gap-1">
          {t('settings.musicVolume')}
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={sound.musicVolume}
            disabled={sound.muted || !sound.musicOn}
            onChange={(event) => {
              sound.update({ musicVolume: Number(event.target.value) });
            }}
          />
        </label>
      </fieldset>
    </Dialog>
  );
}
