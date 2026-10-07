import { defineConfig } from 'tsup';

/**
 * Build de producción del server.
 *
 * Los paquetes del workspace se consumen por source, así que `node` no los
 * puede resolver solo: se compilan adentro del bundle. Lo que tiene paquete
 * real en node_modules queda externo.
 */
export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'build',
  format: ['esm'],
  platform: 'node',
  target: 'node24',
  noExternal: [/^@gran-negocio\//],
  external: ['express', 'cors', 'socket.io'],
  /**
   * esbuild no conoce todos los builtins nuevos (en Tierra Austral reescribió
   * `node:sqlite` como `sqlite` y el server recién falló al arrancar). Esto
   * deja todo import `node:` tal como está escrito.
   */
  esbuildPlugins: [
    {
      name: 'keep-node-builtins',
      setup(build) {
        build.onResolve({ filter: /^node:/ }, (args) => ({ path: args.path, external: true }));
      },
    },
  ],
  clean: true,
  sourcemap: true,
  dts: false,
});
