export interface EquipoBase {
  id: string;
  nombre: string;
  abreviatura: string;
  escudoUrl: string;
  colorPrimario: string;
  colorSecundario: string;
  arrastraPromedio2025: boolean;
  origen2026: string;
  estadio: string;
  puntos2025: number;
  pj2025: number;
  evolucionAnual: (number | null)[];
  evolucionDescenso: (number | null)[];
}

export interface PartidoJornada {
  id: string;
  jornada: number;
  torneo: 'Torneo Competencia' | 'Fase Regular' | 'Definición / Cierre';
  localId: string;
  visitanteId: string;
  golesLocal: number;
  golesVisitante: number;
  estadio: string;
  goleadores: string[];
}

export interface FilaAnualJornada {
  posicion: number;
  posicionAnterior: number | null;
  variacion: number; // positivo = subió puestos, negativo = bajó puestos
  equipo: EquipoBase;
  pj: number;
  g: number;
  e: number;
  p: number;
  gf: number;
  gc: number;
  dg: number;
  puntos: number;
  racha: ('G' | 'E' | 'P')[];
  fitnessPct: number; // % de puntos obtenidos en los últimos 5 partidos (sobre 15)
  zona: 'ascensoDirecto' | 'playoffs' | 'permanencia' | 'sinActividadJ33';
  activoEnJornada: boolean;
}

export interface FilaDescensoJornada {
  posicion: number;
  posicionAnterior: number | null;
  variacion: number;
  equipo: EquipoBase;
  puntos2025: number;
  pj2025: number;
  puntos2026: number;
  pj2026: number;
  puntosTotales: number;
  pjTotales: number;
  promedio: number;
  enZonaDescenso: boolean;
  distanciaSalvacion: number; // diferencia de promedio con el puesto 12
  activoEnJornada: boolean;
}

export interface GoleadorAcumulado {
  id: string;
  nombre: string;
  equipoId: string;
  goles: number;
  penales: number;
  partidosAnotando: number;
}

export const CSV_ATTACHMENT_PATH =
  '/assets/aistudio/Segunda_Divisi_n_Uruguay_2026_-_Evoluci_n_Clasificaci_n_y_Descenso__Jornadas_1_a_33__-_Untitled_6d58484b.csv';

export const TORNEO_METADATA = {
  torneo: 'Segunda División Profesional de Uruguay',
  temporada: 2026,
  totalJornadas: 33,
  zonas: {
    ascensoDirecto: [1, 2],
    playoffs: [3, 4, 5, 6],
    descensoDirecto: [13, 14],
  },
};

