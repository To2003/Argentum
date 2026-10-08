# 0005 — i18n con diccionario propio tipado

- **Estado:** aceptada (M1)
- **Fecha:** 2026-10-08

## Contexto

El SPEC pedía `next-intl` o equivalente; sin Next.js hacía falta elegir. Todo texto visible pasa
por i18n (es-AR por defecto, infraestructura lista para `en`), y parte de las claves salen de
los datos (`nameKey` en board.json, `textKey` en cards.json).

## Decisión

Diccionario propio en `packages/shared/src/i18n`, sin dependencias:

- `es-AR.ts` es la fuente de verdad: `MessageKey = keyof typeof esAR`.
- Cualquier otro idioma se tipa como `Dictionary`: una clave de más o de menos **no compila**.
- `t(key, params)` chequea al compilar la clave **y** los parámetros: se extraen de los `{param}`
  del texto es-AR con template literal types. Un plural (`{ one, other }`) exige `count: number`.
- Plurales con `Intl.PluralRules`; números con `Intl.NumberFormat`; plata con
  `Intl.NumberFormat` en moneda, sin decimales: `$ 1.500` en es-AR, `$1,500` en inglés.
- Las claves que salen de los datos usan `translate(key)`, que no se chequea al compilar; lo
  cubren los tests (toda `nameKey`, `.generic` y `textKey` existe en los dos idiomas, con los
  mismos parámetros).
- Los métodos del `Translator` no usan `this`: se pueden desestructurar.

## Por qué no i18next

~15 kB gzip más, claves sin chequeo de tipos y una API pensada para cargar recursos remotos que
no necesitamos.

## Consecuencias

- No hay ICU completo (select, ordinales); si hiciera falta, se agrega a mano.
- El cambio de idioma en caliente (M9) es un contexto de React sobre `createTranslator`.
