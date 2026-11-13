import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, RotateCcw, ChevronDown } from 'lucide-react';
import {
  sincronizarEquiposConWiki,
  calcularDatosCuriososEnJornada,
} from '../data/segunda2026Data';
import {
  WikiDataset,
  leerWikiCache,
  scrapeAndCacheWikipedia,
  AUTO_SYNC_TTL_MS,
} from './WikiSandbox';
import { ClubCrest, SvgClubCrest } from './ClubCrest';
import { DualRangeSlider } from './DualRangeSlider';

// Orden exacto de los 14 equipos según la tabla de cierre enviada
const ORDEN_CIERRE_IDS = [
  'plaza-colonia',
  'atenas',
  'colon',
  'oriental',
  'rentistas',
  'huracan',
  'fenix',
  'tacuarembo',
  'paysandu',
  'river-plate',
  'miramar-misiones',
  'la-luz',
  'cerrito',
  'uruguay-montevideo',
];

export const BumpChart: React.FC = () => {
  // Dataset sincronizado desde Wikipedia (localStorage o scraping diario automático)
  const [wikiDataset, setWikiDataset] = useState<WikiDataset | null>(() =>
    leerWikiCache()
  );

  useEffect(() => {
    const cached = leerWikiCache();
    if (cached && Date.now() - cached.timestamp <= AUTO_SYNC_TTL_MS) {
      setWikiDataset(cached);
      return;
    }
    scrapeAndCacheWikipedia()
      .then((fresh) => setWikiDataset(fresh))
      .catch(() => {
        // Si falla la red, mantiene el caché previo o el dataset base integrado
      });
  }, []);

  const equiposSincronizados = useMemo(
    () => sincronizarEquiposConWiki(wikiDataset),
    [wikiDataset]
  );

  const equiposOrdenadosCierre = useMemo(
    () =>
      ORDEN_CIERRE_IDS.map((id) =>
        equiposSincronizados.find((e) => e.id === id)!
      ).filter(Boolean),
    [equiposSincronizados]
  );

  // Modo de tabla: Clasificación Anual vs Descenso (Promedios)
  const [modo, setModo] = useState<'anual' | 'descenso'>('anual');

  // Tipo de trazo: Triángulo (recta) | Rectángulo (escalón) | Suave (curva)
  const [tipoTrazo, setTipoTrazo] = useState<'triangulo' | 'rectangulo' | 'suave'>('triangulo');

  // Equipos seleccionados:
  // [] => todos iluminados
  // [id1, ...] => solo esos iluminados, el resto oscurecido
  const [equiposSeleccionados, setEquiposSeleccionados] = useState<string[]>([]);

  // Sliders de dos puntas para resolución de Fechas (1 a 33) y Puestos (1° a 14°)
  const [minJornada, setMinJornada] = useState<number>(1);
  const [maxJornada, setMaxJornada] = useState<number>(33);
  const [minPuesto, setMinPuesto] = useState<number>(1);
  const [maxPuesto, setMaxPuesto] = useState<number>(14);

  // Controlador Play continuo (fluido a 60fps, avanzando 1 fecha por segundo)
  const [progresoContinuo, setProgresoContinuo] = useState<number>(33);
  const [reproduciendo, setReproduciendo] = useState<boolean>(false);
  const lastFrameRef = useRef<number | null>(null);
  const datosCuriososRef = useRef<HTMLElement | null>(null);

  // Estados de hover
  const [hoveredEquipoId, setHoveredEquipoId] = useState<string | null>(null);
  const [hoveredJornada, setHoveredJornada] = useState<number | null>(null);

  // Detección de viewport mobile para comprimir el gráfico sin scroll horizontal
  const [isMobile, setIsMobile] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < 640 : false
  );

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Mantener progresoContinuo dentro de [minJornada, maxJornada]
  useEffect(() => {
    setProgresoContinuo((prev) => Math.max(minJornada, Math.min(maxJornada, prev)));
  }, [minJornada, maxJornada]);

  // Bucle de animación fluida (requestAnimationFrame a 1.0 jornada/segundo)
  useEffect(() => {
    if (!reproduciendo) {
      lastFrameRef.current = null;
      return;
    }

    let rafId = 0;

    const tick = (now: number) => {
      if (lastFrameRef.current === null) {
        lastFrameRef.current = now;
      }
      const dtSeconds = (now - lastFrameRef.current) / 1000;
      lastFrameRef.current = now;

      let finished = false;
      setProgresoContinuo((prev) => {
        const next = prev + dtSeconds * 1.0; // 1 fecha por segundo
        if (next >= maxJornada) {
          finished = true;
          return maxJornada;
        }
        return next;
      });

      if (finished) {
        setReproduciendo(false);
        return;
      }
      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [reproduciendo, maxJornada]);

  const jornadaActual = Math.min(maxJornada, Math.max(minJornada, Math.floor(progresoContinuo)));

  const handleTogglePlay = () => {
    if (!reproduciendo && progresoContinuo >= maxJornada - 0.01) {
      setProgresoContinuo(minJornada);
    }
    setReproduciendo((prev) => !prev);
  };

  const toggleEquipo = (id: string) => {
    setEquiposSeleccionados((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const haySeleccionActiva = equiposSeleccionados.length > 0;

  const estaIluminado = (id: string) => {
    if (!haySeleccionActiva) return true;
    return equiposSeleccionados.includes(id);
  };

  // Geometría SVG adaptativa (Desktop vs Mobile comprimido sin scroll horizontal)
  const svgWidth = isMobile ? 415 : 1280;
  const svgHeight = isMobile ? 380 : 600;
  const padLeft = isMobile ? 26 : 50;
  const padRight = isMobile ? 98 : 258;
  const padTop = isMobile ? 16 : 34;
  const padBottom = isMobile ? 26 : 40;

  const plotWidth = svgWidth - padLeft - padRight;
  const plotHeight = svgHeight - padTop - padBottom;

  const spanJornadas = Math.max(1, maxJornada - minJornada);
  const spanPuestos = Math.max(1, maxPuesto - minPuesto);

  const getX = (jornadaValue: number) =>
    padLeft + ((jornadaValue - minJornada) / spanJornadas) * plotWidth;

  const getY = (posicion: number) =>
    padTop + ((posicion - minPuesto) / spanPuestos) * plotHeight;

  // Construye los segmentos completos dentro de [minJornada .. maxJornada]
  const buildSegments = (serie: (number | null)[]) => {
    const segments: string[] = [];
    let currentPoints: { x: number; y: number }[] = [];

    const flushSegment = () => {
      if (currentPoints.length === 0) return;

      if (tipoTrazo === 'rectangulo') {
        const parts: string[] = [];
        currentPoints.forEach((p, idx) => {
          if (idx === 0) {
            parts.push(`M ${p.x.toFixed(1)} ${p.y.toFixed(1)}`);
          } else {
            const prev = currentPoints[idx - 1];
            const midX = ((prev.x + p.x) / 2).toFixed(1);
            parts.push(`L ${midX} ${prev.y.toFixed(1)}`);
            parts.push(`L ${midX} ${p.y.toFixed(1)}`);
            parts.push(`L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`);
          }
        });
        segments.push(parts.join(' '));
      } else if (tipoTrazo === 'suave') {
        const parts: string[] = [];
        currentPoints.forEach((p, idx) => {
          if (idx === 0) {
            parts.push(`M ${p.x.toFixed(1)} ${p.y.toFixed(1)}`);
          } else {
            const prev = currentPoints[idx - 1];
            const midX = ((prev.x + p.x) / 2).toFixed(1);
            parts.push(
              `C ${midX} ${prev.y.toFixed(1)}, ${midX} ${p.y.toFixed(1)}, ${p.x.toFixed(1)} ${p.y.toFixed(1)}`
            );
          }
        });
        segments.push(parts.join(' '));
      } else {
        const linePath = currentPoints
          .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
          .join(' ');
        segments.push(linePath);
      }

      currentPoints = [];
    };

    for (let j = minJornada; j <= maxJornada; j++) {
      const pos = serie[j - 1];
      if (pos === null || pos === undefined) {
        flushSegment();
      } else {
        currentPoints.push({ x: getX(j), y: getY(pos) });
      }
    }
    flushSegment();

    return segments;
  };

  // Posición de cada equipo en la jornada entera actual
  const obtenerPosEnJornadaActiva = (
    serie: (number | null)[],
    jActiva: number
  ): { pos: number; jornadaReal: number } => {
    const val = serie[jActiva - 1];
    if (val !== null && val !== undefined) {
      return { pos: val, jornadaReal: jActiva };
    }
    for (let k = jActiva - 1; k >= 1; k--) {
      const prev = serie[k - 1];
      if (prev !== null && prev !== undefined) {
        return { pos: prev, jornadaReal: k };
      }
    }
    return { pos: 14, jornadaReal: jActiva };
  };

  const puestosVisibles = Array.from(
    { length: maxPuesto - minPuesto + 1 },
    (_, i) => minPuesto + i
  );
  const jornadasVisibles = Array.from(
    { length: maxJornada - minJornada + 1 },
    (_, i) => minJornada + i
  );

  // Etiquetas derechas ordenadas sin superposiciones
  const datosDerecha = equiposOrdenadosCierre
    .map((eq) => {
      const serie = modo === 'anual' ? eq.evolucionAnual : eq.evolucionDescenso;
      const { pos, jornadaReal } = obtenerPosEnJornadaActiva(serie, jornadaActual);
      return {
        equipo: eq,
        posActual: pos,
        jornadaReal,
        scoreOrden: pos + (jornadaReal < jornadaActual ? -0.05 : 0.05),
      };
    })
    .sort((a, b) => a.scoreOrden - b.scoreOrden);

  const mapaYEtiquetaDerecha = new Map<string, number>();
  datosDerecha.forEach((d, idx) => {
    if (minPuesto === 1 && maxPuesto === 14) {
      mapaYEtiquetaDerecha.set(d.equipo.id, getY(idx + 1));
    } else {
      mapaYEtiquetaDerecha.set(d.equipo.id, getY(d.posActual));
    }
  });

  // Ordenar equipos para que los iluminados y el hover queden arriba
  const equiposOrdenadosRender = [...equiposOrdenadosCierre].sort((a, b) => {
    const aLit = estaIluminado(a.id) ? 1 : 0;
    const bLit = estaIluminado(b.id) ? 1 : 0;
    if (hoveredEquipoId === a.id) return 1;
    if (hoveredEquipoId === b.id) return -1;
    return aLit - bLit;
  });

  // Datos curiosos reactivos según la fecha en la que está el slider y los datos de Wikipedia
  const datosCuriosos = useMemo(
    () =>
      calcularDatosCuriososEnJornada(
        jornadaActual,
        modo,
        equiposSincronizados,
        wikiDataset
      ),
    [jornadaActual, modo, equiposSincronizados, wikiDataset]
  );

  const shouldShowXAxisLabel = (j: number) => {
    if (!isMobile) return true;
    if (j === minJornada || j === maxJornada) return true;
    if (spanJornadas <= 10) return true;
    if (spanJornadas <= 20) return j % 2 === 0;
    return j % 5 === 0;
  };

  const playClipWidth = Math.max(0, getX(progresoContinuo) - padLeft + 2);

  return (
    <div className="px-2 py-3 sm:p-6 bg-white text-slate-900 sm:border sm:border-slate-300 sm:rounded-xl sm:shadow-xs space-y-4 sm:space-y-5">
      {/* 1. CABECERA Y SELECTORES (TABLA + ESTILO DE LÍNEA) */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-600 mb-0.5">
            <span>Segunda División Uruguay 2026</span>
            <span aria-hidden="true">·</span>
            <span>J{minJornada}–J{maxJornada}</span>
            <span aria-hidden="true">·</span>
            <span>{minPuesto}°–{maxPuesto}°</span>
          </div>
          <h1 className="text-xl sm:text-3xl font-bold tracking-tight text-slate-950">
            {modo === 'anual'
              ? 'Trayectoria Fecha a Fecha — Tabla Anual'
              : 'Trayectoria Fecha a Fecha — Tabla del Descenso'}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Selector Anual / Descenso */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 border border-slate-300 rounded-lg">
            <button
              type="button"
              onClick={() => setModo('anual')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                modo === 'anual'
                  ? 'bg-sky-700 text-white shadow-xs'
                  : 'text-slate-700 hover:text-slate-950'
              }`}
            >
              Tabla Anual
            </button>
            <button
              type="button"
              onClick={() => setModo('descenso')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                modo === 'descenso'
                  ? 'bg-rose-700 text-white shadow-xs'
                  : 'text-slate-700 hover:text-slate-950'
              }`}
            >
              Tabla Descenso
            </button>
          </div>

          {/* Selector Triángulo / Rectángulo / Suave */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 border border-slate-300 rounded-lg">
            <button
              type="button"
              onClick={() => setTipoTrazo('triangulo')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                tipoTrazo === 'triangulo'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-700 hover:text-slate-950'
              }`}
            >
              Triángulo
            </button>
            <button
              type="button"
              onClick={() => setTipoTrazo('rectangulo')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                tipoTrazo === 'rectangulo'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-700 hover:text-slate-950'
              }`}
            >
              Rectángulo
            </button>
            <button
              type="button"
              onClick={() => setTipoTrazo('suave')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                tipoTrazo === 'suave'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-700 hover:text-slate-950'
              }`}
            >
              Suave
            </button>
          </div>
        </div>
      </div>

      {/* 2. CONTROLES: REPRODUCTOR PLAY FLUIDO + SLIDERS DE DOS PUNTAS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 py-2 sm:p-4 sm:bg-slate-50 sm:border sm:border-slate-300 sm:rounded-xl items-center">
        {/* Reproductor Play Fluido */}
        <div className="lg:col-span-5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleTogglePlay}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-sky-700 hover:bg-sky-800 text-white rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-xs"
          >
            {reproduciendo ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span>Pausar (J{jornadaActual})</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Play</span>
              </>
            )}
          </button>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setReproduciendo(false);
                setProgresoContinuo((prev) => Math.max(minJornada, Math.floor(prev) - 1));
              }}
              disabled={jornadaActual <= minJornada}
              className="p-2 bg-white hover:bg-slate-100 disabled:opacity-40 text-slate-800 border border-slate-300 rounded-lg transition-colors cursor-pointer"
              title="Fecha anterior"
            >
              <SkipBack className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setReproduciendo(false);
                setProgresoContinuo((prev) => Math.min(maxJornada, Math.floor(prev) + 1));
              }}
              disabled={jornadaActual >= maxJornada}
              className="p-2 bg-white hover:bg-slate-100 disabled:opacity-40 text-slate-800 border border-slate-300 rounded-lg transition-colors cursor-pointer"
              title="Fecha siguiente"
            >
              <SkipForward className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setReproduciendo(false);
                setProgresoContinuo(minJornada);
              }}
              className="p-2 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-lg transition-colors cursor-pointer"
              title="Reiniciar al inicio del rango"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-2.5 flex-1 min-w-[130px]">
            <input
              type="range"
              min={minJornada}
              max={maxJornada}
              step={0.05}
              value={progresoContinuo}
              onChange={(e) => {
                setReproduciendo(false);
                setProgresoContinuo(Number(e.target.value));
              }}
              className="w-full time-slider bg-slate-200 rounded-lg"
              aria-label="Fecha actual de visualización"
            />
            <span className="font-mono text-xs font-bold text-sky-800 whitespace-nowrap tabular-nums">
              J{jornadaActual}
            </span>
          </div>
        </div>

        {/* Sliders de dos puntas (Fechas y Puestos) */}
        <div className="lg:col-span-7 flex flex-col sm:flex-row items-stretch sm:items-center gap-4 sm:gap-6 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-200">
          <DualRangeSlider
            label="Resolución de Fechas"
            min={1}
            max={33}
            valueMin={minJornada}
            valueMax={maxJornada}
            formatValue={(v) => `J${v}`}
            onChange={(newMin, newMax) => {
              setReproduciendo(false);
              setMinJornada(newMin);
              setMaxJornada(newMax);
            }}
          />

          <DualRangeSlider
            label="Resolución de Puestos"
            min={1}
            max={14}
            valueMin={minPuesto}
            valueMax={maxPuesto}
            formatValue={(v) => `${v}°`}
            onChange={(newMin, newMax) => {
              setMinPuesto(newMin);
              setMaxPuesto(newMax);
            }}
          />
        </div>
      </div>

      {/* 3. LIENZO SVG SOBRE FONDO BLANCO CON TRAZOS GRUESOS DE ALTO CONTRASTE */}
      <div className="w-full bg-white rounded-lg">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto select-none block bg-white"
          role="img"
          aria-label="Gráfico de trayectoria fecha a fecha"
        >
          <defs>
            <clipPath id="plot-area-clip">
              <rect
                x={padLeft - 3}
                y={padTop - 10}
                width={plotWidth + 6}
                height={plotHeight + 20}
              />
            </clipPath>
            <clipPath id="play-reveal-clip">
              <rect
                x={padLeft - 3}
                y={0}
                width={playClipWidth + 3}
                height={svgHeight}
              />
            </clipPath>
          </defs>

          {/* Zonas de corte y divisor J7/J8 */}
          <g clipPath="url(#plot-area-clip)">
            {modo === 'anual' ? (
              <>
                <line
                  x1={padLeft}
                  y1={getY(2.5)}
                  x2={padLeft + plotWidth}
                  y2={getY(2.5)}
                  stroke="#15803D"
                  strokeOpacity="0.65"
                  strokeDasharray="4 4"
                  strokeWidth="1.3"
                />
                <line
                  x1={padLeft}
                  y1={getY(6.5)}
                  x2={padLeft + plotWidth}
                  y2={getY(6.5)}
                  stroke="#0369A1"
                  strokeOpacity="0.6"
                  strokeDasharray="4 4"
                  strokeWidth="1.3"
                />
              </>
            ) : (
              <line
                x1={padLeft}
                y1={getY(12.5)}
                x2={padLeft + plotWidth}
                y2={getY(12.5)}
                stroke="#B91C1C"
                strokeOpacity="0.75"
                strokeDasharray="6 4"
                strokeWidth="1.5"
              />
            )}

            {minJornada <= 7 && maxJornada >= 8 && (
              <line
                x1={(getX(7) + getX(8)) / 2}
                y1={padTop - 8}
                x2={(getX(7) + getX(8)) / 2}
                y2={padTop + plotHeight}
                stroke="#64748B"
                strokeOpacity="0.55"
                strokeDasharray="3 3"
                strokeWidth="1.2"
              />
            )}
          </g>

          {/* Filas Horizontales de Puestos */}
          {puestosVisibles.map((puesto) => {
            const y = getY(puesto);
            return (
              <g key={`row-${puesto}`}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={padLeft + plotWidth}
                  y2={y}
                  stroke="#CBD5E1"
                  strokeWidth="1"
                />
                <text
                  x={padLeft - (isMobile ? 6 : 12)}
                  y={y + 3.5}
                  textAnchor="end"
                  fill={
                    modo === 'anual'
                      ? puesto <= 2
                        ? '#15803D'
                        : puesto <= 6
                        ? '#0369A1'
                        : '#334155'
                      : puesto >= 13
                      ? '#B91C1C'
                      : '#334155'
                  }
                  fontSize={isMobile ? '9.5' : '12'}
                  fontFamily="var(--font-mono)"
                  fontWeight="700"
                >
                  {puesto}°
                </text>
              </g>
            );
          })}

          {/* Línea vertical fluida del Playhead */}
          {progresoContinuo < maxJornada && (
            <line
              x1={getX(progresoContinuo)}
              y1={padTop - 8}
              x2={getX(progresoContinuo)}
              y2={padTop + plotHeight + 6}
              stroke="#0284C7"
              strokeOpacity="0.7"
              strokeWidth="1.8"
            />
          )}

          {/* Trazos de equipos más gruesos y de alto contraste sobre blanco */}
          <g clipPath="url(#plot-area-clip)">
            <g clipPath="url(#play-reveal-clip)">
              {equiposOrdenadosRender.map((equipo) => {
                const iluminado = estaIluminado(equipo.id);
                const isHovered = hoveredEquipoId === equipo.id;
                const serie = modo === 'anual' ? equipo.evolucionAnual : equipo.evolucionDescenso;
                const segments = buildSegments(serie);

                const lineOpacity = isHovered ? 1 : iluminado ? 0.96 : 0.14;

                return (
                  <g
                    key={equipo.id}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredEquipoId(equipo.id)}
                    onMouseLeave={() => setHoveredEquipoId(null)}
                    onClick={() => toggleEquipo(equipo.id)}
                  >
                    {segments.map((d, segIdx) => (
                      <path
                        key={`${equipo.id}-seg-${segIdx}`}
                        d={d}
                        fill="none"
                        stroke={equipo.colorPrimario}
                        strokeOpacity={lineOpacity}
                        strokeWidth={
                          isMobile
                            ? isHovered
                              ? 3.2
                              : iluminado
                              ? 2.2
                              : 1.1
                            : isHovered
                            ? 4.2
                            : iluminado
                            ? 2.8
                            : 1.35
                        }
                        strokeLinecap={tipoTrazo === 'rectangulo' ? 'square' : 'round'}
                        strokeLinejoin={tipoTrazo === 'rectangulo' ? 'miter' : 'round'}
                      />
                    ))}
                  </g>
                );
              })}
            </g>
          </g>

          {/* Eje X de Jornadas */}
          {jornadasVisibles.map((jornada) => {
            const x = getX(jornada);
            const isCurrent = jornada === jornadaActual;
            const isHoveredCol = jornada === hoveredJornada;
            const showLabel = shouldShowXAxisLabel(jornada);

            return (
              <g
                key={`col-${jornada}`}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredJornada(jornada)}
                onMouseLeave={() => setHoveredJornada(null)}
                onClick={() => {
                  setReproduciendo(false);
                  setProgresoContinuo(jornada);
                }}
              >
                <rect
                  x={x - plotWidth / (jornadasVisibles.length * 2)}
                  y={padTop - 8}
                  width={plotWidth / jornadasVisibles.length}
                  height={plotHeight + 28}
                  fill="transparent"
                />
                {showLabel && (
                  <text
                    x={x}
                    y={svgHeight - (isMobile ? 8 : 12)}
                    textAnchor="middle"
                    fill={isCurrent ? '#0369A1' : isHoveredCol ? '#0F172A' : '#334155'}
                    fontSize={isMobile ? '9' : isCurrent ? '12' : '10.5'}
                    fontFamily="var(--font-mono)"
                    fontWeight={isCurrent || isHoveredCol ? '700' : '600'}
                  >
                    {jornada}
                  </text>
                )}
              </g>
            );
          })}

          {/* Columna Derecha: Escudo + Nombre + Puntos acumulados en la jornada activa */}
          {equiposOrdenadosRender.map((equipo) => {
            const iluminado = estaIluminado(equipo.id);
            const isHovered = hoveredEquipoId === equipo.id;
            const serie = modo === 'anual' ? equipo.evolucionAnual : equipo.evolucionDescenso;
            const { pos } = obtenerPosEnJornadaActiva(serie, jornadaActual);

            if (pos < minPuesto || pos > maxPuesto) return null;

            const yLabel = mapaYEtiquetaDerecha.get(equipo.id) ?? getY(pos);
            const crestSize = isMobile ? 14 : 20;
            const ptsEnJornada =
              equipo.puntosPorJornada?.[Math.max(0, Math.min(32, jornadaActual - 1))] ?? 0;

            return (
              <g
                key={`label-${equipo.id}`}
                transform={`translate(${padLeft + plotWidth + (isMobile ? 6 : 12)}, ${yLabel})`}
                className="cursor-pointer transition-opacity duration-150"
                style={{ opacity: isHovered ? 1 : iluminado ? 1 : 0.22 }}
                onMouseEnter={() => setHoveredEquipoId(equipo.id)}
                onMouseLeave={() => setHoveredEquipoId(null)}
                onClick={() => toggleEquipo(equipo.id)}
              >
                <SvgClubCrest
                  equipo={equipo}
                  x={0}
                  y={-crestSize / 2}
                  size={crestSize}
                />
                <text
                  x={crestSize + (isMobile ? 4 : 7)}
                  y={isMobile ? 3.5 : 4}
                  fill={iluminado ? '#0F172A' : '#64748B'}
                  fontSize={isMobile ? '9' : '12'}
                  fontFamily={isMobile ? 'var(--font-mono)' : 'var(--font-sans)'}
                  fontWeight={isHovered || (iluminado && haySeleccionActiva) ? '700' : '600'}
                >
                  <tspan>
                    {isMobile ? `${pos}° ${equipo.abreviatura}` : equipo.nombre}
                  </tspan>
                  <tspan
                    dx={isMobile ? '4' : '7'}
                    fill={iluminado ? '#0369A1' : '#94A3B8'}
                    fontSize={isMobile ? '8.5' : '11'}
                    fontFamily="var(--font-mono)"
                    fontWeight="700"
                  >
                    {ptsEnJornada} PTS
                  </tspan>
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* 4. BOTONERA DE EQUIPOS ORDENADA POR CIERRE (SIN TEXTO DESCRIPTIVO) */}
      <div className="pt-3 border-t border-slate-200 space-y-2.5">
        {haySeleccionActiva && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setEquiposSeleccionados([])}
              className="text-sky-800 hover:text-sky-950 font-mono text-xs font-bold cursor-pointer"
            >
              Restablecer todos ({equiposSeleccionados.length})
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1.5 sm:gap-2">
          {equiposOrdenadosCierre.map((eq) => {
            const iluminado = estaIluminado(eq.id);
            const estaSeleccionadoExplicito = equiposSeleccionados.includes(eq.id);
            return (
              <button
                key={eq.id}
                type="button"
                onClick={() => toggleEquipo(eq.id)}
                onMouseEnter={() => setHoveredEquipoId(eq.id)}
                onMouseLeave={() => setHoveredEquipoId(null)}
                className={`flex items-center gap-2 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-lg text-xs font-medium transition-all border text-left cursor-pointer ${
                  estaSeleccionadoExplicito
                    ? 'bg-sky-50 text-slate-950 border-2 border-sky-700 shadow-xs'
                    : iluminado
                    ? 'bg-white text-slate-900 border-slate-300 hover:border-slate-400 hover:bg-slate-50'
                    : 'bg-slate-50 text-slate-500 border-slate-200 opacity-45 hover:opacity-85'
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: eq.colorPrimario }}
                />
                <ClubCrest equipo={eq} size={20} />
                <span className="truncate font-semibold">{eq.nombre}</span>
              </button>
            );
          })}
        </div>
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={() =>
              datosCuriososRef.current?.scrollIntoView({ behavior: 'smooth' })
            }
            className="group flex flex-col items-center gap-0.5 text-slate-700 hover:text-slate-950 cursor-pointer transition-colors"
          >
            <span className="font-mono text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-slate-100 group-hover:bg-slate-200 border border-slate-300">
              Bajá para ver más datos
            </span>
            <ChevronDown className="w-4 h-4 text-sky-700 animate-bounce" />
          </button>
        </div>
      </div>

      {/* 5. SECCIÓN: DATOS CURIOSOS SEGÚN LA FECHA DEL SLIDER */}
      <section
        ref={datosCuriososRef}
        className="pt-4 border-t border-slate-200 space-y-3"
        aria-label="Datos curiosos de la jornada"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-950">
            Datos Curiosos hasta la Jornada {jornadaActual}
          </h2>
          <span className="text-xs font-mono font-semibold text-slate-600 tabular-nums">
            Actualizado a J{jornadaActual}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {datosCuriosos.map((dato) => (
            <div
              key={dato.id}
              onClick={() => toggleEquipo(dato.equipo.id)}
              className="flex items-center justify-between gap-3 p-3.5 bg-slate-50 border border-slate-300 rounded-lg cursor-pointer hover:border-slate-400 hover:bg-slate-100/70 transition-colors"
            >
              <div className="min-w-0 space-y-0.5">
                <div className="text-xs font-semibold text-slate-600">{dato.titulo}</div>
                <div className="text-base sm:text-lg font-bold font-mono text-slate-950 tabular-nums">
                  {dato.valorPrincipal}
                </div>
                <div className="text-xs font-medium text-slate-700 truncate">{dato.detalle}</div>
              </div>
              <ClubCrest equipo={dato.equipo} size={30} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
