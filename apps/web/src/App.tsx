import { lazy, Suspense } from 'react';
import { Route, Routes, useSearchParams } from 'react-router';
import { Landing } from './screens/Landing.js';
import { NotFound } from './screens/NotFound.js';
import { Room } from './screens/Room.js';

/**
 * Hot-seat de debug (`?debug=1`). Solo en dev: en producción
 * `import.meta.env.DEV` es false, la rama es código muerto y Vite no emite
 * el chunk.
 */
const HotSeat = import.meta.env.DEV ? lazy(() => import('./debug/HotSeat.js')) : null;

export function App() {
  const [params] = useSearchParams();
  if (HotSeat !== null && params.get('debug') === '1') {
    return (
      <Suspense fallback={null}>
        <HotSeat />
      </Suspense>
    );
  }
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/sala/:code" element={<Room />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
