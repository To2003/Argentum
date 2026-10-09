import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { GameScreen } from '../components/game/GameScreen.js';
import { Lobby } from '../components/lobby/Lobby.js';
import { Button } from '../components/ui.js';
import { errorText } from '../game/errorText.js';
import { t } from '../i18n.js';
import { loadName, loadSession, saveName } from '../net/session.js';
import { useGame } from '../store/game.js';

/**
 * `/sala/:code`: si hay una sesión guardada para esta sala, reconecta con el
 * token; si no, pide el nombre para entrar. Después muestra el lobby o la
 * partida según el estado de la sala.
 */
export function Room() {
  const { code: raw = '' } = useParams();
  const code = raw.toUpperCase();
  const session = useGame((state) => state.session);
  const room = useGame((state) => state.room);
  const status = useGame((state) => state.status);
  const resume = useGame((state) => state.resume);
  const join = useGame((state) => state.join);
  const watch = useGame((state) => state.watch);
  const watching = useGame((state) => state.watching);
  const [name, setName] = useState(loadName);
  const [error, setError] = useState<string | null>(null);
  const saved = useMemo(() => loadSession(code), [code]);
  const [resumeFailed, setResumeFailed] = useState(false);
  const needsName = saved === null || resumeFailed;

  useEffect(() => {
    if (session?.code === code || saved === null) return;
    void resume(saved).then((ok) => {
      if (!ok) setResumeFailed(true);
    });
  }, [code, saved, session, resume]);

  if (session?.code === code && room !== null) {
    return room.status === 'lobby' ? <Lobby /> : <GameScreen />;
  }
  // Espectador (M9): la partida sin asiento.
  if (watching === code && room !== null && room.status !== 'lobby') {
    return (
      <>
        <p role="status" className="bg-celeste-claro px-4 py-2 text-center font-bold text-ink">
          {t('room.watching')}
        </p>
        <GameScreen />
      </>
    );
  }

  if (!needsName) {
    return (
      <main className="grid min-h-dvh place-items-center p-4">
        <p role="status">{t('room.connecting')}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-4">
      <h1 className="font-display text-3xl font-extrabold">{t('room.joinTitle', { code })}</h1>
      <form
        className="flex flex-col gap-3 rounded-2xl bg-superficie p-5"
        onSubmit={(event) => {
          event.preventDefault();
          saveName(name.trim());
          void join(code, name.trim()).then((result) => {
            if (typeof result === 'string') setError(errorText(result));
          });
        }}
      >
        <label className="flex flex-col gap-1 font-bold">
          {t('landing.nameLabel')}
          <input
            value={name}
            maxLength={20}
            placeholder={t('landing.namePlaceholder')}
            onChange={(event) => {
              setName(event.target.value);
            }}
            className="rounded-xl border-2 border-tinta/25 px-3 py-2 text-lg font-normal"
          />
        </label>
        <Button type="submit" disabled={name.trim().length === 0 || status === 'connecting'}>
          {t('room.joinButton')}
        </Button>
        {error !== null && (
          <p role="alert" className="font-bold text-fileteado">
            {error}
          </p>
        )}
        <p className="text-sm text-tinta/70">{t('room.watchHint')}</p>
        <Button
          variant="secondary"
          data-testid="watch"
          disabled={status === 'connecting'}
          onClick={() => {
            setError(null);
            void watch(code).then((failure) => {
              if (failure !== null) setError(errorText(failure));
            });
          }}
        >
          {t('room.watch')}
        </Button>
      </form>
      <Link to="/" className="text-center underline">
        {t('notFound.back')}
      </Link>
    </main>
  );
}
