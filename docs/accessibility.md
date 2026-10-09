# Accesibilidad: checklist (M9)

Estado a la fecha del cierre de M9 (`m9-done`). ✅ = hecho y verificado; 🔶 = hecho pero
verificado solo a medias; ⬜ = pendiente.

## Lighthouse (mobile, build de producción)

Corrido con `lighthouse@12.8.2` (emulación móvil por defecto: Moto G Power, CPU 4×, red 4G lenta),
contra `vite preview` + el server local. La pantalla de partida se midió con una sesión real (sala
contra dos bots, perfil de Chrome persistente y `--disable-storage-reset`).

| Página                    | Performance | Accesibilidad | Buenas prácticas |
| ------------------------- | ----------: | ------------: | ---------------: |
| Inicio (`/`)              |          98 |           100 |              100 |
| Partida (`/sala/:código`) |          97 |           100 |              100 |

Antes de los arreglos de M9: inicio 99 / **95** / 100 (contraste) y partida 96 / 100 / 96, con la
página **más ancha que el celular** (la tira de jugadores ensanchaba la grilla con 3+ jugadores).

Cómo repetirlo: ver "Qué NO se pudo verificar (M9)" en REVIEW.md.

## Checklist

- ✅ **Contraste AA**: el texto secundario usa `tinta/70` (antes `/60` y `/50`, 4,07:1). Lighthouse
  sin fallas de `color-contrast` en el modo claro.
- 🔶 **Contraste en modo oscuro y temas de tablero**: los colores se redefinen con variables;
  revisado a ojo en capturas, no con una herramienta.
- ✅ **No depender solo del color**: cada grupo tiene un patrón propio encima del color (puntos,
  rayas horizontales/verticales/diagonales, cuadriculado, damero; marrón liso) en el tablero, los
  diálogos y las miniaturas del panel de jugadores. El dueño de una casilla está en su nombre
  accesible ("Dueño: …"), las hipotecadas llevan rayado y texto. En el gráfico de patrimonio cada
  jugador tiene trazo y marcador distintos, con leyenda.
- ✅ **Foco visible**: el foco por defecto del navegador no se oculta en ningún lado; las casillas
  suben de capa al enfocarse (`focus-visible:z-10`).
- ✅ **Teclado**: todo es `<button>`, `<input>` o `<dialog>` nativo (Escape cierra, el foco queda
  atrapado en el modal). En la partida, un enlace "Saltar a las acciones" (visible al enfocarlo)
  evita recorrer las 40 casillas.
- ✅ **aria-live**: el pedido del panel de acciones ("Es tu turno…"), el registro de eventos y el
  chat se anuncian (`polite`). El tutorial anuncia cada paso.
- ✅ **Nombres accesibles**: las casillas empiezan su nombre accesible con lo que se lee (nombre y
  precio, WCAG 2.5.3) y suman dueño, hipoteca y quién está parado ahí.
- ✅ **Idioma**: `<html lang>` sigue al idioma elegido (es-AR / en).
- ✅ **Movimiento reducido**: `prefers-reduced-motion` apaga saltos, sacudón, confeti y dados
  animados (M6).
- 🔶 **Lector de pantalla real**: no se probó con NVDA/VoiceOver/TalkBack; solo el árbol de
  accesibilidad (Testing Library por rol y nombre, Lighthouse/axe).
- 🔶 **Tamaño de letra en el tablero en celular**: con el tablero entero (412 px) las casillas no
  muestran texto (decisión de M5); desde M9.1 se leen pellizcando el tablero (aparecen a ~1,5×) o
  con "Acercar a mi ficha", y tocando una casilla se ve su detalle. Lighthouse (SEO, que no se
  mide acá) sigue marcando 26 % de texto legible en la vista entera.
- ✅ **Registro filtrable** (M9.1): botones con `aria-pressed` y nombre accesible del grupo.
