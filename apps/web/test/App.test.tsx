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

  it('una sala sin sesión guardada pide el nombre para entrar, con el código en mayúsculas', async () => {
    renderAt('/sala/abc123');
    // La sala se carga como chunk aparte (lazy).
    expect(
      await screen.findByRole('heading', { name: 'Te invitaron a la sala ABC123' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeDisabled();
  });

  it('cae en 404 para rutas desconocidas', () => {
    renderAt('/cualquiera');
    expect(screen.getByRole('link', { name: 'Volver al inicio' })).toHaveAttribute('href', '/');
  });
});
