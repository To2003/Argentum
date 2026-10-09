import { useState } from 'react';
import { useNavigate } from 'react-router';
import { LanguagePicker } from '../components/LanguagePicker.js';
import { Tutorial } from '../components/Tutorial.js';
import { Button } from '../components/ui.js';
import { errorText } from '../game/errorText.js';
import { t } from '../i18n.js';
import { loadName, saveName } from '../net/session.js';
import { useGame } from '../store/game.js';

/** Inicio (SPEC.md §7.4.1): crear una sala o entrar con un código. */
export function Landing() {
  const navigate = useNavigate();
  const create = useGame((state) => state.create);
  const join = useGame((state) => state.join);
  const [name, setName] = useState(loadName);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tutorial, setTutorial] = useState(false);

  const go = async (attempt: () => Promise<{ code: string } | string>) => {
    setBusy(true);
    setError(null);
    saveName(name.trim());
    const result = await attempt().catch(() => 'generic');
    setBusy(false);
    if (typeof result === 'string') setError(errorText(result));
    else void navigate(`/sala/${result.code}`);
  };

  const validName = name.trim().length > 0;

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-8 px-4 py-10">
      <header>
        <LanguagePicker className="mb-6 justify-end" />
        <h1 className="font-display text-[clamp(3rem,13vw,6.5rem)] font-extrabold leading-[0.85] tracking-[-0.04em]">
          El Gran <br />
          Negocio
        </h1>
        <p className="mt-4 max-w-prose text-lg text-tinta/80">{t('app.tagline')}</p>
      </header>

      <form
        className="flex flex-col gap-4 rounded-2xl bg-superficie p-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (validName) void go(() => create(name.trim()));
        }}
      >
        <label className="flex flex-col gap-1 font-bold">
          {t('landing.nameLabel')}
          <input
            value={name}
            maxLength={20}
            autoComplete="nickname"
            placeholder={t('landing.namePlaceholder')}
            onChange={(event) => {
              setName(event.target.value);
            }}
            className="rounded-xl border-2 border-tinta/25 px-3 py-2 text-lg font-normal"
          />
        </label>
        <Button type="submit" disabled={!validName || busy}>
          {t('landing.create')}
        </Button>
        <p className="text-center text-tinta/60">{t('landing.or')}</p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-1 flex-col gap-1 font-bold">
            {t('landing.codeLabel')}
            <input
              value={code}
              maxLength={6}
              autoCapitalize="characters"
              placeholder={t('landing.codePlaceholder')}
              onChange={(event) => {
                setCode(event.target.value.toUpperCase());
              }}
              className="rounded-xl border-2 border-tinta/25 px-3 py-2 text-lg font-normal tracking-[0.2em] uppercase"
            />
          </label>
          <Button
            variant="secondary"
            disabled={!validName || code.trim().length !== 6 || busy}
            onClick={() => {
              void go(() => join(code.trim(), name.trim()));
            }}
          >
            {t('landing.join')}
          </Button>
        </div>
        {error !== null && (
          <p role="alert" className="font-bold text-fileteado">
            {error}
          </p>
        )}
      </form>

      <section>
        <h2 className="font-display text-xl font-extrabold">{t('landing.rulesTitle')}</h2>
        <p className="mt-1 max-w-prose text-tinta/80">{t('landing.rulesBody')}</p>
        <Button
          variant="secondary"
          className="mt-3"
          data-testid="open-tutorial"
          onClick={() => {
            setTutorial(true);
          }}
        >
          {t('tutorial.open')}
        </Button>
        <p className="mt-6 text-sm text-tinta/60">{t('landing.disclaimer')}</p>
      </section>
      {tutorial && (
        <Tutorial
          onClose={() => {
            setTutorial(false);
          }}
        />
      )}
    </main>
  );
}
