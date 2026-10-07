import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { App } from '../src/App.js';

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );

describe('App', () => {
  it('muestra la landing', () => {
    renderAt('/');
    expect(screen.getByRole('heading', { name: 'El Gran Negocio' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Crear partida' })).toBeInTheDocument();
  });

  it('muestra la sala con el código en mayúsculas', () => {
    renderAt('/sala/abc123');
    expect(screen.getByRole('heading', { name: 'Sala ABC123' })).toBeInTheDocument();
  });

  it('cae en 404 para rutas desconocidas', () => {
    renderAt('/cualquiera');
    expect(screen.getByRole('link', { name: 'Volver al inicio' })).toHaveAttribute('href', '/');
  });
});