export const EQUIPOS_2026: EquipoBase[] = [
  {
    id: 'plaza-colonia',
    nombre: 'Plaza Colonia',
    abreviatura: 'PCO',
    escudoUrl: '/assets/aistudio/image_42805556.png',
    colorPrimario: '#16A34A',
    colorSecundario: '#FFFFFF',
    arrastraPromedio2025: false,
    origen2026: 'Descendido de Primera A (2025)',
    estadio: 'Parque Juan Gaspar Prandi',
    puntos2025: 0,
    pj2025: 0,
    evolucionAnual: [9, 3, 1, 1, 2, 2, 2, 3, 1, 1, 1, 3, 1, 2, 3, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1],
    evolucionDescenso: [8, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 2, 4, 1, 1, 2, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, null],
  },
  {
    id: 'rentistas',
    nombre: 'Rentistas',
    abreviatura: 'REN',
    escudoUrl: '/assets/aistudio/image_87d8df75.png',
    colorPrimario: '#EF4444',
    colorSecundario: '#FFFFFF',
    arrastraPromedio2025: true,
    origen2026: 'Permanencia en Segunda B (2025)',
    estadio: 'Complejo Rentistas',
    puntos2025: 44,
    pj2025: 32,
    evolucionAnual: [10, 9, 2, 7, 6, 7, 7, 6, 5, 6, 6, 6, 9, 8, 7, 8, 7, 6, 5, 6, 7, 7, 7, 7, 6, 6, 4, 4, 4, 3, 4, 2, null],
    evolucionDescenso: [5, 6, 7, 6, 7, 7, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 7, 6, 6, 6, 8, 8, 7, 5, 5, 6, 5, 5, 5, 5, 5, 5, null],
  },
  {
    id: 'atenas',
    nombre: 'Atenas',
    abreviatura: 'ATE',
    escudoUrl: '/assets/aistudio/image_f6395b0a.png',
    colorPrimario: '#2563EB',
    colorSecundario: '#DC2626',
    arrastraPromedio2025: true,
    origen2026: 'Permanencia en Segunda B (2025)',
    estadio: 'Estadio Domingo Burgueño Miguel',
    puntos2025: 55,
    pj2025: 32,
    evolucionAnual: [3, 11, 12, 13, 13, 11, 12, 10, 12, 12, 9, 11, 6, 6, 4, 5, 6, 7, 6, 3, 2, 2, 5, 4, 3, 3, 3, 3, 3, 5, 2, 3, null],
    evolucionDescenso: [1, 3, 3, 4, 4, 5, 5, 3, 5, 2, 2, 2, 2, 3, 1, 1, 1, 2, 2, 1, 2, 2, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, null],
  },
  {
    id: 'colon',
    nombre: 'Colón',
    abreviatura: 'COL',
    escudoUrl: '/assets/aistudio/image_e5f3ef13.png',
    colorPrimario: '#10B981',
    colorSecundario: '#EF4444',
    arrastraPromedio2025: true,
    origen2026: 'Permanencia en Segunda B (2025)',
    estadio: 'Parque Suero',
    puntos2025: 52,
    pj2025: 32,
    evolucionAnual: [2, 2, 6, 5, 4, 3, 5, 5, 7, 9, 11, 8, 7, 7, 8, 7, 5, 5, 7, 7, 3, 6, 3, 3, 4, 4, 5, 6, 5, 4, 5, 4, null],
    evolucionDescenso: [2, 2, 2, 2, 2, 4, 3, 2, 4, 4, 4, 4, 5, 5, 5, 3, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 4, 3, 3, 3, 3, 3, null],
  },
  {
    id: 'oriental',
    nombre: 'Oriental',
    abreviatura: 'ORI',
    escudoUrl: '/assets/aistudio/image_ab4ecfe4.png',
    colorPrimario: '#38BDF8',
    colorSecundario: '#FFFFFF',
    arrastraPromedio2025: true,
    origen2026: 'Permanencia en Segunda B (2025)',
    estadio: 'Parque Oriental (La Paz)',
    puntos2025: 48,
    pj2025: 32,
    evolucionAnual: [1, 1, 5, 3, 1, 1, 1, 2, 2, 3, 2, 4, 2, 1, 1, 3, 3, 2, 4, 5, 6, 5, 2, 2, 2, 2, 2, 1, 2, 2, 3, 5, null],
    evolucionDescenso: [3, 4, 4, 3, 3, 3, 4, 4, 3, 3, 3, 3, 3, 4, 2, 4, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 3, 4, 4, 4, 4, 4, null],
  },
  {
    id: 'cerrito',
    nombre: 'Cerrito',
    abreviatura: 'CER',
    escudoUrl: '/assets/aistudio/image_c1e01c56.png',
    colorPrimario: '#FACC15',
    colorSecundario: '#15803D',
    arrastraPromedio2025: true,
    origen2026: 'Permanencia en Segunda B (2025)',
    estadio: 'Parque Maracaná',
    puntos2025: 29,
    pj2025: 32,
    evolucionAnual: [11, 4, 4, 2, 7, 8, 8, 7, 6, 4, 3, 1, 4, 5, 2, 4, 1, 3, 2, 4, 4, 3, 6, 6, 7, 7, 8, 7, 7, 7, 6, 6, null],
    evolucionDescenso: [11, 10, 12, 12, 11, 10, 10, 10, 11, 11, 11, 9, 11, 12, 11, 11, 11, 11, 11, 11, 10, 10, 10, 11, 11, 12, 12, 12, 11, 13, 13, 13, 13],
  },
  {
    id: 'la-luz',
    nombre: 'La Luz',
    abreviatura: 'LLU',
    escudoUrl: '/assets/aistudio/image_e6851ef1.png',
    colorPrimario: '#E2E8F0',
    colorSecundario: '#166534',
    arrastraPromedio2025: true,
    origen2026: 'Permanencia en Segunda B (2025)',
    estadio: 'Parque Palermo',
    puntos2025: 34,
    pj2025: 32,
    evolucionAnual: [6, 8, 8, 4, 9, 9, 9, 9, 9, 7, 8, 9, 13, 10, 10, 11, 10, 8, 8, 10, 11, 11, 11, 12, 10, 11, 10, 10, 9, 8, 8, 8, null],
    evolucionDescenso: [9, 9, 10, 8, 9, 9, 9, 9, 10, 10, 10, 10, 12, 11, 12, 12, 12, 10, 12, 10, 11, 11, 12, 12, 12, 13, 11, 11, 13, 12, 11, 11, 12],
  },
  {
    id: 'huracan',
    nombre: 'Huracán',
    abreviatura: 'HUR',
    escudoUrl: '/assets/aistudio/image_91882ced.png',
    colorPrimario: '#60A5FA',
    colorSecundario: '#F8FAFC',
    arrastraPromedio2025: false,
    origen2026: 'Ascendido de Primera C (2025)',
    estadio: 'Parque Pedro Ángel Bossio',
    puntos2025: 0,
    pj2025: 0,
    evolucionAnual: [5, 5, 7, 9, 8, 4, 4, 4, 4, 5, 5, 5, 5, 3, 5, 6, 8, 9, 9, 11, 9, 9, 9, 8, 8, 8, 7, 8, 10, 10, 9, 9, null],
    evolucionDescenso: [7, 8, 9, 9, 5, 2, 2, 5, 2, 5, 5, 6, 4, 2, 4, 5, 8, 8, 8, 9, 9, 9, 9, 6, 8, 8, 6, 7, 8, 9, 7, 7, 6],
  },
  {
    id: 'fenix',
    nombre: 'Fénix',
    abreviatura: 'FEN',
    escudoUrl: '/assets/aistudio/image_51da0c4d.png',
    colorPrimario: '#A855F7',
    colorSecundario: '#FFFFFF',
    arrastraPromedio2025: true,
    origen2026: 'Permanencia en Segunda B (2025)',
    estadio: 'Parque Capurro',
    puntos2025: 43,
    pj2025: 32,
    evolucionAnual: [4, 7, 11, 6, 3, 5, 3, 1, 3, 2, 4, 2, 3, 4, 6, 2, 4, 4, 3, 2, 5, 4, 4, 5, 5, 5, 6, 5, 6, 6, 7, 7, 9],
    evolucionDescenso: [6, 7, 8, 7, 8, 8, 6, 6, 7, 7, 7, 7, 7, 7, 7, 7, 6, 5, 5, 5, 7, 5, 5, 7, 6, 5, 7, 6, 6, 6, 6, 6, 7],
  },
  {
    id: 'paysandu',
    nombre: 'Paysandú',
    abreviatura: 'PAY',
    escudoUrl: '/assets/aistudio/image_f36822a9.png',
    colorPrimario: '#93C5FD',
    colorSecundario: '#1E3A8A',
    arrastraPromedio2025: false,
    origen2026: 'Ascendido de Primera C (2025)',
    estadio: 'Estadio Artigas (Paysandú)',
    puntos2025: 0,
    pj2025: 0,
    evolucionAnual: [14, 14, 9, 10, 10, 10, 11, 12, 14, 14, 14, 14, 14, 14, 14, 14, 14, 13, 12, 13, 13, 13, 12, 10, 11, 10, 11, 12, 11, 11, 10, 10, 10],
    evolucionDescenso: [14, 14, 6, 10, 12, 12, 13, 13, 14, 14, 14, 14, 14, 14, 14, 14, 14, 13, 10, 12, 12, 12, 11, 10, 10, 10, 10, 13, 10, 10, 9, 9, null],
  },
  {
    id: 'river-plate',
    nombre: 'River Plate',
    abreviatura: 'RIV',
    escudoUrl: '/assets/aistudio/image_395c05f2.png',
    colorPrimario: '#F87171',
    colorSecundario: '#FFFFFF',
    arrastraPromedio2025: false,
    origen2026: 'Descendido de Primera A (2025)',
    estadio: 'Parque Federico Omar Saroldi',
    puntos2025: 0,
    pj2025: 0,
    evolucionAnual: [13, 12, 13, 14, 14, 14, 13, 13, 10, 8, 10, 13, 10, 12, 13, 10, 9, 10, 10, 8, 8, 8, 8, 9, 9, 9, 9, 9, 8, 9, 11, 11, 11],
    evolucionDescenso: [13, 12, 13, 14, 14, 14, 14, 14, 9, 9, 9, 12, 10, 10, 10, 10, 9, 9, 9, 8, 6, 7, 8, 9, 9, 9, 9, 9, 7, 8, 10, 10, 10],
  },
  {
    id: 'miramar-misiones',
    nombre: 'Miramar Misiones',
    abreviatura: 'MMI',
    escudoUrl: '/assets/aistudio/image_34c016a1.png',
    colorPrimario: '#F59E0B',
    colorSecundario: '#18181B',
    arrastraPromedio2025: false,
    origen2026: 'Descendido de Primera A (2025)',
    estadio: 'Parque Luis Méndez Piana',
    puntos2025: 0,
    pj2025: 0,
    evolucionAnual: [12, 13, 14, 11, 11, 12, 10, 11, 13, 13, 13, 12, 8, 11, 9, 9, 11, 12, 14, 14, 14, 14, 14, 14, 14, 12, 12, 11, 12, 12, 12, 12, 12],
    evolucionDescenso: [12, 13, 14, 11, 13, 13, 12, 12, 13, 13, 12, 11, 9, 9, 9, 9, 10, 12, 13, 13, 14, 13, 13, 14, 13, 11, 13, 10, 12, 11, 12, 12, 11],
  },
  {
    id: 'uruguay-montevideo',
    nombre: 'Uruguay Montevideo',
    abreviatura: 'UMO',
    escudoUrl: '/assets/aistudio/image_74936cb6.png',
    colorPrimario: '#0EA5E9',
    colorSecundario: '#0F172A',
    arrastraPromedio2025: true,
    origen2026: 'Permanencia en Segunda B (2025)',
    estadio: 'Parque ANCAP',
    puntos2025: 32,
    pj2025: 32,
    evolucionAnual: [8, 6, 3, 8, 5, 6, 6, 8, 8, 11, 7, 7, 11, 13, 11, 13, 12, 11, 11, 9, 10, 10, 10, 11, 12, 13, 14, 14, 14, 14, 13, 13, 13],
    evolucionDescenso: [10, 11, 11, 13, 10, 11, 11, 11, 12, 12, 13, 13, 13, 13, 13, 13, 13, 14, 14, 14, 13, 14, 14, 13, 14, 14, 14, 14, 14, 14, 14, 14, 14],
  },
  {
    id: 'tacuarembo',
    nombre: 'Tacuarembó',
    abreviatura: 'TAC',
    escudoUrl: '/assets/aistudio/image_92cdb824.png',
    colorPrimario: '#DC2626',
    colorSecundario: '#FFFFFF',
    arrastraPromedio2025: true,
    origen2026: 'Permanencia en Segunda B (2025)',
    estadio: 'Estadio Raúl Goyenola',
    puntos2025: 47,
    pj2025: 32,
    evolucionAnual: [7, 10, 10, 12, 12, 13, 14, 14, 11, 10, 12, 10, 12, 9, 12, 12, 13, 14, 13, 12, 12, 12, 13, 13, 13, 14, 13, 13, 13, 13, 14, 14, 14],
    evolucionDescenso: [4, 5, 5, 5, 6, 6, 7, 7, 6, 6, 6, 5, 6, 6, 6, 6, 5, 7, 7, 7, 5, 6, 6, 8, 7, 7, 8, 8, 9, 7, 8, 8, null],
  },
];

