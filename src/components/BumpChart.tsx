import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, RotateCcw } from 'lucide-react';
import {
  EQUIPOS_2026,
  calcularDatosCuriososEnJornada,
} from '../data/segunda2026Data';
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

const EQUIPOS_ORDENADOS_CIERRE = ORDEN_CIERRE_IDS.map(
  (id) => EQUIPOS_2026.find((e) => e.id === id)!
).filter(Boolean);

export const BumpChart: React.FC = () => {
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
  const svgWidth = isMobile ? 410 : 1260;
  const svgHeight = isMobile ? 380 : 600;
  const padLeft = isMobile ? 26 : 50;
  const padRight = isMobile ? 76 : 225;
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
  // (El recorte fluido del Play se hace mediante clipPath a getX(progresoContinuo))
  const buildSegments = (serie: (number | null)[]) => {
    const segments: string[] = [];
    let currentPoints: { x: number; y: number }[] = [];

    const flushSegment = () => {
      if (currentPoints.length === 0) return;

      if (tipoTrazo === 'rectangulo') {
        // Onda cuadrada (Step-Mid): meseta horizontal en cada fecha + escalón vertical de 90° entre fechas
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
        // Curva suave (Bezier cúbica horizontal)
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
        // Triángulo (línea recta punto a punto)
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
  const datosDerecha = EQUIPOS_ORDENADOS_CIERRE.map((eq) => {
    const serie = modo === 'anual' ? eq.evolucionAnual : eq.evolucionDescenso;
    const { pos, jornadaReal } = obtenerPosEnJornadaActiva(serie, jornadaActual);
    return {
      equipo: eq,
      posActual: pos,
      jornadaReal,
      scoreOrden: pos + (jornadaReal < jornadaActual ? -0.05 : 0.05),
    };
  }).sort((a, b) => a.scoreOrden - b.scoreOrden);

  const mapaYEtiquetaDerecha = new Map<string, number>();
  datosDerecha.forEach((d, idx) => {
    if (minPuesto === 1 && maxPuesto === 14) {
      mapaYEtiquetaDerecha.set(d.equipo.id, getY(idx + 1));
    } else {
      mapaYEtiquetaDerecha.set(d.equipo.id, getY(d.posActual));
    }
  });

  // Ordenar equipos para que los iluminados y el hover queden arriba
  const equiposOrdenadosRender = [...EQUIPOS_ORDENADOS_CIERRE].sort((a, b) => {
    const aLit = estaIluminado(a.id) ? 1 : 0;
    const bLit = estaIluminado(b.id) ? 1 : 0;
    if (hoveredEquipoId === a.id) return 1;
    if (hoveredEquipoId === b.id) return -1;
    return aLit - bLit;
  });

  // Datos curiosos reactivos según la fecha en la que está el slider
  const datosCuriosos = useMemo(
    () => calcularDatosCuriososEnJornada(jornadaActual, modo),
    [jornadaActual, modo]
  );

  // Determinar qué ticks mostrar en el eje X para evitar solapamientos en mobile
  const shouldShowXAxisLabel = (j: number) => {
    if (!isMobile) return true;
    if (j === minJornada || j === maxJornada) return true;
    if (spanJornadas <= 10) return true;
    if (spanJornadas <= 20) return j % 2 === 0;
    return j % 5 === 0;
  };

  const playClipWidth = Math.max(0, getX(progresoContinuo) - padLeft + 2);

  return (
    <div className="px-2 py-3 sm:p-6 sm:border sm:border-slate-800 sm:bg-slate-900/85 sm:rounded-xl space-y-4 sm:space-y-5">
      {/* 1. CABECERA Y SELECTORES (TABLA + ESTILO DE LÍNEA) */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-0.5">
            <span>Segunda División Uruguay 2026</span>
            <span aria-hidden="true">·</span>
            <span>J{minJornada}–J{maxJornada}</span>
            <span aria-hidden="true">·</span>
            <span>{minPuesto}°–{maxPuesto}°</span>
          </div>
          <h1 className="text-xl sm:text-3xl font-bold tracking-tight text-slate-100">
            {modo === 'anual'
              ? 'Trayectoria Fecha a Fecha — Tabla Anual'
              : 'Trayectoria Fecha a Fecha — Tabla del Descenso'}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Selector Anual / Descenso */}
          <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg">
            <button
              type="button"
              onClick={() => setModo('anual')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                modo === 'anual'
                  ? 'bg-sky-500 text-slate-950 font-semibold'
                  : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              Tabla Anual
            </button>
            <button
              type="button"
              onClick={() => setModo('descenso')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                modo === 'descenso'
                  ? 'bg-rose-500 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              Tabla Descenso
            </button>
          </div>

          {/* Selector Triángulo / Rectángulo / Suave */}
          <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg">
            <button
              type="button"
              onClick={() => setTipoTrazo('triangulo')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                tipoTrazo === 'triangulo'
                  ? 'bg-slate-800 text-sky-300 font-semibold'
                  : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              Triángulo
            </button>
            <button
              type="button"
              onClick={() => setTipoTrazo('rectangulo')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                tipoTrazo === 'rectangulo'
                  ? 'bg-slate-800 text-sky-300 font-semibold'
                  : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              Rectángulo
            </button>
            <button
              type="button"
              onClick={() => setTipoTrazo('suave')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                tipoTrazo === 'suave'
                  ? 'bg-slate-800 text-sky-300 font-semibold'
                  : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              Suave
            </button>
          </div>
        </div>
      </div>

      {/* 2. CONTROLES: REPRODUCTOR PLAY FLUIDO + SLIDERS DE DOS PUNTAS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 py-2 sm:p-4 sm:bg-slate-950/90 sm:border sm:border-slate-800 sm:rounded-xl items-center">
        {/* Reproductor Play Fluido */}
        <div className="lg:col-span-5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleTogglePlay}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-sky-500 hover:bg-sky-400 text-slate-950 rounded-lg transition-colors whitespace-nowrap shrink-0"
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
              className="p-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-200 border border-slate-800 rounded-lg transition-colors"
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
              className="p-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-200 border border-slate-800 rounded-lg transition-colors"
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
              className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-lg transition-colors"
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
              className="w-full time-slider bg-slate-800 rounded-lg"
              aria-label="Fecha actual de visualización"
            />
            <span className="font-mono text-xs font-bold text-sky-400 whitespace-nowrap tabular-nums">
              J{jornadaActual}
            </span>
          </div>
        </div>

        {/* Sliders de dos puntas (Fechas y Puestos) */}
        <div className="lg:col-span-7 flex flex-col sm:flex-row items-stretch sm:items-center gap-4 sm:gap-6 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-800/70">
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

      {/* 3. LIENZO SVG COMPRIMIDO (SIN SCROLL HORIZONTAL EN MOBILE, SIN PUNTOS, SIN ÁREA TRANSPARENTE) */}
      <div className="w-full">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto select-none block"
          role="img"
          aria-label="Gráfico de trayectoria fecha a fecha"
        >
          <defs>
            <clipPath id="plot-area-clip">
              <rect
                x={padLeft - 2}
                y={padTop - 10}
                width={plotWidth + 4}
                height={plotHeight + 20}
              />
            </clipPath>
            <clipPath id="play-reveal-clip">
              <rect
                x={padLeft - 2}
                y={0}
                width={playClipWidth + 2}
                height={svgHeight}
              />
            </clipPath>
          </defs>

          {/* Zonas de corte y divisor J6/J7 */}
          <g clipPath="url(#plot-area-clip)">
            {modo === 'anual' ? (
              <>
                <line
                  x1={padLeft}
                  y1={getY(2.5)}
                  x2={padLeft + plotWidth}
                  y2={getY(2.5)}
                  stroke="#16A34A"
                  strokeOpacity="0.4"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
                <line
                  x1={padLeft}
                  y1={getY(6.5)}
                  x2={padLeft + plotWidth}
                  y2={getY(6.5)}
                  stroke="#0EA5E9"
                  strokeOpacity="0.35"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
              </>
            ) : (
              <line
                x1={padLeft}
                y1={getY(12.5)}
                x2={padLeft + plotWidth}
                y2={getY(12.5)}
                stroke="#EF4444"
                strokeOpacity="0.7"
                strokeDasharray="6 4"
                strokeWidth="1.2"
              />
            )}

            {minJornada <= 6 && maxJornada >= 7 && (
              <line
                x1={(getX(6) + getX(7)) / 2}
                y1={padTop - 8}
                x2={(getX(6) + getX(7)) / 2}
                y2={padTop + plotHeight}
                stroke="#64748B"
                strokeOpacity="0.35"
                strokeDasharray="3 3"
                strokeWidth="1"
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
                  stroke="#1E293B"
                  strokeWidth="1"
                />
                <text
                  x={padLeft - (isMobile ? 6 : 12)}
                  y={y + 3.5}
                  textAnchor="end"
                  fill={
                    modo === 'anual'
                      ? puesto <= 2
                        ? '#4ADE80'
                        : puesto <= 6
                        ? '#38BDF8'
                        : '#64748B'
                      : puesto >= 13
                      ? '#F87171'
                      : '#64748B'
                  }
                  fontSize={isMobile ? '9.5' : '12'}
                  fontFamily="var(--font-mono)"
                  fontWeight="600"
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
              stroke="#38BDF8"
              strokeOpacity="0.5"
              strokeWidth="1.5"
            />
          )}

          {/* Trazos Finos (Escalón o Recta), SIN PUNTOS y SIN ÁREA TRANSPARENTE, con recorte fluido */}
          <g clipPath="url(#plot-area-clip)">
            <g clipPath="url(#play-reveal-clip)">
              {equiposOrdenadosRender.map((equipo) => {
                const iluminado = estaIluminado(equipo.id);
                const isHovered = hoveredEquipoId === equipo.id;
                const serie = modo === 'anual' ? equipo.evolucionAnual : equipo.evolucionDescenso;
                const segments = buildSegments(serie);

                const lineOpacity = isHovered ? 1 : iluminado ? 0.95 : 0.1;

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
                              ? 2
                              : iluminado
                              ? 1.35
                              : 0.75
                            : isHovered
                            ? 2.6
                            : iluminado
                            ? 1.65
                            : 1
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
                    fill={isCurrent ? '#38BDF8' : isHoveredCol ? '#E2E8F0' : '#64748B'}
                    fontSize={isMobile ? '9' : isCurrent ? '12' : '10.5'}
                    fontFamily="var(--font-mono)"
                    fontWeight={isCurrent ? '700' : '400'}
                  >
                    {jornada}
                  </text>
                )}
              </g>
            );
          })}

          {/* Columna Derecha: Escudo + Nombre (Abreviatura en mobile para que quepa todo sin scroll) */}
          {equiposOrdenadosRender.map((equipo) => {
            const iluminado = estaIluminado(equipo.id);
            const isHovered = hoveredEquipoId === equipo.id;
            const serie = modo === 'anual' ? equipo.evolucionAnual : equipo.evolucionDescenso;
            const { pos } = obtenerPosEnJornadaActiva(serie, jornadaActual);

            if (pos < minPuesto || pos > maxPuesto) return null;

            const yLabel = mapaYEtiquetaDerecha.get(equipo.id) ?? getY(pos);
            const crestSize = isMobile ? 14 : 20;

            return (
              <g
                key={`label-${equipo.id}`}
                transform={`translate(${padLeft + plotWidth + (isMobile ? 6 : 12)}, ${yLabel})`}
                className="cursor-pointer transition-opacity duration-150"
                style={{ opacity: isHovered ? 1 : iluminado ? 1 : 0.16 }}
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
                  fill={iluminado ? '#F8FAFC' : '#64748B'}
                  fontSize={isMobile ? '9.5' : '12'}
                  fontFamily={isMobile ? 'var(--font-mono)' : 'var(--font-sans)'}
                  fontWeight={isHovered || (iluminado && haySeleccionActiva) ? '700' : '500'}
                >
                  {isMobile ? `${pos}° ${equipo.abreviatura}` : equipo.nombre}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* 4. BOTONERA DE EQUIPOS ORDENADA POR CIERRE (SIN TEXTO DESCRIPTIVO) */}
      <div className="pt-3 border-t border-slate-800/80 space-y-2.5">
        {haySeleccionActiva && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setEquiposSeleccionados([])}
              className="text-sky-400 hover:text-sky-300 font-mono text-xs font-medium"
            >
              Restablecer todos ({equiposSeleccionados.length})
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1.5 sm:gap-2">
          {EQUIPOS_ORDENADOS_CIERRE.map((eq) => {
            const iluminado = estaIluminado(eq.id);
            const estaSeleccionadoExplicito = equiposSeleccionados.includes(eq.id);
            return (
              <button
                key={eq.id}
                type="button"
                onClick={() => toggleEquipo(eq.id)}
                onMouseEnter={() => setHoveredEquipoId(eq.id)}
                onMouseLeave={() => setHoveredEquipoId(null)}
                className={`flex items-center gap-2 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-lg text-xs font-medium transition-all border text-left ${
                  estaSeleccionadoExplicito
                    ? 'bg-slate-800 text-white border-sky-400'
                    : iluminado
                    ? 'bg-slate-900/90 text-slate-200 border-slate-800 hover:border-slate-700'
                    : 'bg-slate-950/40 text-slate-500 border-slate-900 opacity-30 hover:opacity-70'
                }`}
              >
                <ClubCrest equipo={eq} size={20} />
                <span className="truncate font-semibold">{eq.nombre}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 5. SECCIÓN NUEVA: DATOS CURIOSOS SEGÚN LA FECHA DEL SLIDER */}
      <section className="pt-4 border-t border-slate-800/80 space-y-3" aria-label="Datos curiosos de la jornada">
        <div className="flex items-center justify-between">
          <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-100">
            Datos Curiosos hasta la Jornada {jornadaActual}
          </h2>
          <span className="text-xs font-mono text-slate-400 tabular-nums">
            Actualizado a J{jornadaActual}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {datosCuriosos.map((dato) => (
            <div
              key={dato.id}
              onClick={() => toggleEquipo(dato.equipo.id)}
              className="flex items-center justify-between gap-3 p-3.5 bg-slate-950/70 border border-slate-800/90 rounded-lg cursor-pointer hover:border-slate-700 transition-colors"
            >
              <div className="min-w-0 space-y-0.5">
                <div className="text-xs text-slate-400">{dato.titulo}</div>
                <div className="text-base sm:text-lg font-bold font-mono text-slate-100 tabular-nums">
                  {dato.valorPrincipal}
                </div>
                <div className="text-xs text-slate-300 truncate">{dato.detalle}</div>
              </div>
              <ClubCrest equipo={dato.equipo} size={30} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
