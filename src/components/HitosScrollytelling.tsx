import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { ChevronDown } from 'lucide-react';
import {
  WikiDataset,
  FixtureMatch,
  leerWikiCache,
  scrapeAndCacheWikipedia,
  normalizeStadiumName,
  AUTO_SYNC_TTL_MS,
} from './WikiSandbox';
import {
  EQUIPOS_2026,
  EquipoBase,
  normalizarClaveClub,
} from '../data/segunda2026Data';

const MESES_ES: Record<string, number> = {
  enero: 0,
  febrero: 1,
  marzo: 2,
  abril: 3,
  mayo: 4,
  junio: 5,
  julio: 6,
  agosto: 7,
  septiembre: 8,
  setiembre: 8,
  octubre: 9,
  noviembre: 10,
  diciembre: 11,
};

const NOMBRES_MESES_CORTOS = [
  'ENE',
  'FEB',
  'MAR',
  'ABR',
  'MAY',
  'JUN',
  'JUL',
  'AGO',
  'SEP',
  'OCT',
  'NOV',
  'DIC',
];

const DIAS_SEMANA_HEADER = [
  'LUNES',
  'MARTES',
  'MIÉRCOLES',
  'JUEVES',
  'VIERNES',
  'SÁBADO',
  'DOMINGO',
];
const DIAS_SEMANA_CORTOS = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];
const NOMBRES_DIAS_SEMANA = [
  'DOMINGO',
  'LUNES',
  'MARTES',
  'MIÉRCOLES',
  'JUEVES',
  'VIERNES',
  'SÁBADO',
];

function buscarEquipoBase(nombre: string): EquipoBase | undefined {
  const key = normalizarClaveClub(nombre);
  return EQUIPOS_2026.find((e) => normalizarClaveClub(e.nombre) === key);
}

interface TeamBadgeProps {
  teamName: string;
  wikiLogoUrl?: string;
  size?: number;
}

const TeamBadge: React.FC<TeamBadgeProps> = ({
  teamName,
  wikiLogoUrl,
  size = 44,
}) => {
  const [imgError, setImgError] = useState(false);
  const base = buscarEquipoBase(teamName);
  const src = base?.escudoUrl || wikiLogoUrl;

  if (src && !imgError) {
    return (
      <img
        src={src}
        alt={teamName}
        width={size}
        height={size}
        referrerPolicy="no-referrer"
        onError={() => setImgError(true)}
        className="shrink-0 object-contain select-none"
        style={{ width: size, height: size }}
      />
    );
  }

  const initials =
    base?.abreviatura ||
    teamName
      .split(/\s+/)
      .map((w) => w[0])
      .join('')
      .slice(0, 3)
      .toUpperCase();

  return (
    <div
      className="shrink-0 rounded-full flex items-center justify-center font-mono font-bold text-white select-none"
      style={{
        width: size,
        height: size,
        backgroundColor: base?.colorPrimario || '#0F172A',
        fontSize: Math.max(10, Math.round(size * 0.34)),
      }}
    >
      {initials}
    </div>
  );
};

function parseSpanishDate2026(diaStr: string): {
  dateKey: string;
  month: number;
  day: number;
  dayOfWeek: number;
} | null {
  const cleaned = diaStr.toLowerCase().trim();
  const match = cleaned.match(/(\d{1,2})\s+de\s+([a-záéíóú]+)/i);
  if (!match) return null;
  const day = parseInt(match[1], 10);
  const monthName = match[2].toLowerCase();
  const month = MESES_ES[monthName];
  if (month === undefined || Number.isNaN(day)) return null;

  const d = new Date(2026, month, day);
  const pad = (n: number) => String(n).padStart(2, '0');
  const dateKey = `2026-${pad(month + 1)}-${pad(day)}`;
  return {
    dateKey,
    month,
    day,
    dayOfWeek: d.getDay(),
  };
}

function isMorningOrNoonHour(horaStr: string): boolean {
  const m = horaStr.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return false;
  const hh = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  const totalMin = hh * 60 + mm;
  return totalMin >= 540 && totalMin <= 750;
}

