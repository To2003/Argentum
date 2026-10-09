import type { GameEvent } from '@gran-negocio/engine';

/**
 * Categorías del filtro del registro (SPEC.md §7.4: "log de eventos
 * filtrable"). El `switch` es exhaustivo: un evento nuevo del engine no compila
 * hasta que se le asigne una.
 */
export const EVENT_CATEGORIES = ['money', 'properties', 'cards', 'turns'] as const;
export type EventCategory = (typeof EVENT_CATEGORIES)[number];

export function eventCategory(event: GameEvent): EventCategory {
  switch (event.type) {
    case 'moneyTransferred':
    case 'debtOpened':
    case 'debtPaid':
    case 'playerBankrupt':
      return 'money';
    case 'purchaseOffered':
    case 'propertyBought':
    case 'purchaseDeclined':
    case 'auctionOpened':
    case 'bidPlaced':
    case 'auctionPassed':
    case 'auctionClosed':
    case 'buildingBuilt':
    case 'buildingSold':
    case 'propertyMortgaged':
    case 'propertyUnmortgaged':
    case 'propertyTransferred':
    case 'tradeProposed':
    case 'tradeAccepted':
    case 'tradeClosed':
      return 'properties';
    case 'cardDrawn':
    case 'jailFreeCardKept':
    case 'jailFreeCardTransferred':
      return 'cards';
    case 'diceRolled':
    case 'turnOrderDecided':
    case 'turnStarted':
    case 'moved':
    case 'landed':
    case 'sentToJail':
    case 'leftJail':
    case 'jailRollFailed':
    case 'turnEnded':
    case 'roundStarted':
    case 'gameOver':
      return 'turns';
  }
}
