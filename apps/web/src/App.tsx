import { Route, Routes } from 'react-router';
import { Landing } from './screens/Landing.js';
import { NotFound } from './screens/NotFound.js';
import { Room } from './screens/Room.js';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/sala/:code" element={<Room />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
