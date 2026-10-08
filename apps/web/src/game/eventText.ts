import type { GameEvent, PlayerView } from '@gran-negocio/engine';
import { BOARD, cardById, isOwnable, tileAt, type Translator } from '@gran-negocio/shared';

/**
 * El texto de cada evento para el registro (SPEC.md §7.4). Devuelve null para
 * los que no vale la pena mostrar (los pasos internos que ya cuenta otro
 * evento, como `landed` o `purchaseOffered`).
 */
export function eventText(event: GameEvent, view: PlayerView, i18n: Translator): string | null {
  const { t } = i18n;
  const name = (id: string) => view.players.find((player) => player.id === id)?.name ?? id;
  const party = (id: string) =>
    id === 'bank' ? t('party.bank') : id === 'pot' ? t('party.pot') : name(id);
  const tile = (index: number) => {
    const found = BOARD[index];
    return found === undefined ? String(index) : i18n.tileName(found, view.rules.useRealBrands);
  };
  const lot = (lotValue: {
    kind: 'property' | 'building';
    tile: number;
    building?: 'house' | 'hotel';
  }) =>
    lotValue.kind === 'property'
      ? tile(lotValue.tile)
      : t(lotValue.building === 'hotel' ? 'building.hotel' : 'building.house');

  switch (event.type) {
    case 'turnOrderDecided':
      return t('event.turnOrder', { order: event.order.map(name).join(', ') });
    case 'turnStarted':
      return t('event.turnStarted', { name: name(event.playerId) });
    case 'roundStarted':
      return t('event.round', { round: event.round });
    case 'diceRolled': {
      if (event.reason === 'turnOrder') return null;
      const [a, b] = event.dice;
      const key =
        a === b && event.reason === 'move' ? 'event.diceRolledDoubles' : 'event.diceRolled';
      return t(key, { name: name(event.playerId), a, b });
    }
    case 'moved':
      return t('event.moved', { name: name(event.playerId), tile: tile(event.to) });
    case 'moneyTransferred': {
      const amount = i18n.money(event.amount);
      if (event.reason === 'salary') return t('event.salary', { name: party(event.to), amount });
      if (event.reason === 'rent') {
        return t('event.rent', { payer: party(event.from), payee: party(event.to), amount });
      }
      if (event.reason === 'pot')
        return t('event.potCollected', { payee: party(event.to), amount });
      // La compra ya la cuenta propertyBought; la subasta, auctionClosed.
      if (event.reason === 'purchase' || event.reason === 'auction') return null;
      if (event.to === 'bank' || event.to === 'pot') {
        return t('event.paidBank', { payer: party(event.from), amount });
      }
      if (event.from === 'bank') return t('event.receivedBank', { payee: party(event.to), amount });
      return t('event.transfer', { payer: party(event.from), payee: party(event.to), amount });
    }
    case 'propertyBought': {
      const found = tileAt(event.tile);
      const price = isOwnable(found) ? found.price : 0;
      return t('event.bought', {
        name: name(event.playerId),
        tile: tile(event.tile),
        amount: i18n.money(price),
      });
    }
    case 'purchaseDeclined':
      return t('event.declined', { name: name(event.playerId), tile: tile(event.tile) });
    case 'cardDrawn': {
      const card = cardById(event.cardId);
      return t('event.cardDrawn', {
        name: name(event.playerId),
        deck: t(event.deck === 'chance' ? 'deck.chance' : 'deck.community'),
        text: i18n.cardText(card, view.rules),
      });
    }
    case 'sentToJail':
      return t('event.jail', { name: name(event.playerId) });
    case 'leftJail':
      return t('event.leftJail', { name: name(event.playerId) });
    case 'jailRollFailed':
      return t('event.jailFailed', { name: name(event.playerId) });
    case 'debtOpened':
      return t('event.debt', { name: name(event.debtorId), amount: i18n.money(event.amount) });
    case 'debtPaid':
      return t('event.debtPaid', { name: name(event.debtorId) });
    case 'playerBankrupt':
      return t('event.bankrupt', { name: name(event.playerId) });
    case 'auctionOpened':
      return t('event.auctionOpened', { lot: lot(event.lot) });
    case 'bidPlaced':
      return t('event.bid', { name: name(event.playerId), amount: i18n.money(event.amount) });
    case 'auctionPassed':
      return t('event.auctionPassed', { name: name(event.playerId) });
    case 'auctionClosed':
      return event.winnerId === null
        ? t('event.auctionUnsold', { lot: lot(event.lot) })
        : t('event.auctionWon', {
            name: name(event.winnerId),
            lot: lot(event.lot),
            amount: i18n.money(event.amount),
          });
    case 'buildingBuilt':
      return t('event.built', { name: name(event.playerId), tile: tile(event.tile) });
    case 'buildingSold':
      return t('event.sold', { name: name(event.playerId), tile: tile(event.tile) });
    case 'propertyMortgaged':
      return t('event.mortgaged', { name: name(event.playerId), tile: tile(event.tile) });
    case 'propertyUnmortgaged':
      return t('event.unmortgaged', { name: name(event.playerId), tile: tile(event.tile) });
    case 'propertyTransferred':
      return event.to === 'bank'
        ? null
        : t('event.propertyTransferred', { tile: tile(event.tile), name: name(event.to) });
    case 'tradeProposed':
      return t('event.tradeProposed', { from: name(event.from), to: name(event.to) });
    case 'tradeAccepted':
      return t('event.tradeAccepted');
    case 'tradeClosed':
      return t('event.tradeClosed');
    case 'gameOver':
      return event.winnerId === null
        ? t('event.gameOverNone')
        : t('event.gameOver', { name: name(event.winnerId) });
    case 'landed':
    case 'purchaseOffered':
    case 'jailFreeCardKept':
    case 'jailFreeCardTransferred':
    case 'turnEnded':
      return null;
  }
}