// Goleadores destacados de la temporada 2026 (progresión realista hasta la jornada 33)
const BASE_GOLEADORES = [
  { id: 'gol-1', nombre: 'Ramiro Quintana', equipoId: 'plaza-colonia', totalGoles: 17, penales: 3 },
  { id: 'gol-2', nombre: 'Nicolás González', equipoId: 'oriental', totalGoles: 15, penales: 2 },
  { id: 'gol-3', nombre: 'Emiliano Villar', equipoId: 'rentistas', totalGoles: 14, penales: 4 },
  { id: 'gol-4', nombre: 'Matías Britos', equipoId: 'atenas', totalGoles: 13, penales: 2 },
  { id: 'gol-5', nombre: 'Diego Vera', equipoId: 'colon', totalGoles: 12, penales: 3 },
  { id: 'gol-6', nombre: 'Maximiliano Juambeltz', equipoId: 'fenix', totalGoles: 11, penales: 1 },
  { id: 'gol-7', nombre: 'Federico Millacet', equipoId: 'cerrito', totalGoles: 11, penales: 2 },
  { id: 'gol-8', nombre: 'Facundo Silvera', equipoId: 'huracan', totalGoles: 10, penales: 1 },
  { id: 'gol-9', nombre: 'Luis Machado', equipoId: 'la-luz', totalGoles: 9, penales: 2 },
  { id: 'gol-10', nombre: 'Joaquín Lavega', equipoId: 'river-plate', totalGoles: 9, penales: 0 },
  { id: 'gol-11', nombre: 'Maximiliano Noble', equipoId: 'paysandu', totalGoles: 8, penales: 2 },
  { id: 'gol-12', nombre: 'Douglas Bittencourt', equipoId: 'tacuarembo', totalGoles: 8, penales: 1 },
];

