import type { ReactNode } from 'react';

export interface PanelProps {
  readonly children: ReactNode;
  readonly className?: string;
}

/** Superficie elevada con el estilo base del juego. */
export function Panel({ children, className = '' }: PanelProps) {
  return (
    <div className={`rounded-2xl bg-white/80 p-6 shadow-lg backdrop-blur ${className}`}>
      {children}
    </div>
  );
}
