import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { App } from './App.js';
import './index.css';
import { applyMode, useLook } from './look.js';

applyMode(useLook.getState().mode);

const root = document.getElementById('root');
if (!root) throw new Error('falta #root en index.html');

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
