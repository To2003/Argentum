import type { Tile } from '@gran-negocio/shared';

/**
 * Ilustraciones propias de cada casilla (SPEC.md §7.1): íconos de línea de
 * 24 × 24, monocromos (`currentColor`), dibujados para este proyecto.
 * Origen y licencia en assets/README.md.
 */
const PATHS: Readonly<Record<string, string>> = {
  // Esquinas
  go: 'M20 12H5M11 6l-6 6 6 6M20 6v12',
  jail: 'M4 4h16v16H4zM8 4v16M12 4v16M16 4v16',
  longWeekend: 'M7 9h10l-1 8a4 4 0 0 1-8 0zM12 9l3-6M6 9h12',
  goToJail: 'M7 18v-5a5 5 0 0 1 10 0v5M5 18h14v3H5zM12 3v2M4 7l1.5 1.5M20 7l-1.5 1.5',
  // Cartas e impuestos
  chance:
    'M9 9a3 3 0 1 1 4 2.8c-.6.3-1 .9-1 1.6V15M12 19h.01M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z',
  community: 'M3 11l9-7 9 7M5 10v11h14V10M10 21v-6h4v6',
  incomeTax: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3',
  luxuryTax: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM12 7v8M10 9h3a1.5 1.5 0 0 1 0 3h-2a1.5 1.5 0 0 0 0 3h3',
  // Subtes y servicios
  subway:
    'M7 3h10a2 2 0 0 1 2 2v10a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V5a2 2 0 0 1 2-2zM5 10h14M9 14h.01M15 14h.01M8 21l2-3M16 21l-2-3',
  edenor: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-3 11c.5.4 1 1 1 2v1h4v-1c0-1 .5-1.6 1-2a6 6 0 0 0-3-11z',
  aysa: 'M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11zM9 15a3 3 0 0 0 3 3',
  // Propiedades
  caminito: 'M3 21V11l5-4 5 4v10M13 21V9l4-3 4 3v12M3 21h18M6 15h4M16 13h3M16 17h3',
  sanTelmo:
    'M3 9h18l-2-4H5zM3 9c0 1.5 1.5 2 3 2s3-.5 3-2c0 1.5 1.5 2 3 2s3-.5 3-2c0 1.5 1.5 2 3 2s3-.5 3-2M5 11v10M19 11v10M3 21h18',
  recoleta: 'M5 21V10l7-5 7 5v11M3 21h18M9 21v-6h6v6M12 2v3M10.5 3.5h3',
  rosedal:
    'M12 21v-8M12 13c-3 0-4-2-4-4 0-3 4-5 4-5s4 2 4 5c0 2-1 4-4 4zM12 17c-2-2-5-1-6 0M12 16c2-2 4-2 5-1',
  teatroColon: 'M3 21h18M4 10h16M12 4l8 6H4zM6 10v11M10 10v11M14 10v11M18 10v11',
  tigre: 'M3 15l3 3h12l3-3zM12 15V5l5 7h-5M3 21c2 0 2-1 4.5-1s2.5 1 4.5 1 2-1 4.5-1 2.5 1 4.5 1',
  laPlata: 'M4 21V11l2-6 2 6v10M16 21V11l2-6 2 6v10M8 21v-7l4-4 4 4v7M2 21h20M11 21v-3h2v3',
  marDelPlata: 'M3 11a9 7 0 0 1 18 0zM12 11v9M3 21h18M12 4v0',
  monumentoBandera: 'M10 21V5h4v16M7 21h10M14 6h5l-1 2 1 2h-5M8 13h8',
  ibera: 'M4 21V12M6 21v-7M19 21v-9M3 21h18M12 8a2 2 0 1 1 0 4c-2 0-3 1-3 3h6c0-2-1-3-3-3M14 9l3-1',
  iguazu: 'M3 6h18M5 6v12M9 6v14M13 6v10M17 6v14M3 21c2 0 2-1 4-1s2 1 4 1 2-1 4-1 2 1 4 1',
  carlosPaz: 'M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 5v2l1.5 1.5M3 21l5-6 4 4 3-3 6 5z',
  cumbrecita: 'M3 21h18M5 21V12l7-7 7 7v9M9 21v-5h6v5M8 12h8',
  altaGracia: 'M4 21V9h6v12M10 21V12l5-4 5 4v9M7 9V5M5 5h4M3 21h18M14 21v-4h2v4',
  cafayate: 'M8 3h8l-1 6a3 3 0 0 1-6 0zM12 12v8M8 21h8',
  humahuaca: 'M2 20l6-10 4 5 3-4 7 9zM5 16h14M7 13h10',
  aconcagua: 'M2 20L10 6l4 6 2-3 6 11zM8 9.5l2-3.5 2 3',
  peritoMoreno: 'M3 16l3-9 3 5 3-8 3 6 3-4 3 10zM3 21c2 0 2-1 4-1s2 1 4 1 2-1 4-1 2 1 4 1',
  bariloche: 'M4 21v-7l4-3 4 3v7M3 21h18M17 21v-3M14 18l3-5-1.5 0L17 9l1.5 4H17l3 5z',
  ushuaia: 'M10 21l1-12h2l1 12M9 9h6M10 6h4v3h-4zM12 4v2M7 6L4 5M17 6l3-1M6 21h12',
  obelisco: 'M11 21V6l1-3 1 3v15M8 21h8M11 9h2',
  puertoMadero: 'M3 17h18M7 17L16 4M16 4l-6 13M16 4l-2 13M16 4l2 13M3 21h18',
};

/** La clave del ícono de una casilla (los subtes comparten uno; Suerte y Barrio, el suyo). */
export function iconKey(tile: Tile): string {
  if (tile.kind === 'subway') return 'subway';
  if (tile.kind === 'chance' || tile.kind === 'community') return tile.kind;
  return tile.id;
}

export function TileIcon({ tile, className = '' }: { tile: Tile; className?: string }) {
  const path = PATHS[iconKey(tile)];
  if (path === undefined) return null;
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d={path} />
    </svg>
  );
}

/** Íconos de las fichas (SPEC.md §7.3), en blanco sobre el color de cada una. */
const TOKEN_PATHS: Readonly<Record<string, string>> = {
  mate: 'M7 9h10l-1 8a4 4 0 0 1-8 0zM12 9l3-6M6 9h12',
  bombo: 'M5 7a7 3 0 0 0 14 0 7 3 0 0 0-14 0v10a7 3 0 0 0 14 0V7M5 12l14 0M8 5l-3-3M16 5l3-3',
  alfajor: 'M4 9a8 3 0 0 0 16 0 8 3 0 0 0-16 0M4 9v2a8 3 0 0 0 16 0V9M4 14v1a8 3 0 0 0 16 0v-1',
  colectivo:
    'M5 4h14a1 1 0 0 1 1 1v12H4V5a1 1 0 0 1 1-1zM4 11h16M7 17v2M17 17v2M7 14h.01M17 14h.01M8 7h3',
  hornero:
    'M4 14c0-4 4-7 9-7 3 0 5 2 7 4l-4 1c0 3-3 6-7 6-3 0-5-2-5-4zM14 10h.01M17 12l3 1M7 18l-2 3M10 18l1 3',
  solDeMayo:
    'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2',
};

export function TokenIcon({ tokenId }: { tokenId: string }) {
  const path = TOKEN_PATHS[tokenId];
  if (path === undefined) return null;
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="white"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[70%] w-[70%]"
    >
      <path d={path} />
    </svg>
  );
}
