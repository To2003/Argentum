import type { Message } from './types.js';

/**
 * Diccionario base, en español rioplatense (voseo). Es la fuente de verdad de
 * las claves: `MessageKey` sale de acá y cualquier otro idioma tiene que
 * tener exactamente las mismas, con los mismos parámetros.
 *
 * `{param}` se interpola; un objeto `{ one, other }` es un plural y recibe
 * `count`.
 */
export const esAR = {
  // App y pantallas
  'app.title': 'El Gran Negocio',
  'app.tagline': 'Comprá, cobrá y fundí a tus amigos. Online, desde la compu o el celu.',
  'landing.create': 'Crear partida',
  'landing.join': 'Unirme con código',
  'landing.comingSoon': 'Muy pronto, che.',
  'room.title': 'Sala {code}',
  'lobby.playerCount': { one: '{count} jugador', other: '{count} jugadores' },
  'notFound.title': 'Esta página no existe',
  'notFound.back': 'Volver al inicio',

  // Grupos de color
  'group.brown': 'Marrón',
  'group.lightBlue': 'Celeste',
  'group.pink': 'Rosa',
  'group.orange': 'Naranja',
  'group.red': 'Rojo',
  'group.yellow': 'Amarillo',
  'group.green': 'Verde',
  'group.darkBlue': 'Azul oscuro',

  // Mazos
  'deck.chance': 'Suerte',
  'deck.community': 'Barrio',

  // Casillas: `tile.<id>` es el nombre, `.detail` la bajada y `.generic` el
  // nombre sin marca (solo las casillas con brand: true).
  'tile.go': 'Salida',
  'tile.caminito': 'Caminito',
  'tile.caminito.detail': 'La Boca',
  'tile.community': 'Barrio',
  'tile.sanTelmo': 'Feria de San Telmo',
  'tile.incomeTax': 'Impuesto a las Ganancias',
  'tile.subwayA': 'Subte Línea A',
  'tile.subwayA.detail': 'Plaza de Mayo – San Pedrito',
  'tile.recoleta': 'Cementerio de la Recoleta',
  'tile.chance': 'Suerte',
  'tile.rosedal': 'Rosedal de Palermo',
  'tile.teatroColon': 'Teatro Colón',
  'tile.jail': 'Cárcel',
  'tile.jail.detail': 'Devoto · Solo de visita',
  'tile.tigre': 'Tigre',
  'tile.tigre.detail': 'Delta',
  'tile.edenor': 'Edenor',
  'tile.edenor.detail': 'Luz',
  'tile.edenor.generic': 'Compañía de Luz',
  'tile.laPlata': 'La Plata',
  'tile.laPlata.detail': 'Catedral',
  'tile.marDelPlata': 'Mar del Plata',
  'tile.subwayB': 'Subte Línea B',
  'tile.subwayB.detail': 'L. N. Alem – J. M. de Rosas',
  'tile.monumentoBandera': 'Monumento a la Bandera',
  'tile.monumentoBandera.detail': 'Rosario',
  'tile.ibera': 'Esteros del Iberá',
  'tile.ibera.detail': 'Corrientes',
  'tile.iguazu': 'Cataratas del Iguazú',
  'tile.iguazu.detail': 'Misiones',
  'tile.longWeekend': 'Fin de semana largo',
  'tile.longWeekend.detail': 'Descanso',
  'tile.carlosPaz': 'Villa Carlos Paz',
  'tile.cumbrecita': 'La Cumbrecita',
  'tile.altaGracia': 'Alta Gracia',
  'tile.altaGracia.detail': 'Estancia Jesuítica',
  'tile.subwayC': 'Subte Línea C',
  'tile.subwayC.detail': 'Constitución – Retiro',
  'tile.cafayate': 'Cafayate',
  'tile.cafayate.detail': 'Salta',
  'tile.humahuaca': 'Quebrada de Humahuaca',
  'tile.humahuaca.detail': 'Jujuy',
  'tile.aysa': 'AySA',
  'tile.aysa.detail': 'Agua',
  'tile.aysa.generic': 'Compañía de Agua',
  'tile.aconcagua': 'Cerro Aconcagua',
  'tile.aconcagua.detail': 'Mendoza',
  'tile.goToJail': 'Vas preso',
  'tile.goToJail.detail': 'Operativo policial',
  'tile.peritoMoreno': 'Glaciar Perito Moreno',
  'tile.peritoMoreno.detail': 'Santa Cruz',
  'tile.bariloche': 'San Carlos de Bariloche',
  'tile.ushuaia': 'Ushuaia',
  'tile.ushuaia.detail': 'Fin del Mundo',
  'tile.subwayD': 'Subte Línea D',
  'tile.subwayD.detail': 'Catedral – Congreso de Tucumán',
  'tile.obelisco': 'Obelisco',
  'tile.luxuryTax': 'Impuesto de Lujo',
  'tile.luxuryTax.detail': 'Bienes Personales',
  'tile.puertoMadero': 'Puerto Madero',
  'tile.puertoMadero.detail': 'Puente de la Mujer',

  // Cartas de Suerte. Parámetros: {salary}, {amount}, {perHouse}, {perHotel}
  // (plata ya formateada), {multiplier} y {steps}.
  'card.chance.advanceToGo': 'Avanzá hasta la Salida. Cobrá {salary}.',
  'card.chance.advanceToAltaGracia':
    'Avanzá hasta Alta Gracia. Si pasás por la Salida, cobrá {salary}.',
  'card.chance.advanceToTigre': 'Avanzá hasta Tigre. Si pasás por la Salida, cobrá {salary}.',
  'card.chance.advanceToPuertoMadero': 'Avanzá hasta Puerto Madero.',
  'card.chance.nearestUtility':
    'Avanzá hasta el servicio más cercano. Si no tiene dueño, podés comprarlo; si tiene dueño, tirá los dados y pagá {multiplier} veces el resultado.',
  'card.chance.nearestSubway':
    'Avanzá hasta la línea de subte más cercana y pagale al dueño el doble del alquiler. Si no tiene dueño, podés comprarla.',
  'card.chance.goBack3': 'Retrocedé {steps} casillas.',
  'card.chance.goToJail': 'Vas preso. Andá directo a la cárcel, sin pasar por la Salida.',
  'card.chance.aguinaldo': 'Te llegó el aguinaldo: cobrá {amount}.',
  'card.chance.jailFree':
    'Salí de la cárcel gratis. Guardá esta carta hasta que la necesites o la vendas.',
  'card.chance.consorcioRepairs':
    'Arreglos del consorcio: pagá {perHouse} por cada casa y {perHotel} por cada hotel que tengas.',
  'card.chance.parkingFine': 'Multa por estacionar mal: pagá {amount}.',
  'card.chance.rideLineA':
    'Hacé un viaje en la Línea A del subte. Si pasás por la Salida, cobrá {salary}.',
  'card.chance.consorcioPresident':
    'Te eligieron presidente del consorcio: pagale {amount} a cada jugador.',
  'card.chance.plazoFijo': 'Se te venció el plazo fijo: cobrá {amount}.',

  // Cartas de Barrio
  'card.community.advanceToGo': 'Avanzá hasta la Salida. Cobrá {salary}.',
  'card.community.bankError': 'Error del banco a tu favor: cobrá {amount}.',
  'card.community.prepaga': 'Pagás la prepaga: {amount}.',
  'card.community.savedDollars': 'Vendiste unos dólares ahorrados: cobrá {amount}.',
  'card.community.jailFree':
    'Salí de la cárcel gratis. Guardá esta carta hasta que la necesites o la vendas.',
  'card.community.goToJail': 'Vas preso. Andá directo a la cárcel, sin cobrar la Salida.',
  'card.community.savingsPlan': 'Se venció tu plan de ahorro: cobrá {amount}.',
  'card.community.taxRefund': 'Devolución de impuestos: cobrá {amount}.',
  'card.community.birthday': 'Es tu cumpleaños: cada jugador te da {amount}.',
  'card.community.lifeInsurance': 'Cobrás tu seguro de vida: {amount}.',
  'card.community.hospital': 'Gastos del hospital: pagá {amount}.',
  'card.community.schoolFees': 'Pagás la cuota del colegio: {amount}.',
  'card.community.consulting': 'Te pagan una consultoría: cobrá {amount}.',
  'card.community.streetRepairs':
    'Arreglo de calles de tu barrio: pagá {perHouse} por casa y {perHotel} por hotel.',
  'card.community.empanadaContest': 'Ganaste un concurso de empanadas: cobrá {amount}.',
  'card.community.inheritance': 'Te llegó una herencia: cobrá {amount}.',

  // Reglas configurables (resumen de la sala, SPEC.md §5.9)
  'rules.startingCash': 'Plata inicial',
  'rules.salary': 'Cobro al pasar por la Salida',
  'rules.jailFine': 'Fianza de la cárcel',
  'rules.maxJailTurns': 'Turnos máximos en la cárcel',
  'rules.freeParkingPot': 'Pozo en el Fin de semana largo',
  'rules.freeParkingPot.warning': 'Regla de la casa: hace que las partidas duren bastante más.',
  'rules.auctionOnDecline': 'Subasta si nadie compra',
  'rules.evenBuild': 'Construcción pareja',
  'rules.doubleRentOnMonopoly': 'Alquiler doble con el grupo completo',
  'rules.turnTimerSeconds': 'Tiempo por turno',
  'rules.auctionStartBid': 'Puja inicial de la subasta',
  'rules.auctionBidSeconds': 'Segundos para superar una puja',
  'rules.maxPlayers': 'Máximo de jugadores',
  'rules.gameDurationMinutes': 'Duración de la partida',
  'rules.maxRounds': 'Límite de rondas',
  'rules.useRealBrands': 'Nombres reales de empresas',
} as const satisfies Readonly<Record<string, Message>>;
