import { render } from '@testing-library/react';
import { BOARD, TOKEN_IDS } from '@gran-negocio/shared';
import { describe, expect, it } from 'vitest';
import { TileIcon, TokenIcon } from '../src/art/icons.js';

describe('ilustraciones', () => {
  it.each(BOARD.map((tile) => [tile.index, tile] as const))(
    'la casilla %i tiene ícono',
    (_, tile) => {
      const { container } = render(<TileIcon tile={tile} />);
      expect(container.querySelector('svg path')?.getAttribute('d')).toBeTruthy();
    },
  );

  it.each(TOKEN_IDS)('la ficha %s tiene ícono', (id) => {
    const { container } = render(<TokenIcon tokenId={id} />);
    expect(container.querySelector('svg path')).not.toBeNull();
  });
});
