# Reporte de balance

Generado con `pnpm sim`: 1000 partidas por enfrentamiento, tope de 400 turnos, seeds desde `6772616e6e65676f63696f00000000`, reglas por defecto. Los bots son deterministas: el reporte se reproduce exacto. Una partida que llega al tope se decide por patrimonio neto (§5.8). Los asientos rotan en cada partida.

## Resultados por enfrentamiento

| Enfrentamiento                       | Victorias                               | Solo partidas terminadas         | Turnos promedio | Llegan al tope |
| ------------------------------------ | --------------------------------------- | -------------------------------- | --------------- | -------------- |
| Medio vs. Fácil (aceptación de M8)   | medium 84.3 %, easy 15.7 %              | medium 96.4 %, easy 3.6 % (724)  | 248             | 27.6 %         |
| Difícil vs. Medio                    | hard 53.7 %, medium 46.3 %              | hard 53.8 %, medium 46.2 % (904) | 184             | 9.6 %          |
| Difícil vs. Fácil                    | hard 84.1 %, easy 15.9 %                | hard 95.0 %, easy 5.0 % (720)    | 248             | 28.0 %         |
| Cuatro: Difícil, Medio, Fácil, Fácil | medium 29.7 %, easy 38.0 %, hard 32.3 % | medium 47.1 %, hard 52.9 % (191) | 367             | 80.9 %         |

**Aceptación de M8** (Medio le gana al Fácil en más del 65 %): 84.3 % → ✅

## Ventaja por orden de turno

Victorias según en qué lugar del orden de turno jugó el ganador.

| Enfrentamiento                       | 1.º    | 2.º    | 3.º    | 4.º    |
| ------------------------------------ | ------ | ------ | ------ | ------ |
| Medio vs. Fácil (aceptación de M8)   | 51.1 % | 48.9 % | —      | —      |
| Difícil vs. Medio                    | 49.3 % | 50.7 % | —      | —      |
| Difícil vs. Fácil                    | 50.1 % | 49.9 % | —      | —      |
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
| Subtes      | $ 4.152.875      | $ 2.854.031 | 1.46    |
| Servicios   | $ 1.367.364      | $ 1.087.088 | 1.26    |
| Marrón      | $ 1.058.020      | $ 1.010.918 | 1.05    |
| Azul oscuro | $ 2.130.370      | $ 4.615.124 | 0.46    |
| Naranja     | $ 1.167.242      | $ 2.819.167 | 0.41    |
| Rojo        | $ 1.481.860      | $ 3.588.882 | 0.41    |
| Verde       | $ 1.648.334      | $ 4.032.221 | 0.41    |
| Amarillo    | $ 1.409.192      | $ 3.642.338 | 0.39    |
| Rosa        | $ 865.049        | $ 2.251.449 | 0.38    |
| Celeste     | $ 598.512        | $ 1.592.781 | 0.38    |

## Estancamientos y ajustes propuestos (no activados)

Las partidas que llegan al tope son las que nadie arma un grupo y construye: con dos jugadores que se reparten los grupos sin trocar, los alquileres base no alcanzan para quebrar a nadie. Pasa mucho más con el bot Fácil (no construye ni comercia). Ajustes posibles, todos opcionales y apagados por defecto:

1. **Tope de rondas con desempate por patrimonio**: ya existe (`maxRounds`); sugerirlo en el lobby para partidas de 2.
2. **Impuesto creciente**: Ganancias sube un 10 % cada 10 rondas, para drenar el efectivo acumulado.
3. **Subasta forzada de propiedades sueltas** después de N rondas, para que se armen grupos.
4. **Bot Medio/Difícil más dispuestos a trocar**: con dos jugadores, el trueque es lo que destraba los grupos.

_Tiempo de simulación: 131 s._
