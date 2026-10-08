import { lazy, Suspense } from 'react';
import { Route, Routes, useSearchParams } from 'react-router';
import { ErrorBanner } from './components/ErrorBanner.js';
import { Landing } from './screens/Landing.js';
import { NotFound } from './screens/NotFound.js';

/**
 * Hot-seat de debug (`?debug=1`). Solo en dev: en producción
 * `import.meta.env.DEV` es false, la rama es código muerto y Vite no emite
 * el chunk.
 */
/** La sala (lobby + partida) va en su propio chunk: el inicio carga liviano (SPEC.md §7.7). */
const Room = lazy(() => import('./screens/Room.js').then((module) => ({ default: module.Room })));

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
    <>
      <ErrorBanner />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route
          path="/sala/:code"
          element={
            <Suspense fallback={null}>
              <Room />
            </Suspense>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}
