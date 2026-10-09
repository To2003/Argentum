# Reporte de balance

Generado con `pnpm sim`: 1000 partidas por enfrentamiento, tope de 400 turnos, seeds desde `6772616e6e65676f63696f00000000`, reglas por defecto. Los bots son deterministas: el reporte se reproduce exacto. Una partida que llega al tope se decide por patrimonio neto (§5.8). Los asientos rotan en cada partida.

## Resultados por enfrentamiento

| Enfrentamiento                       | Victorias                               | Solo partidas terminadas         | Turnos promedio | Llegan al tope |
| ------------------------------------ | --------------------------------------- | -------------------------------- | --------------- | -------------- |
| Medio vs. Fácil (aceptación de M8)   | medium 84.3 %, easy 15.7 %              | medium 96.4 %, easy 3.6 % (723)  | 248             | 27.7 %         |
| Difícil vs. Medio                    | hard 53.9 %, medium 46.1 %              | hard 54.1 %, medium 45.9 % (904) | 184             | 9.6 %          |
| Difícil vs. Fácil                    | hard 83.9 %, easy 16.1 %                | hard 94.8 %, easy 5.2 % (718)    | 248             | 28.2 %         |
| Cuatro: Difícil, Medio, Fácil, Fácil | medium 29.7 %, easy 38.0 %, hard 32.3 % | medium 47.1 %, hard 52.9 % (191) | 367             | 80.9 %         |

**Aceptación de M8** (Medio le gana al Fácil en más del 65 %): 84.3 % → ✅

## Ventaja por orden de turno

Victorias según en qué lugar del orden de turno jugó el ganador.

| Enfrentamiento                       | 1.º    | 2.º    | 3.º    | 4.º    |
| ------------------------------------ | ------ | ------ | ------ | ------ |
| Medio vs. Fácil (aceptación de M8)   | 51.1 % | 48.9 % | —      | —      |
| Difícil vs. Medio                    | 49.5 % | 50.5 % | —      | —      |
| Difícil vs. Fácil                    | 49.9 % | 50.1 % | —      | —      |
| Cuatro: Difícil, Medio, Fácil, Fácil | 29.5 % | 26.1 % | 24.5 % | 19.9 % |

## Casillas más pisadas

| Casilla                   | % de las caídas |
| ------------------------- | --------------- |
| 24 · Alta Gracia          | 3.0 %           |
| 25 · Subte Línea C        | 3.0 %           |
| 0 · Salida                | 2.9 %           |
| 19 · Cataratas del Iguazú | 2.9 %           |
| 5 · Subte Línea A         | 2.9 %           |
| 18 · Esteros del Iberá    | 2.8 %           |
| 20 · Fin de semana largo  | 2.8 %           |
| 17 · Barrio               | 2.8 %           |
| 15 · Subte Línea B        | 2.8 %           |
| 22 · Suerte               | 2.7 %           |

## Retorno por grupo

Alquiler cobrado sobre lo invertido (compras, subastas y edificios netos de ventas), en todas las partidas.

| Grupo       | Alquiler cobrado | Invertido   | Retorno |
| ----------- | ---------------- | ----------- | ------- |
| Subtes      | $ 4.159.525      | $ 2.854.019 | 1.46    |
| Servicios   | $ 1.369.476      | $ 1.087.488 | 1.26    |
| Marrón      | $ 1.057.894      | $ 1.013.813 | 1.04    |
| Azul oscuro | $ 2.150.425      | $ 4.627.839 | 0.46    |
| Rojo        | $ 1.473.965      | $ 3.580.023 | 0.41    |
| Verde       | $ 1.659.185      | $ 4.036.389 | 0.41    |
| Naranja     | $ 1.140.374      | $ 2.810.162 | 0.41    |
| Amarillo    | $ 1.416.808      | $ 3.639.295 | 0.39    |
| Rosa        | $ 848.918        | $ 2.237.635 | 0.38    |
| Celeste     | $ 599.652        | $ 1.589.581 | 0.38    |

## Estancamientos y ajustes propuestos (no activados)

Las partidas que llegan al tope son las que nadie arma un grupo y construye: con dos jugadores que se reparten los grupos sin trocar, los alquileres base no alcanzan para quebrar a nadie. Pasa mucho más con el bot Fácil (no construye ni comercia). Ajustes posibles, todos opcionales y apagados por defecto:

1. **Tope de rondas con desempate por patrimonio**: ya existe (`maxRounds`); sugerirlo en el lobby para partidas de 2.
2. **Impuesto creciente**: Ganancias sube un 10 % cada 10 rondas, para drenar el efectivo acumulado.
3. **Subasta forzada de propiedades sueltas** después de N rondas, para que se armen grupos.
4. **Bot Medio/Difícil más dispuestos a trocar**: con dos jugadores, el trueque es lo que destraba los grupos.

_Tiempo de simulación: 122 s._
