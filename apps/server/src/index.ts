import { createGameServer } from './app.js';

const PORT = Number(process.env['PORT'] ?? 3001);
/** Lista separada por comas. */
const WEB_ORIGIN = process.env['WEB_ORIGIN'] ?? 'http://localhost:5173';

const { httpServer } = createGameServer({
  allowedOrigins: WEB_ORIGIN.split(',').map((origin) => origin.trim()),
});

// Un server viejo que sigue ocupando el puerto es la versión confusa de este
// error: el navegador después ve un error de CORS de otro proceso.
httpServer.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`El puerto ${PORT} está ocupado: ¿quedó otro server corriendo?`);
    process.exit(1);
  }
  throw error;
});

httpServer.listen(PORT, () => {
  console.log(`server escuchando en http://localhost:${PORT}`);
});
