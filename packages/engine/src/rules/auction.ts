import type { Ctx } from '../context.js';
import { activePlayers } from '../context.js';
import type {
  AuctionLot,
  Phase,
  PlayerId,
  ReadonlyGameState,
  ResumePoint,
  TileIndex,
} from '../types.js';
import { firstBuildableTile, ownableAt, propertyAt } from './checks.js';
import { transfer } from './money.js';

type AuctionPhase = Extract<Phase, { kind: 'auction' }>;

/** Dónde pondría la casa u hotel cada participante si ganara. */
export function buildingTarget(
  state: ReadonlyGameState,
  lot: Extract<AuctionLot, { kind: 'building' }>,
  playerId: PlayerId,
): TileIndex | null {
  if (playerId === lot.initiator) return lot.tile;
  return firstBuildableTile(state, playerId, lot.building);
}

/**
 * La puja mínima de un participante. Propiedad: la base de la sala o la más
 * alta + 1. Edificio: nunca menos que su precio de lista (el costo de casa de
 * su grupo) (SPEC.md §15.5).
 */
export function minBidFor(state: ReadonlyGameState, playerId: PlayerId): number | null {
  const { phase } = state;
  if (phase.kind !== 'auction' || !phase.participants.includes(playerId)) return null;
  const above = phase.highBidder === null ? 0 : phase.highBid + 1;
  if (phase.lot.kind === 'property') return Math.max(state.rules.auctionStartBid, above);
  const target = buildingTarget(state, phase.lot, playerId);
  const listPrice = target === null ? Infinity : (propertyAt(target)?.houseCost ?? Infinity);
  return Math.max(listPrice, above, 1);
}

function open(
  ctx: Ctx,
  lot: AuctionLot,
  participants: readonly PlayerId[],
  queue: readonly TileIndex[],
  returnTo: ResumePoint,
): void {
  const phase: AuctionPhase = {
    kind: 'auction',
    lot,
    participants: [...participants],
    highBid: 0,
    highBidder: null,
    queue: [...queue],
    returnTo,
  };
  ctx.s.phase = phase;
  ctx.events.push({
    type: 'auctionOpened',
    lot,
    participants: [...participants],
    minBid: lot.kind === 'property' ? ctx.s.rules.auctionStartBid : 1,
  });
}

/**
 * Subasta de una propiedad del banco entre todos los jugadores activos,
 * incluido el que la rechazó (SPEC.md §5.2). `queue` son las que siguen
 * (quiebra ante el banco, una por una).
 */
export function openPropertyAuction(
  ctx: Ctx,
  tile: TileIndex,
  queue: readonly TileIndex[],
  returnTo: ResumePoint,
): void {
  open(ctx, { kind: 'property', tile }, activePlayers(ctx.s), queue, returnTo);
}

/** Subasta de la última casa u hotel entre los interesados (SPEC.md §5.4). */
export function openBuildingAuction(
  ctx: Ctx,
  lot: Extract<AuctionLot, { kind: 'building' }>,
  participants: readonly PlayerId[],
  returnTo: ResumePoint,
): void {
  open(ctx, lot, participants, [], returnTo);
}

export function placeBid(ctx: Ctx, playerId: PlayerId, amount: number): void {
  const phase = ctx.s.phase as AuctionPhase;
  ctx.s.phase = { ...phase, highBid: amount, highBidder: playerId };
  ctx.events.push({ type: 'bidPlaced', playerId, amount });
}

/** El participante se baja. Devuelve si la subasta quedó decidida. */
export function passAuction(ctx: Ctx, playerId: PlayerId): boolean {
  const phase = ctx.s.phase as AuctionPhase;
  const next: AuctionPhase = {
    ...phase,
    participants: phase.participants.filter((id) => id !== playerId),
  };
  ctx.s.phase = next;
  ctx.events.push({ type: 'auctionPassed', playerId });
  return isDecided(next);
}

/** Termina cuando no queda nadie, o queda solo el que va ganando. */
export const isDecided = (phase: AuctionPhase): boolean =>
  phase.participants.length === 0 ||
  (phase.participants.length === 1 && phase.participants[0] === phase.highBidder);

/**
 * Entrega el lote al ganador (o lo deja en el banco si nadie pujó). Devuelve
 * a dónde seguir: la próxima propiedad de la cola o el `returnTo`.
 */
export function closeAuction(
  ctx: Ctx,
  build: (playerId: PlayerId, tile: TileIndex) => void,
): {
  readonly next: TileIndex | null;
  readonly queue: readonly TileIndex[];
  readonly returnTo: ResumePoint;
} {
  const phase = ctx.s.phase as AuctionPhase;
  const { lot, highBidder, highBid } = phase;
  if (highBidder !== null) {
    transfer(ctx, highBidder, 'bank', highBid, 'auction', lot.tile);
    if (lot.kind === 'property') {
      ownableAt(lot.tile);
      ctx.s.properties[lot.tile] = { ownerId: highBidder, houses: 0, mortgaged: false };
    } else {
      const target = buildingTarget(ctx.s, lot, highBidder);
      if (target === null) throw new Error('el ganador no tiene dónde construir');
      build(highBidder, target);
    }
  }
  ctx.events.push({ type: 'auctionClosed', lot, winnerId: highBidder, amount: highBid });
  const [next, ...queue] = phase.queue;
  return { next: next ?? null, queue, returnTo: phase.returnTo };
}