export const HitosScrollytelling: React.FC = () => {
  const [dataset, setDataset] = useState<WikiDataset | null>(() =>
    leerWikiCache()
  );
  const [loading, setLoading] = useState<boolean>(false);
  const section2Ref = useRef<HTMLElement | null>(null);

  // Pantalla 1 state
  const [goleadaMode, setGoleadaMode] = useState<'total' | 'diff'>('total');
  const [selectedDiffIdx, setSelectedDiffIdx] = useState<number>(0);

  // Pantalla 4 state (hovered stadium in bubble cloud)
  const [activeStadiumName, setActiveStadiumName] = useState<string | null>(
    null
  );

  // Pantalla 5 state (calendar filter & hovered/clicked date tooltip)
  const [calendarFilter, setCalendarFilter] = useState<
    'all' | 'midweek' | 'morning'
  >('all');
  const [activeDateKey, setActiveDateKey] = useState<string | null>(null);

  useEffect(() => {
    const cached = leerWikiCache();
    if (cached && Date.now() - cached.timestamp <= AUTO_SYNC_TTL_MS) {
      setDataset(cached);
      return;
    }
    setLoading(true);
    scrapeAndCacheWikipedia()
      .then((fresh) => setDataset(fresh))
      .catch(() => {
        // fallback if offline
      })
      .finally(() => setLoading(false));
  }, []);

  // =========================================================================
  // CÁLCULO PANTALLA 1: MAYOR GOLEADA / PARTIDO CON MÁS GOLES
  // =========================================================================
  const goleadasData = useMemo(() => {
    const valid = (dataset?.fixtures || []).filter(
      (f) => f.golesL !== null && f.golesV !== null
    );
    if (valid.length === 0) return null;

    let maxTotal = -1;
    let maxDiff = -1;

    valid.forEach((f) => {
      const total = (f.golesL ?? 0) + (f.golesV ?? 0);
      const diff = Math.abs((f.golesL ?? 0) - (f.golesV ?? 0));
      if (total > maxTotal) maxTotal = total;
      if (diff > maxDiff) maxDiff = diff;
    });

    const topTotalMatches = valid.filter(
      (f) => (f.golesL ?? 0) + (f.golesV ?? 0) === maxTotal
    );
    const topDiffMatches = valid.filter(
      (f) => Math.abs((f.golesL ?? 0) - (f.golesV ?? 0)) === maxDiff
    );

    return {
      maxTotal,
      maxDiff,
      topTotalMatch: topTotalMatches[0],
      topDiffMatches,
    };
  }, [dataset]);

  // =========================================================================
  // CÁLCULO PANTALLA 2: MAYORES RACHAS DE LA TEMPORADA
  // =========================================================================
  const rachasData = useMemo(() => {
    const validFixtures = (dataset?.fixtures || []).filter(
      (f) => f.golesL !== null && f.golesV !== null
    );

    interface TeamMatchEntry {
      etiquetaFecha: string;
      gf: number;
      gc: number;
    }

    const matchesByClub = new Map<string, { nombre: string; list: TeamMatchEntry[] }>();
    EQUIPOS_2026.forEach((eq) => {
      matchesByClub.set(normalizarClaveClub(eq.nombre), {
        nombre: eq.nombre,
        list: [],
      });
    });

    validFixtures.forEach((f) => {
      const gl = f.golesL ?? 0;
      const gv = f.golesV ?? 0;
      const shortFase = f.fase.toLowerCase().includes('competencia')
        ? 'TC'
        : 'FR';
      const etiqueta = `${shortFase} ${f.fechaNro}`;

      const entryL = matchesByClub.get(normalizarClaveClub(f.local));
      if (entryL) {
        entryL.list.push({ etiquetaFecha: etiqueta, gf: gl, gc: gv });
      }
      const entryV = matchesByClub.get(normalizarClaveClub(f.visitante));
      if (entryV) {
        entryV.list.push({ etiquetaFecha: etiqueta, gf: gv, gc: gl });
      }
    });

    const computeBestStreak = (
      predicate: (m: TeamMatchEntry) => boolean
    ): {
      equipo: string;
      cantidad: number;
      desde: string;
      hasta: string;
    } => {
      let bestEquipo = 'Plaza Colonia';
      let bestCount = 0;
      let bestDesde = '';
      let bestHasta = '';

      matchesByClub.forEach(({ nombre, list }) => {
        let curCount = 0;
        let curDesde = '';
        list.forEach((m) => {
          if (predicate(m)) {
            if (curCount === 0) curDesde = m.etiquetaFecha;
            curCount++;
            if (curCount > bestCount) {
              bestCount = curCount;
              bestEquipo = nombre;
              bestDesde = curDesde;
              bestHasta = m.etiquetaFecha;
            }
          } else {
            curCount = 0;
          }
        });
      });

      return {
        equipo: bestEquipo,
        cantidad: bestCount,
        desde: bestDesde,
        hasta: bestHasta,
      };
    };

    return [
      {
        id: 'sin-perder',
        titulo: 'MAYOR RACHA SIN PERDER',
        accentClass: 'text-emerald-800 bg-emerald-50 border-emerald-300',
        ...computeBestStreak((m) => m.gf >= m.gc),
      },
      {
        id: 'arco-vacio',
        titulo: 'MAYOR RACHA CON EL ARCO VACÍO',
        accentClass: 'text-sky-800 bg-sky-50 border-sky-300',
        ...computeBestStreak((m) => m.gc === 0),
      },
      {
        id: 'derrotas',
        titulo: 'MAYOR RACHA DE DERROTAS',
        accentClass: 'text-rose-800 bg-rose-50 border-rose-300',
        ...computeBestStreak((m) => m.gf < m.gc),
      },
      {
        id: 'empates',
        titulo: 'MAYOR RACHA DE EMPATES',
        accentClass: 'text-amber-800 bg-amber-50 border-amber-300',
        ...computeBestStreak((m) => m.gf === m.gc),
      },
    ];
  }, [dataset]);

  // =========================================================================
  // CÁLCULO PANTALLAS 3 Y 4: ESTADIOS (UNIFICADOS CON DESGLOSE DE EQUIPOS)
  // =========================================================================
  const stadiumsData = useMemo(() => {
    const map = new Map<
      string,
      {
        estadio: string;
        pj: number;
        goles: number;
        localesCount: Map<string, number>;
        equiposCount: Map<string, number>;
      }
    >();

    (dataset?.fixtures || []).forEach((f) => {
      const normName = normalizeStadiumName(f.estadio || '');
      if (!normName) return;
      let entry = map.get(normName);
      if (!entry) {
        entry = {
          estadio: normName,
          pj: 0,
          goles: 0,
          localesCount: new Map<string, number>(),
          equiposCount: new Map<string, number>(),
        };
        map.set(normName, entry);
      }
      entry.pj += 1;
      entry.goles += (f.golesL ?? 0) + (f.golesV ?? 0);
      if (f.local) {
        entry.localesCount.set(
          f.local,
          (entry.localesCount.get(f.local) || 0) + 1
        );
        entry.equiposCount.set(
          f.local,
          (entry.equiposCount.get(f.local) || 0) + 1
        );
      }
      if (f.visitante) {
        entry.equiposCount.set(
          f.visitante,
          (entry.equiposCount.get(f.visitante) || 0) + 1
        );
      }
    });

    const list = Array.from(map.values())
      .map((item) => {
        const localesSorted = Array.from(item.localesCount.entries())
          .sort((a, b) => b[1] - a[1])
          .filter(([_, count]) => count >= 2 || item.pj <= 4)
          .map(([club, count]) => ({ club, count }));

        const equiposSorted = Array.from(item.equiposCount.entries())
          .sort(
            (a, b) =>
              b[1] - a[1] ||
              (item.localesCount.get(b[0]) || 0) -
                (item.localesCount.get(a[0]) || 0)
          )
          .map(([club, count]) => ({
            club,
            count,
            esLocalHabitual: (item.localesCount.get(club) || 0) >= 2,
          }));

        return {
          estadio: item.estadio,
          pj: item.pj,
          goles: item.goles,
          promedioGoles:
            item.pj > 0 ? (item.goles / item.pj).toFixed(2) : '0.00',
          locales: localesSorted,
          equipos: equiposSorted,
        };
      })
      .sort((a, b) => b.pj - a.pj || b.goles - a.goles);

    return {
      list,
      topStadium: list[0] || null,
      bottomStadium: list[list.length - 1] || null,
    };
  }, [dataset]);

  // =========================================================================
  // CÁLCULO PANTALLA 5: HEATMAP DEL CALENDARIO (MARZO A NOVIEMBRE 2026)
  // =========================================================================
  const calendarData = useMemo(() => {
    const byDate = new Map<
      string,
      {
        dateKey: string;
        month: number;
        day: number;
        dayOfWeek: number;
        matches: FixtureMatch[];
        hasMidweek: boolean;
        hasMorning: boolean;
      }
    >();

    (dataset?.fixtures || []).forEach((f) => {
      const parsed = parseSpanishDate2026(f.dia);
      if (!parsed) return;
      let entry = byDate.get(parsed.dateKey);
      if (!entry) {
        entry = {
          ...parsed,
          matches: [],
          hasMidweek:
            parsed.dayOfWeek === 2 ||
            parsed.dayOfWeek === 3 ||
            parsed.dayOfWeek === 4,
          hasMorning: false,
        };
        byDate.set(parsed.dateKey, entry);
      }
      entry.matches.push(f);
      if (isMorningOrNoonHour(f.hora)) {
        entry.hasMorning = true;
      }
    });

    return byDate;
  }, [dataset]);

  // =========================================================================
  // CÁLCULO PANTALLA 6: SAD vs. ASOCIACIÓN CIVIL (ORDENADO POR TABLA)
  // =========================================================================
  const sadVsAcData = useMemo(() => {
    const standingsMap = new Map<
      string,
      { pos: number; pts: number; pj: number; dif: number; logoUrl?: string }
    >();
    (dataset?.standings.anual || []).forEach((s) => {
      standingsMap.set(normalizarClaveClub(s.equipo), {
        pos: s.pos,
        pts: s.pts,
        pj: s.pj,
        dif: s.dif,
        logoUrl: s.logoUrl,
      });
    });

    const juridicaMap = new Map<string, 'SAD' | 'AC'>();
    (dataset?.teamsAndCoaches || []).forEach((t) => {
      const raw = t.formaJuridica.toUpperCase();
      juridicaMap.set(
        normalizarClaveClub(t.equipo),
        raw.includes('SAD') ? 'SAD' : 'AC'
      );
    });

    const fallbackSadKeys = new Set(
      [
        'Cerrito',
        'Colón',
        'Huracán',
        'La Luz',
        'Miramar Misiones',
        'Oriental',
        'Paysandú',
        'Plaza Colonia',
        'Rentistas',
      ].map(normalizarClaveClub)
    );

    const clubs = EQUIPOS_2026.map((eq, idx) => {
      const key = normalizarClaveClub(eq.nombre);
      const st = standingsMap.get(key);
      const tipo: 'SAD' | 'AC' =
        juridicaMap.get(key) || (fallbackSadKeys.has(key) ? 'SAD' : 'AC');

      return {
        id: eq.id,
        equipo: eq.nombre,
        abreviatura: eq.abreviatura,
        color: eq.colorPrimario,
        logoUrl: st?.logoUrl,
        tipo,
        pos: st?.pos ?? idx + 1,
        pts: st?.pts ?? 0,
        pj: st?.pj ?? 32,
        dif: st?.dif ?? 0,
      };
    }).sort((a, b) => a.pos - b.pos);

    const sadClubs = clubs.filter((c) => c.tipo === 'SAD');
    const acClubs = clubs.filter((c) => c.tipo === 'AC');

    const promSad =
      sadClubs.length > 0
        ? (
            sadClubs.reduce((acc, c) => acc + c.pts, 0) / sadClubs.length
          ).toFixed(1)
        : '0.0';
    const promAc =
      acClubs.length > 0
        ? (acClubs.reduce((acc, c) => acc + c.pts, 0) / acClubs.length).toFixed(
            1
          )
        : '0.0';

    return {
      allRanked: clubs,
      sadCount: sadClubs.length,
      acCount: acClubs.length,
      promSad,
      promAc,
    };
  }, [dataset]);

  // =========================================================================
  // CÁLCULO PANTALLA 7: LLAVE DE PLAY-OFFS POR EL 3° ASCENSO
  // =========================================================================
  const playoffsData = useMemo(() => {
    const standingsMap = new Map<
      string,
      { pos: number; pts: number; logoUrl?: string }
    >();
    (dataset?.standings.anual || []).forEach((s) => {
      standingsMap.set(normalizarClaveClub(s.equipo), {
        pos: s.pos,
        pts: s.pts,
        logoUrl: s.logoUrl,
      });
    });

    const getClubMeta = (name: string, defaultSeed: number) => {
      const st = standingsMap.get(normalizarClaveClub(name));
      return {
        nombre: name,
        seed: defaultSeed,
        posAnual: st?.pos ?? defaultSeed,
        pts: st?.pts ?? 0,
        logoUrl: st?.logoUrl,
      };
    };

    const semis = dataset?.playoffs.semifinales || [];
    const semi1Matches = semis.filter(
      (m) =>
        normalizarClaveClub(m.local).includes('fenix') ||
        normalizarClaveClub(m.local).includes('atenas')
    );
    const semi2Matches = semis.filter(
      (m) =>
        normalizarClaveClub(m.local).includes('oriental') ||
        normalizarClaveClub(m.local).includes('colon')
    );

    return {
      semi1: {
        id: 'SF1',
        teamA: getClubMeta('Atenas', 3),
        teamB: getClubMeta('Fénix', 6),
        notaSeedB: 'Campeón Competencia',
        ida: semi1Matches[0] || {
          dia: '15 de noviembre de 2026',
          hora: '16:30',
          local: 'Fénix',
          visitante: 'Atenas',
          resultadoRaw: 'vs.',
          estadio: 'Parque Capurro, Montevideo',
        },
        vuelta: semi1Matches[1] || {
          dia: '18 de noviembre de 2026',
          hora: '16:30',
          local: 'Atenas',
          visitante: 'Fénix',
          resultadoRaw: 'vs.',
          estadio: 'Estadio Ateniense, San Carlos',
        },
      },
      semi2: {
        id: 'SF2',
        teamA: getClubMeta('Colón', 4),
        teamB: getClubMeta('Oriental', 5),
        notaSeedB: '5° Tabla Anual',
        ida: semi2Matches[0] || {
          dia: '15 de noviembre de 2026',
          hora: '19:30',
          local: 'Oriental',
          visitante: 'Colón',
          resultadoRaw: 'vs.',
          estadio: 'Parque Palermo, Montevideo',
        },
        vuelta: semi2Matches[1] || {
          dia: '18 de noviembre de 2026',
          hora: '19:30',
          local: 'Colón',
          visitante: 'Oriental',
          resultadoRaw: 'vs.',
          estadio: 'Parque Palermo, Montevideo',
        },
      },
      finalMatches: dataset?.playoffs.finalPlayoff || [],
    };
  }, [dataset]);

  const continuousCalendarCells = useMemo(() => {
    const cells: (
      | { type: 'empty'; key: string }
      | {
          type: 'day';
          dateKey: string;
          monthIdx: number;
          dayNum: number;
          colIdx: number;
        }
    )[] = [];

    const firstDayJs = new Date(2026, 2, 1).getDay();
    const leadingEmpty = (firstDayJs + 6) % 7;
    for (let e = 0; e < leadingEmpty; e++) {
      cells.push({ type: 'empty', key: `lead-${e}` });
    }

    const pad = (n: number) => String(n).padStart(2, '0');
    for (let monthIdx = 2; monthIdx <= 10; monthIdx++) {
      const daysInMonth = new Date(2026, monthIdx + 1, 0).getDate();
      for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
        const jsDay = new Date(2026, monthIdx, dayNum).getDay();
        const colIdx = (jsDay + 6) % 7; // 0 = Lunes .. 6 = Domingo
        cells.push({
          type: 'day',
          dateKey: `2026-${pad(monthIdx + 1)}-${pad(dayNum)}`,
          monthIdx,
          dayNum,
          colIdx,
        });
      }
    }

    return cells;
  }, []);

  if (!dataset && loading) {
    return (
      <div className="min-h-screen bg-white text-slate-900 flex items-center justify-center font-mono text-xs">
        SCRAPING_WIKIPEDIA_DOM...
      </div>
    );
  }

  const activeGoleadaMatch: FixtureMatch | undefined =
    goleadaMode === 'total'
      ? goleadasData?.topTotalMatch
      : goleadasData?.topDiffMatches[selectedDiffIdx] ||
        goleadasData?.topDiffMatches[0];

  const inspectedStadium =
    stadiumsData.list.find((s) => s.estadio === activeStadiumName) ||
    stadiumsData.topStadium;

  return (
    <div className="h-[calc(100vh-41px)] overflow-y-scroll snap-y snap-mandatory scroll-smooth bg-white text-slate-950 select-text">
      {/* =====================================================================
          PANTALLA 1: MAYOR GOLEADA / PARTIDO CON MÁS GOLES (100vh)
         ===================================================================== */}
      <section className="min-h-[calc(100vh-41px)] w-full flex flex-col justify-between items-center snap-start px-4 sm:px-8 py-8 sm:py-10 border-b border-slate-200 relative">
        <div className="hidden sm:block" />

        <div className="w-full max-w-5xl mx-auto flex flex-col items-center gap-8 my-auto">
          <div className="flex flex-col items-center gap-3">
            <span className="font-mono text-[11px] font-bold tracking-widest uppercase text-slate-500">
              01 / 07 • HITO DE GOLES
            </span>

            {/* Toggle minimalista arriba del marcador */}
            <div className="flex flex-wrap items-center justify-center gap-1.5 p-1 bg-slate-100 border border-slate-300 rounded-lg font-mono text-xs">
              <button
                type="button"
                onClick={() => setGoleadaMode('total')}
                className={`px-3 py-1.5 rounded-md font-bold transition-colors cursor-pointer tabular-nums ${
                  goleadaMode === 'total'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-700 hover:text-slate-950'
                }`}
              >
                [MÁS GOLES TOTALES (
                {goleadasData?.topTotalMatch
                  ? `${goleadasData.topTotalMatch.golesL}:${goleadasData.topTotalMatch.golesV}`
                  : '6:4'}
                )]
              </button>
              <button
                type="button"
                onClick={() => {
                  setGoleadaMode('diff');
                  setSelectedDiffIdx(0);
                }}
                className={`px-3 py-1.5 rounded-md font-bold transition-colors cursor-pointer tabular-nums ${
                  goleadaMode === 'diff'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-700 hover:text-slate-950'
                }`}
              >
                [MAYOR DIFERENCIA (
                {goleadasData?.topDiffMatches?.[0]
                  ? `${goleadasData.topDiffMatches[0].golesL}:${goleadasData.topDiffMatches[0].golesV}`
                  : '4:0'}
                )]
              </button>
            </div>

            {goleadaMode === 'diff' &&
              goleadasData &&
              goleadasData.topDiffMatches.length > 1 && (
                <div className="flex flex-wrap items-center justify-center gap-1.5 font-mono text-[11px]">
                  {goleadasData.topDiffMatches.map((m, idx) => (
                    <button
                      key={`${m.local}-${m.visitante}-${idx}`}
                      type="button"
                      onClick={() => setSelectedDiffIdx(idx)}
                      className={`px-2.5 py-1 rounded border cursor-pointer tabular-nums ${
                        selectedDiffIdx === idx
                          ? 'bg-sky-700 text-white border-sky-800 font-bold'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      {m.local} {m.golesL}:{m.golesV} {m.visitante}
                    </button>
                  ))}
                </div>
              )}
          </div>

          {activeGoleadaMatch && (
            <motion.div
              key={`${goleadaMode}-${activeGoleadaMatch.local}-${activeGoleadaMatch.visitante}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="w-full flex flex-col items-center gap-6"
            >
              {/* Marcador Gigante con números en una sola línea horizontal */}
              <div className="w-full flex flex-col md:flex-row items-center justify-between gap-6 py-8 px-6 sm:px-10 bg-slate-50 border border-slate-300 rounded-2xl shadow-xs">
                {/* Local */}
                <div className="flex-1 flex flex-col sm:flex-row items-center justify-end gap-4 text-center sm:text-right min-w-0">
                  <span className="text-2xl sm:text-4xl font-black tracking-tight text-slate-950 order-2 sm:order-1">
                    {activeGoleadaMatch.local}
                  </span>
                  <div className="order-1 sm:order-2 shrink-0">
                    <TeamBadge teamName={activeGoleadaMatch.local} size={68} />
                  </div>
                </div>

                {/* Score (Siempre en línea horizontal sin salto de línea) */}
                <div className="shrink-0 flex items-center justify-center px-4">
                  <span className="text-6xl sm:text-8xl font-mono font-black tracking-tight tabular-nums text-slate-950 whitespace-nowrap leading-none">
                    {activeGoleadaMatch.golesL} : {activeGoleadaMatch.golesV}
                  </span>
                </div>

                {/* Visitante */}
                <div className="flex-1 flex flex-col sm:flex-row items-center justify-start gap-4 text-center sm:text-left min-w-0">
                  <div className="shrink-0">
                    <TeamBadge
                      teamName={activeGoleadaMatch.visitante}
                      size={68}
                    />
                  </div>
                  <span className="text-2xl sm:text-4xl font-black tracking-tight text-slate-950">
                    {activeGoleadaMatch.visitante}
                  </span>
                </div>
              </div>

              {/* Solo Fecha y Estadio */}
              <div className="font-mono text-sm font-bold uppercase tracking-widest text-slate-800 text-center tabular-nums px-4 py-2 bg-slate-100 border border-slate-300 rounded-md">
                {activeGoleadaMatch.fechaNro} — Estadio{' '}
                {activeGoleadaMatch.estadio}
              </div>
            </motion.div>
          )}
        </div>

        {/* Indicador en la primera pantalla para bajar a ver más datos */}
        <button
          type="button"
          onClick={() =>
            section2Ref.current?.scrollIntoView({ behavior: 'smooth' })
          }
          className="group flex flex-col items-center gap-1 pt-2 pb-1 text-slate-700 hover:text-slate-950 cursor-pointer transition-colors"
        >
          <span className="font-mono text-xs font-bold uppercase tracking-wider px-3.5 py-1.5 rounded-full bg-slate-100 group-hover:bg-slate-200 border border-slate-300">
            Bajá para ver más datos de la temporada
          </span>
          <ChevronDown className="w-5 h-5 text-sky-700 animate-bounce" />
        </button>
      </section>

      {/* =====================================================================
          PANTALLA 2: MAYORES RACHAS DE LA TEMPORADA (100vh)
         ===================================================================== */}
      <section
        ref={section2Ref}
        className="min-h-[calc(100vh-41px)] w-full flex flex-col justify-center items-center snap-start px-4 sm:px-8 py-12 border-b border-slate-200"
      >
        <div className="w-full max-w-5xl mx-auto space-y-8">
          <div className="text-center space-y-1">
            <span className="font-mono text-[11px] font-bold tracking-widest uppercase text-slate-500 block">
              02 / 07 • RÉCORDS CONSECUTIVOS
            </span>
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight uppercase text-slate-950">
              MAYORES RACHAS
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {rachasData.map((racha) => (
              <div
                key={racha.id}
                className="p-6 bg-slate-50 border border-slate-300 rounded-2xl flex items-center justify-between gap-4 shadow-xs"
              >
                <div className="space-y-2 min-w-0">
                  <span
                    className={`inline-block px-2.5 py-0.5 rounded border font-mono text-[11px] font-bold uppercase tracking-wider ${racha.accentClass}`}
                  >
                    {racha.titulo}
                  </span>
                  <div className="text-4xl sm:text-5xl font-mono font-black tabular-nums text-slate-950 leading-none">
                    {racha.cantidad} PARTIDOS
                  </div>
                  <div className="text-lg sm:text-xl font-black text-slate-900 truncate">
                    {racha.equipo}
                  </div>
                  <div className="font-mono text-xs font-semibold text-slate-600 tabular-nums">
                    {racha.desde} → {racha.hasta}
                  </div>
                </div>
                <TeamBadge teamName={racha.equipo} size={72} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =====================================================================
          PANTALLA 3: SEDE CON MÁS PARTIDOS JUGADOS (100vh)
         ===================================================================== */}
      <section className="min-h-[calc(100vh-41px)] w-full flex flex-col justify-center items-center snap-start px-4 sm:px-8 py-14 border-b border-slate-200">
        {stadiumsData.topStadium && (
          <div className="w-full max-w-5xl mx-auto flex flex-col items-center text-center gap-6">
            <span className="font-mono text-xs sm:text-sm font-bold tracking-widest uppercase text-slate-600">
              03 / 07 • Sede con más partidos jugados
            </span>

            <div className="inline-flex items-center px-5 py-2 rounded-full bg-sky-100 border-2 border-sky-700">
              <span className="text-3xl sm:text-5xl font-mono font-black tabular-nums text-sky-800">
                {stadiumsData.topStadium.pj} partidos jugados
              </span>
            </div>

            <h2 className="text-5xl sm:text-7xl md:text-8xl font-black tracking-tight uppercase text-slate-950 leading-none">
              {stadiumsData.topStadium.estadio}
            </h2>

            {/* Lista horizontal de pills de los clubes que oficiaron de local */}
            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
              {stadiumsData.topStadium.locales.map((loc) => (
                <div
                  key={loc.club}
                  className="flex items-center gap-2 px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono text-xs font-semibold text-slate-900 tabular-nums"
                >
                  <TeamBadge teamName={loc.club} size={22} />
                  <span className="font-sans font-bold">{loc.club}</span>
                  <span className="text-slate-600">({loc.count} PJ)</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* =====================================================================
          PANTALLA 4: NUBE DE PUNTOS DE ESTADIOS + DESGLOSE DE EQUIPOS (100vh)
         ===================================================================== */}
      <section className="min-h-[calc(100vh-41px)] w-full flex flex-col justify-between items-center snap-start px-4 sm:px-8 py-8 border-b border-slate-200">
        <div className="w-full max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <span className="font-mono text-[11px] font-bold tracking-widest uppercase text-slate-500">
            04 / 07 • DISTRIBUCIÓN DE PARTIDOS POR ESTADIO ({stadiumsData.list.length} CANCHAS)
          </span>
          <span className="font-mono text-[11px] text-slate-600 font-semibold">
            PASÁ EL CURSOR O TOCÁ UNA ESFERA PARA VER QUÉ EQUIPOS JUGARON AHÍ
          </span>
        </div>

        {/* Nube de Nodos con Nombre del Estadio y PJ adentro del círculo */}
        <div className="w-full max-w-6xl mx-auto my-auto py-2 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
          {stadiumsData.list.map((st, idx) => {
            const diameter = Math.round(
              Math.max(92, 68 + Math.sqrt(st.pj) * 16.5)
            );
            const isSelected = inspectedStadium?.estadio === st.estadio;
            const isTop = idx === 0;

            return (
              <motion.div
                key={st.estadio}
                whileHover={{ scale: 1.06 }}
                onMouseEnter={() => setActiveStadiumName(st.estadio)}
                onClick={() => setActiveStadiumName(st.estadio)}
                style={{ width: diameter, height: diameter }}
                className={`rounded-full flex flex-col items-center justify-center text-center p-2.5 transition-colors border-2 cursor-pointer select-none ${
                  isSelected
                    ? 'bg-sky-700 text-white border-slate-950 shadow-md'
                    : isTop
                    ? 'bg-sky-100 text-slate-950 border-sky-700 hover:bg-sky-200'
                    : 'bg-slate-100 text-slate-900 border-slate-400 hover:border-slate-800 hover:bg-slate-200/80'
                }`}
              >
                <span
                  className={`font-sans font-extrabold uppercase leading-tight px-1 ${
                    st.pj >= 40
                      ? 'text-xs sm:text-sm'
                      : st.pj >= 13
                      ? 'text-[10px] sm:text-xs'
                      : 'text-[9px] sm:text-[10px]'
                  }`}
                >
                  {st.estadio},
                </span>
                <span
                  className={`font-mono font-black tabular-nums leading-tight mt-0.5 ${
                    isSelected ? 'text-sky-100' : 'text-sky-900'
                  } ${
                    st.pj >= 40
                      ? 'text-xs sm:text-sm'
                      : 'text-[9px] sm:text-[10px]'
                  }`}
                >
                  {st.pj} PARTIDOS JUGADOS
                </span>
              </motion.div>
            );
          })}
        </div>

        {/* Desglose de clubes que jugaron en el estadio seleccionado / en hover (igual al de arriba) */}
        {inspectedStadium && (
          <div className="w-full max-w-6xl mx-auto p-4 bg-slate-50 border border-slate-300 rounded-xl space-y-3 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
              <div className="flex items-center gap-2.5">
                <span className="font-sans text-base sm:text-lg font-black uppercase text-slate-950">
                  {inspectedStadium.estadio}
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-sky-100 border border-sky-700 font-mono text-xs font-bold text-sky-900 tabular-nums">
                  {inspectedStadium.pj} partidos jugados
                </span>
              </div>
              <span className="font-mono text-[11px] font-semibold text-slate-600 tabular-nums">
                DESGLOSE DE PARTIDOS JUGADOS POR EQUIPO EN ESTA CANCHA
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              {inspectedStadium.equipos.map((eqItem) => (
                <div
                  key={eqItem.club}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-mono text-xs font-semibold tabular-nums border ${
                    eqItem.esLocalHabitual
                      ? 'bg-sky-50 border-sky-600 text-slate-950'
                      : 'bg-white border-slate-300 text-slate-900'
                  }`}
                >
                  <TeamBadge teamName={eqItem.club} size={20} />
                  <span className="font-sans font-bold">{eqItem.club}</span>
                  <span className="text-sky-800 font-bold">
                    ({eqItem.count} PJ)
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* =====================================================================
          PANTALLA 5: BLOQUE ÚNICO DE 7 COLUMNAS CON DOMINÓ GRIS/BLANCO POR MES
         ===================================================================== */}
      <section
        className="min-h-[calc(100vh-41px)] w-full flex flex-col justify-between items-center snap-start px-3 sm:px-8 py-6 border-b border-slate-200"
        onClick={() => setActiveDateKey(null)}
      >
        <div
          className="w-full max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="font-mono text-[11px] font-bold tracking-widest uppercase text-slate-500">
            05 / 07 • PARTIDOS POR DÍA DE LA SEMANA (MARZO – NOVIEMBRE 2026)
          </span>

          {/* Filtro rápido arriba del bloque de 7 columnas */}
          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 border border-slate-300 rounded-lg font-mono text-[11px]">
            <button
              type="button"
              onClick={() => setCalendarFilter('all')}
              className={`px-2.5 py-1 rounded font-bold cursor-pointer ${
                calendarFilter === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-700 hover:text-slate-950'
              }`}
            >
              [TODOS LOS DÍAS]
            </button>
            <button
              type="button"
              onClick={() => setCalendarFilter('midweek')}
              className={`px-2.5 py-1 rounded font-bold cursor-pointer ${
                calendarFilter === 'midweek'
                  ? 'bg-amber-700 text-white'
                  : 'text-slate-700 hover:text-slate-950'
              }`}
            >
              [ENTRE SEMANA (MAR-JUE)]
            </button>
            <button
              type="button"
              onClick={() => setCalendarFilter('morning')}
              className={`px-2.5 py-1 rounded font-bold cursor-pointer ${
                calendarFilter === 'morning'
                  ? 'bg-rose-700 text-white'
                  : 'text-slate-700 hover:text-slate-950'
              }`}
            >
              [HORARIOS MATUTINOS / MEDIODÍA (09:00 - 12:30)]
            </button>
          </div>
        </div>

        {/* Bloque único de 7 columnas sin cajas de mes, con dominó gris/blanco entre meses */}
        <div
          className="w-full max-w-4xl mx-auto my-auto py-2"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Cabecera de 7 columnas (Lunes a Domingo) */}
          <div className="grid grid-cols-7 gap-1 mb-1 text-center font-mono text-[10px] sm:text-xs font-black text-slate-900 uppercase tracking-wider">
            {DIAS_SEMANA_HEADER.map((diaFull, idx) => (
              <div key={diaFull} className="py-1">
                <span className="hidden sm:inline">{diaFull}</span>
                <span className="sm:hidden">{DIAS_SEMANA_CORTOS[idx]}</span>
              </div>
            ))}
          </div>

          {/* Grilla continua de 7 columnas */}
          <div className="grid grid-cols-7 gap-0.5">
            {continuousCalendarCells.map((cell, cellIdx) => {
              if (cell.type === 'empty') {
                return <div key={cell.key} className="h-3.5 sm:h-4" />;
              }

              const { dateKey, monthIdx, dayNum, colIdx } = cell;
              const dayEntry = calendarData.get(dateKey);
              const totalMatches = dayEntry?.matches.length || 0;
              const isEvenMonth = monthIdx % 2 === 0; // Dominó blanco (pares) vs gris (impares)

              const matchesFilter = !dayEntry
                ? false
                : calendarFilter === 'all'
                ? totalMatches > 0
                : calendarFilter === 'midweek'
                ? dayEntry.hasMidweek
                : dayEntry.hasMorning;

              const isAtypical =
                dayEntry && (dayEntry.hasMidweek || dayEntry.hasMorning);
              const isPopoverOpen = activeDateKey === dateKey;

              // Dominó gris/blanco para diferenciar meses cuando no hay partido
              let colorClasses = isEvenMonth
                ? 'bg-white text-slate-500 border border-slate-200/90'
                : 'bg-slate-200/90 text-slate-700 border border-slate-300';

              if (totalMatches > 0) {
                if (!matchesFilter) {
                  colorClasses = isEvenMonth
                    ? 'bg-white text-slate-400 border border-slate-200 opacity-40'
                    : 'bg-slate-200 text-slate-500 border border-slate-300 opacity-40';
                } else if (totalMatches === 1) {
                  colorClasses =
                    'bg-emerald-200 text-emerald-950 border border-emerald-500 font-bold';
                } else if (totalMatches === 2) {
                  colorClasses =
                    'bg-emerald-400 text-emerald-950 border border-emerald-700 font-bold';
                } else if (totalMatches === 3) {
                  colorClasses =
                    'bg-emerald-600 text-white border border-emerald-800 font-bold';
                } else {
                  colorClasses =
                    'bg-emerald-900 text-white border border-emerald-950 font-black';
                }
              }

              const rowIdx = Math.floor(cellIdx / 7);
              const openDownward = rowIdx < 6;
              const popoverAlignClass =
                colIdx <= 1
                  ? 'left-0'
                  : colIdx >= 5
                  ? 'right-0'
                  : 'left-1/2 -translate-x-1/2';

              return (
                <div key={dateKey} className="relative">
                  <button
                    type="button"
                    disabled={totalMatches === 0}
                    onMouseEnter={() => {
                      if (totalMatches > 0) setActiveDateKey(dateKey);
                    }}
                    onMouseLeave={() => {
                      setActiveDateKey((prev) =>
                        prev === dateKey ? null : prev
                      );
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (totalMatches > 0) {
                        setActiveDateKey((prev) =>
                          prev === dateKey ? null : dateKey
                        );
                      }
                    }}
                    className={`w-full relative h-3.5 sm:h-4 rounded-[2px] font-mono text-[9px] sm:text-[10px] leading-none tabular-nums flex items-center justify-between px-1 transition-transform ${colorClasses} ${
                      totalMatches > 0
                        ? 'cursor-pointer hover:scale-105 hover:z-10'
                        : 'cursor-default'
                    } ${
                      isPopoverOpen
                        ? 'ring-2 ring-sky-700 z-20'
                        : isAtypical && matchesFilter
                        ? 'ring-1 ring-rose-600'
                        : ''
                    }`}
                  >
                    <span
                      className={
                        dayNum === 1
                          ? 'font-black tracking-tighter underline decoration-current'
                          : ''
                      }
                    >
                      {dayNum === 1
                        ? `1 ${NOMBRES_MESES_CORTOS[monthIdx]}`
                        : dayNum}
                    </span>

                    {totalMatches > 0 && matchesFilter && (
                      <span className="font-black text-[8px] sm:text-[9px]">
                        {totalMatches}P
                      </span>
                    )}

                    {isAtypical && matchesFilter && (
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-600 absolute top-0.5 right-0.5" />
                    )}
                  </button>

                  {/* Hover / Click Floating Popover */}
                  {isPopoverOpen && dayEntry && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className={`absolute ${
                        openDownward ? 'top-full mt-1.5' : 'bottom-full mb-1.5'
                      } ${popoverAlignClass} w-64 sm:w-72 p-2.5 bg-white border-2 border-slate-900 rounded-lg shadow-xl z-50 font-mono text-[10px] text-slate-900 space-y-1.5 pointer-events-auto`}
                    >
                      <div className="flex items-center justify-between border-b border-slate-200 pb-1 font-bold text-slate-950">
                        <span>
                          {NOMBRES_DIAS_SEMANA[dayEntry.dayOfWeek]}{' '}
                          {dayEntry.day} DE {NOMBRES_MESES_CORTOS[dayEntry.month]}
                        </span>
                        <span className="text-emerald-800">
                          {dayEntry.matches.length} PJ
                        </span>
                      </div>
                      <div className="space-y-1 max-h-44 overflow-y-auto">
                        {dayEntry.matches.map((m, mIdx) => (
                          <div
                            key={mIdx}
                            className="p-1 rounded bg-slate-50 border border-slate-200 flex items-center justify-between gap-1 tabular-nums"
                          >
                            <span
                              className={`font-bold shrink-0 ${
                                isMorningOrNoonHour(m.hora)
                                  ? 'text-rose-700'
                                  : 'text-sky-800'
                              }`}
                            >
                              {m.hora}
                            </span>
                            <span className="font-sans font-bold truncate">
                              {m.local} {m.golesL ?? '-'}:{m.golesV ?? '-'}{' '}
                              {m.visitante}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4 font-mono text-[11px] text-slate-600 font-semibold">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-white border border-slate-300 inline-block" />
            <span>Meses pares (Blanco)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-slate-200 border border-slate-400 inline-block" />
            <span>Meses impares (Gris)</span>
          </span>
          <span>·</span>
          <span>PASÁ EL CURSOR O TOCÁ CUALQUIER DÍA CON PARTIDOS PARA VER EL DETALLE</span>
        </div>
      </section>

      {/* =====================================================================
          PANTALLA 6: SAD vs. ASOCIACIÓN CIVIL (SOLO ORDENADO POR TABLA, GRANDE)
         ===================================================================== */}
      <section className="min-h-[calc(100vh-41px)] w-full flex flex-col justify-between items-center snap-start px-4 sm:px-8 py-8 border-b border-slate-200">
        <div className="w-full max-w-6xl mx-auto text-center space-y-1">
          <span className="font-mono text-[11px] font-bold tracking-widest uppercase text-slate-500 block">
            06 / 07 • FORMA JURÍDICA POR POSICIÓN EN LA TABLA ANUAL
          </span>
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-slate-950">
            SAD ({sadVsAcData.sadCount}) vs. ASOCIACIÓN CIVIL (
            {sadVsAcData.acCount})
          </h2>
        </div>

        {/* Escalera Comparativa Grande (1° a 14° con SAD a la izquierda y AC a la derecha) */}
        <div className="w-full max-w-5xl mx-auto my-auto py-2 space-y-1.5">
          <div className="grid grid-cols-11 items-center font-mono text-xs sm:text-base font-black pb-2 border-b-2 border-slate-300">
            <div className="col-span-5 text-right pr-4 text-sky-900">
              ← SAD (PROM {sadVsAcData.promSad} PTS)
            </div>
            <div className="col-span-1 text-center text-slate-700">POS</div>
            <div className="col-span-5 text-left pl-4 text-amber-900">
              AC (PROM {sadVsAcData.promAc} PTS) →
            </div>
          </div>

          {sadVsAcData.allRanked.map((club) => {
            const isSad = club.tipo === 'SAD';
            return (
              <div
                key={club.id}
                className="grid grid-cols-11 items-center py-0.5"
              >
                {/* Lado Izquierdo (SAD) */}
                <div className="col-span-5 flex justify-end pr-3">
                  {isSad && (
                    <div className="inline-flex items-center gap-3 px-3.5 py-1.5 bg-sky-50 border-2 border-sky-400 rounded-xl shadow-2xs">
                      <span className="font-mono text-xs sm:text-base font-black text-sky-900 tabular-nums">
                        {club.pts} PTS
                      </span>
                      <span className="font-sans font-extrabold text-sm sm:text-xl text-slate-950">
                        {club.equipo}
                      </span>
                      <TeamBadge
                        teamName={club.equipo}
                        wikiLogoUrl={club.logoUrl}
                        size={34}
                      />
                    </div>
                  )}
                </div>

                {/* Columna Central (Puesto 1° a 14°) */}
                <div className="col-span-1 flex justify-center">
                  <span
                    className={`w-9 h-8 sm:w-11 sm:h-9 rounded-lg flex items-center justify-center font-mono text-sm sm:text-base font-black tabular-nums border-2 ${
                      club.pos <= 2
                        ? 'bg-emerald-100 text-emerald-950 border-emerald-500'
                        : club.pos <= 6
                        ? 'bg-sky-100 text-sky-950 border-sky-500'
                        : 'bg-slate-100 text-slate-900 border-slate-400'
                    }`}
                  >
                    {club.pos}°
                  </span>
                </div>

                {/* Lado Derecho (AC) */}
                <div className="col-span-5 flex justify-start pl-3">
                  {!isSad && (
                    <div className="inline-flex items-center gap-3 px-3.5 py-1.5 bg-amber-50 border-2 border-amber-400 rounded-xl shadow-2xs">
                      <TeamBadge
                        teamName={club.equipo}
                        wikiLogoUrl={club.logoUrl}
                        size={34}
                      />
                      <span className="font-sans font-extrabold text-sm sm:text-xl text-slate-950">
                        {club.equipo}
                      </span>
                      <span className="font-mono text-xs sm:text-base font-black text-amber-900 tabular-nums">
                        {club.pts} PTS
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="font-mono text-xs text-slate-600 font-bold tabular-nums">
          ASCENSO DIRECTO (1° Y 2°): PLAZA COLONIA (SAD) Y RENTISTAS (SAD)
        </div>
      </section>

      {/* =====================================================================
          PANTALLA 7: LLAVE DE PLAY-OFFS POR EL TERCER ASCENSO (100vh)
         ===================================================================== */}
      <section className="min-h-[calc(100vh-41px)] w-full flex flex-col justify-between items-center snap-start px-4 sm:px-8 py-12">
        <div className="w-full max-w-6xl mx-auto">
          <span className="font-mono text-[11px] font-bold tracking-widest uppercase text-slate-500 block">
            07 / 07 • DEFINICIÓN DEL TERCER ASCENSO (#Play-Offs)
          </span>
          <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-slate-950">
            LLAVE DE PLAY-OFFS 2026
          </h2>
        </div>

        {/* Diagrama de Llave (Bracket conectado con SVG) */}
        <div className="w-full max-w-6xl mx-auto my-auto grid grid-cols-1 lg:grid-cols-11 items-center gap-6 py-4">
          {/* Columna Semifinales */}
          <div className="lg:col-span-5 space-y-6">
            {[playoffsData.semi1, playoffsData.semi2].map((sf, idx) => (
              <div
                key={sf.id}
                className="p-4 bg-slate-50 border border-slate-300 rounded-xl space-y-3 shadow-xs"
              >
                <div className="flex items-center justify-between font-mono text-[11px] text-slate-600 border-b border-slate-300 pb-1.5">
                  <span className="font-bold text-slate-900">
                    SEMIFINAL {idx + 1}
                  </span>
                  <span>IDA: 15/11 • VUELTA: 18/11</span>
                </div>

                {/* Club A */}
                <div className="flex items-center justify-between p-2.5 bg-white border border-slate-300 rounded-lg">
                  <div className="flex items-center gap-2.5">
                    <span className="px-1.5 py-0.5 rounded bg-sky-100 border border-sky-300 font-mono text-xs font-black text-sky-950 tabular-nums">
                      #{sf.teamA.seed}
                    </span>
                    <TeamBadge
                      teamName={sf.teamA.nombre}
                      wikiLogoUrl={sf.teamA.logoUrl}
                      size={28}
                    />
                    <span className="font-sans font-bold text-sm text-slate-950">
                      {sf.teamA.nombre}
                    </span>
                  </div>
                  <span className="font-mono text-xs font-bold text-slate-700 tabular-nums">
                    {sf.teamA.pts} PTS ({sf.teamA.posAnual}° Anual)
                  </span>
                </div>

                {/* Club B */}
                <div className="flex items-center justify-between p-2.5 bg-white border border-slate-300 rounded-lg">
                  <div className="flex items-center gap-2.5">
                    <span className="px-1.5 py-0.5 rounded bg-sky-100 border border-sky-300 font-mono text-xs font-black text-sky-950 tabular-nums">
                      #{sf.teamB.seed}
                    </span>
                    <TeamBadge
                      teamName={sf.teamB.nombre}
                      wikiLogoUrl={sf.teamB.logoUrl}
                      size={28}
                    />
                    <div>
                      <span className="font-sans font-bold text-sm text-slate-950 block leading-tight">
                        {sf.teamB.nombre}
                      </span>
                      <span className="font-mono text-[10px] text-slate-600">
                        {sf.notaSeedB}
                      </span>
                    </div>
                  </div>
                  <span className="font-mono text-xs font-bold text-slate-700 tabular-nums">
                    {sf.teamB.pts} PTS ({sf.teamB.posAnual}° Anual)
                  </span>
                </div>

                {/* Detalle de Ida y Vuelta */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 font-mono text-[10px] text-slate-700 tabular-nums">
                  <div className="p-1.5 rounded bg-slate-100 border border-slate-300">
                    <div className="font-bold text-slate-900">
                      IDA • {sf.ida.dia} ({sf.ida.hora})
                    </div>
                    <div>
                      {sf.ida.local} {sf.ida.resultadoRaw} {sf.ida.visitante}
                    </div>
                    <div className="text-slate-600 truncate">
                      {sf.ida.estadio}
                    </div>
                  </div>
                  <div className="p-1.5 rounded bg-slate-100 border border-slate-300">
                    <div className="font-bold text-slate-900">
                      VUELTA • {sf.vuelta.dia} ({sf.vuelta.hora})
                    </div>
                    <div>
                      {sf.vuelta.local} {sf.vuelta.resultadoRaw}{' '}
                      {sf.vuelta.visitante}
                    </div>
                    <div className="text-slate-600 truncate">
                      {sf.vuelta.estadio}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Conectores SVG en Desktop */}
          <div className="hidden lg:flex lg:col-span-2 items-center justify-center h-full">
            <svg
              viewBox="0 0 120 320"
              className="w-full h-72 overflow-visible"
              aria-hidden="true"
            >
              <path
                d="M 0 65 L 60 65 L 60 160 L 120 160"
                fill="none"
                stroke="#64748B"
                strokeWidth="2.5"
              />
              <path
                d="M 0 255 L 60 255 L 60 160 L 120 160"
                fill="none"
                stroke="#64748B"
                strokeWidth="2.5"
              />
              <circle cx="60" cy="160" r="4.5" fill="#0369A1" />
            </svg>
          </div>

          {/* Cuadro de la Final por el 3° Ascenso */}
          <div className="lg:col-span-4">
            <div className="p-5 bg-slate-50 border-2 border-slate-900 rounded-xl space-y-4 shadow-sm">
              <div className="flex items-center justify-between font-mono text-xs border-b border-slate-300 pb-2">
                <span className="font-black text-slate-950">
                  FINAL • TERCER ASCENSO
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-100 border border-emerald-400 text-emerald-950 font-bold">
                  IDA Y VUELTA
                </span>
              </div>

              <div className="space-y-2.5">
                <div className="p-3 bg-white border border-slate-300 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TeamBadge teamName="Atenas" size={24} />
                    <TeamBadge teamName="Fénix" size={24} />
                    <span className="font-sans font-bold text-xs sm:text-sm text-slate-950">
                      Ganador Semifinal 1
                    </span>
                  </div>
                  <span className="font-mono text-xs font-bold text-slate-600">
                    #3 / #6
                  </span>
                </div>

                <div className="text-center font-mono text-xs font-black text-slate-500">
                  VS.
                </div>

                <div className="p-3 bg-white border border-slate-300 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TeamBadge teamName="Colón" size={24} />
                    <TeamBadge teamName="Oriental" size={24} />
                    <span className="font-sans font-bold text-xs sm:text-sm text-slate-950">
                      Ganador Semifinal 2
                    </span>
                  </div>
                  <span className="font-mono text-xs font-bold text-slate-600">
                    #4 / #5
                  </span>
                </div>
              </div>

              <div className="font-mono text-[11px] text-slate-700 bg-slate-100 border border-slate-300 rounded p-2 text-center tabular-nums">
                CLASIFICADOS: ATENAS (51 PTS) • COLÓN (51 PTS) • ORIENTAL (44
                PTS) • FÉNIX (42 PTS)
              </div>
            </div>
          </div>
        </div>

        <div className="font-mono text-[11px] text-slate-600 font-semibold tabular-nums">
          FUENTE: WIKIPEDIA API • REV_ID: {dataset?.revid ?? '—'}
        </div>
      </section>
    </div>
  );
};
