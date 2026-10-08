import type { PlayerView, RulesView } from '@gran-negocio/engine';

/**
 * La vista del jugador con la forma que piden los chequeos del engine
 * (`buildError`, `tradeContentError`…): así la UI explica por qué algo no se
 * puede con las mismas reglas que el server, sin repetirlas.
 */
export function rulesView(view: PlayerView): RulesView {
  return {
    players: Object.fromEntries(view.players.map((player) => [player.id, player])),
    properties: view.properties,
    bank: view.bank,
    rules: view.rules,
  };
}