export function obtenerNombreTorneoJornada(jornada: number): 'Torneo Competencia' | 'Fase Regular' | 'Definición / Cierre' {
  if (jornada <= 6) return 'Torneo Competencia';
  if (jornada <= 32) return 'Fase Regular';
  return 'Definición / Cierre';
}

export function obtenerEtiquetaCortaJornada(jornada: number): string {
  if (jornada <= 6) return `TC F${jornada}`;
  if (jornada <= 32) return `FR F${jornada - 6} (J${jornada})`;
  return `Cierre (J33)`;
}

/**
 * Reconstruye el resultado de un equipo en una jornada específica (G, E, P)
 * de forma determinística y consistente con su movimiento en la Tabla Anual.
 */
export function obtenerResultadoEquipoEnJornada(equipo: EquipoBase, jornadaIndex: number): 'G' | 'E' | 'P' | null {
  const posActual = equipo.evolucionAnual[jornadaIndex];
  const posDescenso = equipo.evolucionDescenso[jornadaIndex];
  if (posActual === null && posDescenso === null) return null;

  const posEfectiva = posActual ?? posDescenso ?? 8;
  if (jornadaIndex === 0) {
    if (posEfectiva <= 5) return 'G';
    if (posEfectiva <= 9) return 'E';
    return 'P';
  }

  const posPrevia = equipo.evolucionAnual[jornadaIndex - 1] ?? equipo.evolucionDescenso[jornadaIndex - 1] ?? posEfectiva;
  const delta = posPrevia - posEfectiva; // > 0 subió de puesto

  if (delta >= 2) return 'G';
  if (delta <= -2) return 'P';

  if (posEfectiva === 1) {
    return (jornadaIndex + equipo.id.length) % 4 === 0 ? 'E' : 'G';
  }
  if (posEfectiva <= 3) {
    if (delta > 0) return 'G';
    if (delta < 0) return 'E';
    return (jornadaIndex + equipo.abreviatura.charCodeAt(0)) % 3 === 0 ? 'E' : 'G';
  }
  if (posEfectiva >= 12) {
    if (delta > 0) return 'E';
    return (jornadaIndex + equipo.abreviatura.charCodeAt(1)) % 3 === 0 ? 'E' : 'P';
  }

  if (delta === 1) return 'G';
  if (delta === -1) return 'P';
  return 'E';
}

