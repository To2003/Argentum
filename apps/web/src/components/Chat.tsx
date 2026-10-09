import { CHAT_MAX_LENGTH, EMOTES } from '@gran-negocio/shared';
import { useEffect, useRef, useState } from 'react';
import { t } from '../i18n.js';
import { useGame } from '../store/game.js';
import { Button } from './ui.js';

/**
 * El chat de la sala (SPEC.md §7.4, M9): texto libre y reacciones rápidas.
 * Escriben los que tienen asiento (también los quebrados); los espectadores
 * solo leen.
 */
export function Chat({ canWrite }: { canWrite: boolean }) {
  const messages = useGame((state) => state.chat);
  const sendChat = useGame((state) => state.sendChat);
  const [text, setText] = useState('');
  const list = useRef<HTMLOListElement>(null);

  useEffect(() => {
    // Lo último a la vista, sin mover la página entera.
    const element = list.current;
    if (element !== null) element.scrollTop = element.scrollHeight;
  }, [messages]);

  return (
    <section
      aria-labelledby="chat-title"
      className="rounded-xl bg-superficie p-3"
      data-testid="chat"
    >
      <h2 id="chat-title" className="mb-2 font-display text-base font-extrabold">
        {t('chat.title')}
      </h2>
      {messages.length === 0 ? (
        <p className="text-sm text-tinta/70">{t('chat.empty')}</p>
      ) : (
        <ol
          ref={list}
          aria-live="polite"
          aria-relevant="additions"
          className="max-h-48 space-y-1 overflow-y-auto text-sm"
          data-testid="chat-messages"
        >
          {messages.map((message) => (
            <li key={message.id} className="break-words">
              <span className="font-bold">{message.name}:</span>{' '}
              {message.emote !== null ? (
                <span className="font-display font-extrabold">{t(`emote.${message.emote}`)}</span>
              ) : (
                message.text
              )}
            </li>
          ))}
        </ol>
      )}
      {canWrite ? (
        <>
          <div className="mt-2 flex flex-wrap gap-1" role="group" aria-label={t('chat.emotes')}>
            {EMOTES.map((emote) => (
              <button
                key={emote}
                type="button"
                data-emote={emote}
                onClick={() => {
                  void sendChat({ emote });
                }}
                className="rounded-full bg-celeste-claro px-2.5 py-1 text-xs font-bold text-ink hover:brightness-95"
              >
                {t(`emote.${emote}`)}
              </button>
            ))}
          </div>
          <form
            className="mt-2 flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const trimmed = text.trim();
              if (trimmed.length === 0) return;
              void sendChat({ text: trimmed });
              setText('');
            }}
          >
            <label className="sr-only" htmlFor="chat-input">
              {t('chat.placeholder')}
            </label>
            <input
              id="chat-input"
              value={text}
              maxLength={CHAT_MAX_LENGTH}
              autoComplete="off"
              placeholder={t('chat.placeholder')}
              onChange={(event) => {
                setText(event.target.value);
              }}
              className="min-w-0 flex-1 rounded-lg border-2 border-tinta/25 bg-papel px-2 py-1.5 text-sm"
            />
            <Button type="submit" className="px-3 py-1.5 text-sm" disabled={text.trim() === ''}>
              {t('chat.send')}
            </Button>
          </form>
        </>
      ) : (
        <p className="mt-2 text-sm text-tinta/70">{t('chat.spectatorHint')}</p>
      )}
    </section>
  );
}
