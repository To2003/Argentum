/**
 * Lo que comparten el engine, el server y el cliente: constantes, datos del
 * tablero y las cartas (validados con zod al cargar), reglas configurables e
 * i18n.
 */
export * from './board.js';
export * from './cards.js';
export * from './constants.js';
export * from './i18n/index.js';
export * from './rules.js';
export * from './tokens.js';
export { validateGameData } from './validate.js';
export { BoardSchema, ColorGroupSchema, TileSchema } from './schemas/board.js';
export { CardEffectSchema, CardSchema, DECK_SIZE, DecksSchema } from './schemas/cards.js';
export {
  RulesConfigSchema,
  RulesOverridesSchema,
  type RulesConfig,
  type RulesOverrides,
} from './schemas/rules.js';