/**
 * Motor de Tiempo ("Fase 3"): Calcula la Tabla Anual y la Tabla del Descenso
 * exactamente en la Jornada solicitada (1 a 33).
 */
export function calcularEstadoEnJornada(jornada: number): {
  tablaAnual: FilaAnualJornada[];
  tablaDescenso: FilaDescensoJornada[];
  partidosJornada: PartidoJornada[];
  goleadores: GoleadorAcumulado[];
} {
  const jIdx = Math.max(0, Math.min(32, jornada - 1));

  // 1. Reconstrucción de estadísticas acumuladas hasta la Jornada X
  const preFilasAnual = EQUIPOS_2026.map((equipo) => {
    let g = 0;
    let e = 0;
    let p = 0;
    let gf = 0;
    let gc = 0;
    const historialResultados: ('G' | 'E' | 'P')[] = [];

    // Evaluar hasta la jornada actual (si en J33 tiene null en anual, mantiene sus PJ de J32)
    const limiteJornada = equipo.evolucionAnual[jIdx] === null && jIdx === 32 ? 31 : jIdx;

    for (let k = 0; k <= limiteJornada; k++) {
      const res = obtenerResultadoEquipoEnJornada(equipo, k);
      if (!res) continue;
      historialResultados.push(res);
      const seed = (k * 7 + equipo.abreviatura.charCodeAt(0)) % 3;
      if (res === 'G') {
        g++;
        gf += seed === 0 ? 2 : seed === 1 ? 1 : 3;
        gc += seed === 2 ? 1 : 0;
      } else if (res === 'E') {
        e++;
        const golesEmpate = seed === 0 ? 0 : 1;
        gf += golesEmpate;
        gc += golesEmpate;
      } else {
        p++;
        gf += seed === 1 ? 1 : 0;
        gc += seed === 0 ? 1 : 2;
      }
    }

    const posOficialActual = equipo.evolucionAnual[jIdx] ?? equipo.evolucionAnual[31] ?? 14;
    const posOficialAnterior = jIdx > 0 ? (equipo.evolucionAnual[jIdx - 1] ?? posOficialActual) : null;
    const pj = g + e + p;

    // Ajuste fino para que la curva de puntos sea monotónica con la posición oficial en la fecha
    const puntosBrutos = g * 3 + e;
    const racha = historialResultados.slice(-5);
    const puntosUltimos5 = racha.reduce((acc, r) => acc + (r === 'G' ? 3 : r === 'E' ? 1 : 0), 0);
    const fitnessPct = racha.length > 0 ? Math.round((puntosUltimos5 / (racha.length * 3)) * 100) : 0;

    let zona: FilaAnualJornada['zona'] = 'permanencia';
    if (equipo.evolucionAnual[jIdx] === null && jIdx === 32) {
      zona = posOficialActual <= 2 ? 'ascensoDirecto' : posOficialActual <= 6 ? 'playoffs' : 'permanencia';
    } else if (posOficialActual <= 2) {
      zona = 'ascensoDirecto';
    } else if (posOficialActual <= 6) {
      zona = 'playoffs';
    }

    return {
      posicion: posOficialActual,
      posicionAnterior: posOficialAnterior,
      variacion: posOficialAnterior !== null ? posOficialAnterior - posOficialActual : 0,
      equipo,
      pj,
      g,
      e,
      p,
      gf,
      gc,
      dg: gf - gc,
      puntos: puntosBrutos,
      racha,
      fitnessPct,
      zona,
      activoEnJornada: equipo.evolucionAnual[jIdx] !== null,
    };
  });

  // Ordenar por la posición oficial exacta de la jornada
  const tablaAnual = [...preFilasAnual].sort((a, b) => a.posicion - b.posicion);

  // Calibrar puntos y DG para que el orden de puntos sea 100% coherente con la tabla oficial de esa fecha
  const maxPosible = Math.min(jornada, 32) * 3;
  for (let i = 0; i < tablaAnual.length; i++) {
    const fila = tablaAnual[i];
    const ratioPosicion = (14 - fila.posicion) / 13; // 1.0 para el 1ro, 0.0 para el 14to
    const puntosEsperados = Math.max(
      fila.e,
      Math.min(
        maxPosible,
        Math.round(fila.pj * (0.68 + ratioPosicion * 1.48))
      )
    );
    // Garantizar que ningún equipo debajo tenga más puntos que el de arriba
    const techo = i > 0 ? tablaAnual[i - 1].puntos : maxPosible;
    const puntosFinales = Math.min(techo, puntosEsperados);

    // Recalcular G, E, P coherentes con puntosFinales y fila.pj
    let gCalc = Math.min(fila.pj, Math.floor(puntosFinales / 3));
    let eCalc = puntosFinales - gCalc * 3;
    while (gCalc + eCalc > fila.pj && gCalc > 0) {
      gCalc--;
      eCalc = puntosFinales - gCalc * 3;
    }
    if (gCalc + eCalc > fila.pj) {
      eCalc = Math.max(0, fila.pj - gCalc);
    }
    const pCalc = Math.max(0, fila.pj - gCalc - eCalc);
    const puntosReales = gCalc * 3 + eCalc;

    const dgBase = (gCalc - pCalc) * 2 + ((14 - fila.posicion) % 3) - 1;
    const gcCalc = Math.max(fila.pj > 0 ? 1 : 0, Math.round(fila.pj * 0.95 - ratioPosicion * 4));
    const gfCalc = Math.max(0, gcCalc + dgBase);

    fila.puntos = puntosReales;
    fila.g = gCalc;
    fila.e = eCalc;
    fila.p = pCalc;
    fila.gf = gfCalc;
    fila.gc = gcCalc;
    fila.dg = gfCalc - gcCalc;
  }

  // 2. Construir Tabla del Descenso (Promedios) en la Jornada X
  const mapaAnualPorId = new Map(tablaAnual.map((f) => [f.equipo.id, f]));

  const preFilasDescenso: FilaDescensoJornada[] = EQUIPOS_2026.map((equipo) => {
    const datosAnual = mapaAnualPorId.get(equipo.id)!;
    const posDescActual = equipo.evolucionDescenso[jIdx] ?? equipo.evolucionDescenso[31] ?? 14;
    const posDescAnterior = jIdx > 0 ? (equipo.evolucionDescenso[jIdx - 1] ?? posDescActual) : null;

    const puntos2025 = equipo.arrastraPromedio2025 ? equipo.puntos2025 : 0;
    const pj2025 = equipo.arrastraPromedio2025 ? equipo.pj2025 : 0;
    const puntos2026 = datosAnual.puntos;
    const pj2026 = datosAnual.pj;

    const puntosTotales = puntos2025 + puntos2026;
    const pjTotales = Math.max(1, pj2025 + pj2026);
    const promedioReal = Number((puntosTotales / pjTotales).toFixed(3));

    return {
      posicion: posDescActual,
      posicionAnterior: posDescAnterior,
      variacion: posDescAnterior !== null ? posDescAnterior - posDescActual : 0,
      equipo,
      puntos2025,
      pj2025,
      puntos2026,
      pj2026,
      puntosTotales,
      pjTotales,
      promedio: promedioReal,
      enZonaDescenso: posDescActual >= 13,
      distanciaSalvacion: 0,
      activoEnJornada: equipo.evolucionDescenso[jIdx] !== null,
    };
  });

  const tablaDescenso = [...preFilasDescenso].sort((a, b) => a.posicion - b.posicion);

  // Asegurar orden estricto de coeficientes según la posición oficial de descenso en la jornada
  for (let i = 0; i < tablaDescenso.length; i++) {
    const f = tablaDescenso[i];
    if (i > 0 && f.promedio > tablaDescenso[i - 1].promedio) {
      f.promedio = Number(Math.max(0.25, tablaDescenso[i - 1].promedio - 0.014).toFixed(3));
    }
  }

  const promedioSalvacionPuesto12 = tablaDescenso.find((f) => f.posicion === 12)?.promedio ?? 1.05;
  for (const f of tablaDescenso) {
    f.distanciaSalvacion = Number((f.promedio - promedioSalvacionPuesto12).toFixed(3));
  }

  // 3. Generar los cruces de la Jornada X (7 partidos por fecha)
  const ordenParaCruces = [...EQUIPOS_2026];
  const partidosJornada: PartidoJornada[] = [];
  const rotacion = jIdx % 13;

  // Algoritmo round-robin de 14 equipos (método del círculo)
  const fijo = ordenParaCruces[0];
  const rotables = ordenParaCruces.slice(1);
  const rotados = [
    ...rotables.slice(rotacion),
    ...rotables.slice(0, rotacion),
  ];
  const emparejados = [fijo, ...rotados];

  for (let pIdx = 0; pIdx < 7; pIdx++) {
    const eqA = emparejados[pIdx];
    const eqB = emparejados[13 - pIdx];
    const invertirLocalia = (jIdx + pIdx) % 2 === 1;
    const local = invertirLocalia ? eqB : eqA;
    const visitante = invertirLocalia ? eqA : eqB;

    const resLocal = obtenerResultadoEquipoEnJornada(local, jIdx);
    const resVisitante = obtenerResultadoEquipoEnJornada(visitante, jIdx);

    let golesLocal = 1;
    let golesVisitante = 1;

    if (resLocal === 'G' || resVisitante === 'P') {
      golesLocal = ((jIdx + pIdx) % 2) + 1;
      golesVisitante = golesLocal - 1;
    } else if (resVisitante === 'G' || resLocal === 'P') {
      golesVisitante = ((jIdx + pIdx) % 2) + 1;
      golesLocal = golesVisitante - 1;
    } else {
      golesLocal = (jIdx + pIdx) % 2;
      golesVisitante = golesLocal;
    }

    const goleadoresPartido: string[] = [];
    if (golesLocal > 0) {
      const golLocal = BASE_GOLEADORES.find((g) => g.equipoId === local.id);
      goleadoresPartido.push(`${golLocal ? golLocal.nombre : local.abreviatura} (${22 + pIdx * 9}')`);
    }
    if (golesVisitante > 0) {
      const golVis = BASE_GOLEADORES.find((g) => g.equipoId === visitante.id);
      goleadoresPartido.push(`${golVis ? golVis.nombre : visitante.abreviatura} (${58 + pIdx * 5}')`);
    }

    partidosJornada.push({
      id: `j${jornada}-p${pIdx + 1}`,
      jornada,
      torneo: obtenerNombreTorneoJornada(jornada),
      localId: local.id,
      visitanteId: visitante.id,
      golesLocal,
      golesVisitante,
      estadio: local.estadio,
      goleadores: goleadoresPartido,
    });
  }

  // 4. Tabla de Goleadores acumulada hasta la Jornada X
  const factorProgreso = Math.min(1, jornada / 32);
  const goleadores: GoleadorAcumulado[] = BASE_GOLEADORES.map((g, idx) => {
    const golesActuales = Math.max(
      jornada >= 2 && idx < 4 ? 1 : 0,
      Math.round(g.totalGoles * Math.pow(factorProgreso, 0.92))
    );
    const penalesActuales = Math.min(golesActuales, Math.round(g.penales * factorProgreso));
    return {
      id: g.id,
      nombre: g.nombre,
      equipoId: g.equipoId,
      goles: golesActuales,
      penales: penalesActuales,
      partidosAnotando: Math.max(0, golesActuales - (golesActuales >= 4 ? 2 : 0)),
    };
  }).sort((a, b) => b.goles - a.goles);

  return {
    tablaAnual,
    tablaDescenso,
    partidosJornada,
    goleadores,
  };
}

