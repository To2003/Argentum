import { fireEvent, render, screen } from '@testing-library/react';
import { StrictMode, useState } from 'react';
import { describe, expect, it } from 'vitest';
import { Dialog } from '../src/components/ui.js';

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
        }}
      >
        abrir
      </button>
      {open && (
        <Dialog
          title="Detalle"
          onClose={() => {
            setOpen(false);
          }}
        >
          <p>contenido</p>
        </Dialog>
      )}
    </>
  );
}

describe('Dialog', () => {
  it('se abre y queda abierto en StrictMode (regresión: los efectos dobles lo cerraban)', () => {
    // jsdom no implementa showModal: lo simulamos como el navegador.
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.setAttribute('open', '');
      },
    });
    render(
      <StrictMode>
        <Harness />
      </StrictMode>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'abrir' }));
    expect(screen.getByText('contenido')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(screen.queryByText('contenido')).not.toBeInTheDocument();
  });
});
