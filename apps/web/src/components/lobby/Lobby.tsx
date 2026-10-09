import { BOT_DIFFICULTIES } from '@gran-negocio/engine';
import { MIN_PLAYERS, TOKENS } from '@gran-negocio/shared';
import { useState } from 'react';
import { t } from '../../i18n.js';
import { useGame } from '../../store/game.js';
import { Button, TokenBadge } from '../ui.js';
import { RulesForm } from './RulesForm.js';

/** La sala antes de empezar (SPEC.md §7.4.2). */
export function Lobby() {
  const room = useGame((state) => state.room);
  const session = useGame((state) => state.session);
  const { setToken, setReady, setRules, start, leave, addBot, removeBot } = useGame.getState();
  const [copied, setCopied] = useState(false);
  if (room === null || session === null) return null;

  const me = room.seats.find((seat) => seat.playerId === session.playerId);
  const isHost = room.hostId === session.playerId;
  const host = room.seats.find((seat) => seat.playerId === room.hostId);
  const link = `${window.location.origin}/sala/${room.code}`;
  const everyoneReady = room.seats.every((seat) => seat.ready || seat.playerId === room.hostId);
  const canStart = room.seats.length >= MIN_PLAYERS && everyoneReady;

  return (
    <main className="mx-auto grid max-w-5xl gap-6 p-4 md:grid-cols-2">
      <section className="flex flex-col gap-4">
        <div>
          <p className="text-tinta/70">{t('lobby.share')}</p>
          <p
            className="font-display text-6xl font-extrabold tracking-[0.12em]"
            data-testid="room-code"
          >
            {room.code}
          </p>
          <Button
            variant="secondary"
            className="mt-2"
            onClick={() => {
              // Sin permiso o en un contexto inseguro no hay portapapeles: el código igual se ve.
              navigator.clipboard
                .writeText(link)
                .then(() => {
                  setCopied(true);
                })
                .catch(() => undefined);
            }}
          >
            {copied ? t('lobby.copied') : t('lobby.copyLink')}
          </Button>
        </div>

        <div>
          <h2 className="mb-2 font-display text-xl font-extrabold">
            {t('lobby.playerCount', { count: room.seats.length })}
          </h2>
          <ul className="flex flex-col gap-2">
            {room.seats.map((seat) => {
              const token = TOKENS.find((tk) => tk.id === seat.tokenId);
              return (
                <li
                  key={seat.playerId}
                  className="flex items-center gap-3 rounded-xl bg-superficie p-3"
                >
                  {token === undefined ? (
                    <span className="h-6 w-6 rounded-full border-2 border-dashed border-tinta/30" />
                  ) : (
                    <TokenBadge
                      color={token.color}
                      tokenId={token.id}
                      label={t(`token.${token.id}`)}
                    />
                  )}
                  <span className="font-bold">{seat.name}</span>
                  <span className="text-sm text-tinta/60">
                    {seat.playerId === room.hostId && t('lobby.host')}
                    {seat.playerId === session.playerId && ` ${t('lobby.you')}`}
                    {seat.bot !== null &&
                      t('bot.label', { difficulty: t(`bot.${seat.bot}`).toLowerCase() })}
                    {!seat.connected && seat.bot === null && ` ${t('lobby.disconnected')}`}
                  </span>
                  <span
                    className={`ml-auto text-sm font-bold ${seat.ready || seat.playerId === room.hostId ? 'text-ganancia' : 'text-tinta/50'}`}
                  >
                    {seat.ready || seat.playerId === room.hostId
                      ? t('lobby.ready')
                      : t('lobby.notReady')}
                  </span>
                  {isHost && seat.bot !== null && (
                    <Button
                      variant="quiet"
                      className="px-2 py-1 text-sm"
                      onClick={() => {
                        void removeBot(seat.playerId);
                      }}
                    >
                      {t('lobby.removeBot')}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
          {isHost && room.seats.length < room.rules.maxPlayers && (
            <div className="mt-3 flex flex-wrap items-center gap-2" data-testid="add-bot">
              <span className="font-bold">{t('lobby.addBot')}</span>
              {BOT_DIFFICULTIES.map((difficulty) => (
                <Button
                  key={difficulty}
                  variant="secondary"
                  className="px-3 py-1.5 text-sm"
                  data-bot={difficulty}
                  onClick={() => {
                    void addBot(difficulty);
                  }}
                >
                  {t(`bot.${difficulty}`)}
                </Button>
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 className="mb-2 font-display text-xl font-extrabold">{t('lobby.chooseToken')}</h2>
          <div
            className="flex flex-wrap gap-2"
            role="radiogroup"
            aria-label={t('lobby.chooseToken')}
          >
            {TOKENS.map((token) => {
              const owner = room.seats.find((seat) => seat.tokenId === token.id);
              const taken = owner !== undefined && owner.playerId !== session.playerId;
              const chosen = me?.tokenId === token.id;
              return (
                <button
                  key={token.id}
                  type="button"
                  role="radio"
                  aria-checked={chosen}
                  disabled={taken}
                  onClick={() => {
                    void setToken(token.id);
                  }}
                  className={`flex items-center gap-2 rounded-full px-3 py-1.5 ring-2 disabled:opacity-40 ${chosen ? 'bg-superficie ring-tinta' : 'bg-superficie/60 ring-transparent'}`}
                >
                  <TokenBadge
                    color={token.color}
                    tokenId={token.id}
                    label={t(`token.${token.id}`)}
                  />
                  {t(`token.${token.id}`)}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {isHost ? (
            <Button
              data-testid="start"
              disabled={!canStart}
              onClick={() => {
                void start();
              }}
            >
              {t('lobby.start')}
            </Button>
          ) : (
            <Button
              data-testid="ready"
              variant={me?.ready === true ? 'secondary' : 'primary'}
              onClick={() => {
                void setReady(me?.ready !== true);
              }}
            >
              {me?.ready === true ? t('lobby.unsetReady') : t('lobby.setReady')}
            </Button>
          )}
          <Button
            variant="quiet"
            onClick={() => {
              void leave().then(() => {
                window.location.assign('/');
              });
            }}
          >
            {t('room.leave')}
          </Button>
        </div>
        <p className="text-sm text-tinta/70">
          {room.seats.length < MIN_PLAYERS
            ? t('lobby.needPlayers')
            : !everyoneReady
              ? t('lobby.waitingReady')
              : !isHost && host !== undefined
                ? t('lobby.waitingHost', { name: host.name })
                : ''}
        </p>
      </section>

      <section className="rounded-2xl bg-superficie p-5">
        <h2 className="mb-3 font-display text-xl font-extrabold">{t('lobby.rules')}</h2>
        <RulesForm
          rules={room.rules}
          editable={isHost}
          onChange={(overrides) => {
            void setRules(overrides);
          }}
        />
      </section>
    </main>
  );
}