export interface DatoCurioso {
  id: string;
  titulo: string;
  valorPrincipal: string;
  detalle: string;
  equipo: EquipoBase;
}

export function calcularDatosCuriososEnJornada(
  jornada: number,
  modo: 'anual' | 'descenso'
): DatoCurioso[] {
  const jClamped = Math.max(1, Math.min(33, Math.floor(jornada)));
  const jIdx = jClamped - 1;
  const { tablaAnual, tablaDescenso } = calcularEstadoEnJornada(jClamped);

  // 1. Más goles hechos (hasta la fecha J)
  const masGoleador = [...tablaAnual].sort((a, b) => b.gf - a.gf || b.dg - a.dg)[0];

  // 2. Más tiempo en último lugar (puesto 14° hasta la fecha J)
  const conteoUltimo = EQUIPOS_2026.map((eq) => {
    const serie = modo === 'anual' ? eq.evolucionAnual : eq.evolucionDescenso;
    let fechas = 0;
    for (let k = 0; k <= jIdx; k++) {
      if (serie[k] === 14) fechas++;
    }
    return { equipo: eq, fechas };
  }).sort((a, b) => b.fechas - a.fechas);

  const masTiempoUltimo = conteoUltimo[0];
  const fallbackUltimo =
    modo === 'anual' ? tablaAnual[tablaAnual.length - 1].equipo : tablaDescenso[tablaDescenso.length - 1].equipo;

  // 3. Mayor diferencia entre Tabla de Descenso y Tabla Anual (Ascenso) en la fecha J
  const diferencias = EQUIPOS_2026.map((eq) => {
    const posAnual = eq.evolucionAnual[jIdx] ?? eq.evolucionAnual[31] ?? 14;
    const posDesc = eq.evolucionDescenso[jIdx] ?? eq.evolucionDescenso[31] ?? 14;
    return {
      equipo: eq,
      posAnual,
      posDesc,
      diff: Math.abs(posAnual - posDesc),
    };
  }).sort((a, b) => b.diff - a.diff);

  const mayorDiferencia = diferencias[0];

  // 4. Más tiempo como puntero (1° puesto hasta la fecha J)
  const conteoPuntero = EQUIPOS_2026.map((eq) => {
    const serie = modo === 'anual' ? eq.evolucionAnual : eq.evolucionDescenso;
    let fechas = 0;
    for (let k = 0; k <= jIdx; k++) {
      if (serie[k] === 1) fechas++;
    }
    return { equipo: eq, fechas };
  }).sort((a, b) => b.fechas - a.fechas);

  const masTiempoPuntero = conteoPuntero[0];

  // 5. Mayor escalada desde la Fecha 1 hasta la Fecha J
  const escaladas = EQUIPOS_2026.map((eq) => {
    const serie = modo === 'anual' ? eq.evolucionAnual : eq.evolucionDescenso;
    const posJ1 = serie[0] ?? 14;
    const posActual = serie[jIdx] ?? serie[31] ?? posJ1;
    return {
      equipo: eq,
      posJ1,
      posActual,
      salto: posJ1 - posActual,
    };
  }).sort((a, b) => b.salto - a.salto);

  const mayorSalto = escaladas[0];

  // 6. Valla menos vencida (menos goles recibidos hasta J)
  const menosVencida = [...tablaAnual].sort((a, b) => a.gc - b.gc || b.puntos - a.puntos)[0];

  return [
    {
      id: 'mas-goles',
      titulo: 'Más goles hechos',
      valorPrincipal: `${masGoleador.gf} goles`,
      detalle: `${masGoleador.equipo.nombre} · ${masGoleador.pj} PJ (DG ${
        masGoleador.dg >= 0 ? `+${masGoleador.dg}` : masGoleador.dg
      })`,
      equipo: masGoleador.equipo,
    },
    {
      id: 'ultimo-lugar',
      titulo: 'Más tiempo en último lugar',
      valorPrincipal:
        masTiempoUltimo.fechas > 0
          ? `${masTiempoUltimo.fechas} ${masTiempoUltimo.fechas === 1 ? 'fecha' : 'fechas'}`
          : '0 fechas',
      detalle:
        masTiempoUltimo.fechas > 0
          ? `${masTiempoUltimo.equipo.nombre} en el puesto 14° (${modo === 'anual' ? 'Anual' : 'Descenso'})`
          : `${fallbackUltimo.nombre} cierra la tabla en J${jClamped}`,
      equipo: masTiempoUltimo.fechas > 0 ? masTiempoUltimo.equipo : fallbackUltimo,
    },
    {
      id: 'mayor-brecha',
      titulo: 'Mayor brecha Ascenso vs Descenso',
      valorPrincipal: `${mayorDiferencia.diff} ${mayorDiferencia.diff === 1 ? 'puesto' : 'puestos'}`,
      detalle: `${mayorDiferencia.equipo.nombre} · ${mayorDiferencia.posAnual}° Anual vs ${mayorDiferencia.posDesc}° Descenso`,
      equipo: mayorDiferencia.equipo,
    },
    {
      id: 'mas-puntero',
      titulo: 'Más tiempo puntero (1°)',
      valorPrincipal: `${masTiempoPuntero.fechas} ${masTiempoPuntero.fechas === 1 ? 'fecha' : 'fechas'}`,
      detalle: `${masTiempoPuntero.equipo.nombre} liderando la tabla hasta J${jClamped}`,
      equipo: masTiempoPuntero.equipo,
    },
    {
      id: 'mayor-salto',
      titulo: 'Mayor remontada desde J1',
      valorPrincipal: mayorSalto.salto > 0 ? `+${mayorSalto.salto} puestos` : 'Sin ascenso',
      detalle:
        mayorSalto.salto > 0
          ? `${mayorSalto.equipo.nombre} subió del ${mayorSalto.posJ1}° al ${mayorSalto.posActual}°`
          : `${mayorSalto.equipo.nombre} mantiene su posición (${mayorSalto.posActual}°)`,
      equipo: mayorSalto.equipo,
    },
    {
      id: 'valla-invicta',
      titulo: 'Valla menos vencida',
      valorPrincipal: `${menosVencida.gc} en contra`,
      detalle: `${menosVencida.equipo.nombre} · ${(menosVencida.gc / Math.max(1, menosVencida.pj)).toFixed(2)} goles/PJ`,
      equipo: menosVencida.equipo,
    },
  ];
}

