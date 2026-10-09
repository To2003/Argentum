import { useSoundSettings } from '../audio/settings.js';
import { syncMusic } from '../audio/synth.js';
import { t } from '../i18n.js';
import { BOARD_THEMES, MODES, useLook } from '../look.js';
import { LanguagePicker } from './LanguagePicker.js';
import { Dialog } from './ui.js';

/** Ajustes (SPEC.md §7.1, §7.6): sonido, tema del tablero y colores de la app. */
export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const sound = useSoundSettings();
  const look = useLook();
  return (
    <Dialog title={t('settings.open')} onClose={onClose}>
      <fieldset className="mb-5">
        <legend className="mb-2 font-display text-lg font-extrabold">
          {t('settings.language')}
        </legend>
        <LanguagePicker />
      </fieldset>
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

      <fieldset className="mt-5 flex flex-col gap-2">
        <legend className="mb-2 font-display text-lg font-extrabold">{t('settings.theme')}</legend>
        {BOARD_THEMES.map((theme) => (
          <label key={theme} className="flex items-center gap-2">
            <input
              type="radio"
              name="board-theme"
              checked={look.boardTheme === theme}
              onChange={() => {
                look.update({ boardTheme: theme });
              }}
            />
            {t(`theme.${theme}`)}
          </label>
        ))}
      </fieldset>

      <fieldset className="mt-5 flex flex-col gap-2">
        <legend className="mb-2 font-display text-lg font-extrabold">{t('settings.mode')}</legend>
        {MODES.map((mode) => (
          <label key={mode} className="flex items-center gap-2">
            <input
              type="radio"
              name="app-mode"
              checked={look.mode === mode}
              onChange={() => {
                look.update({ mode });
              }}
            />
            {t(`settings.mode.${mode}`)}
          </label>
        ))}
      </fieldset>
    </Dialog>
  );
}
