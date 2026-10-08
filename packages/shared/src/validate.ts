import boardJson from '../data/board.json' with { type: 'json' };
import cardsJson from '../data/cards.json' with { type: 'json' };
import { BoardSchema } from './schemas/board.js';
import { DecksSchema } from './schemas/cards.js';

/**
 * Valida board.json y cards.json contra sus esquemas. Tira un ZodError con el
 * detalle si algo está mal. Lo llaman los tests y el server al arrancar; el
 * cliente no (ver el comentario de `BOARD`).
 */
export function validateGameData(): void {
  BoardSchema.parse(boardJson);
  DecksSchema.parse(cardsJson);
}
