import React, { useState, useEffect, useMemo } from 'react';
import { Download, Copy, Check } from 'lucide-react';

export const WIKI_API_URL =
  'https://es.wikipedia.org/w/api.php?action=parse&page=Campeonato_Uruguayo_de_Segunda_Divisi%C3%B3n_2026&prop=text|revid&format=json&origin=*';
export const CACHE_KEY = 'auf_segunda_2026_wiki_cache';
export const AUTO_SYNC_TTL_MS = 86400000; // 24 hours

export interface StandingRow {
  pos: number;
  equipo: string;
  logoUrl?: string;
  pts: number;
  pj: number;
  g: number;
  e: number;
  p: number;
  gf: number;
  gc: number;
  dif: number;
}

export interface RelegationRow {
  pos: number;
  posRaw: string;
  equipo: string;
  pj2025: number;
  pts2025: number;
  pj2026: number;
  pts2026: number;
  pj: number;
  pts: number;
  dg: number;
  prom: number;
  promFormatted: string;
}

export interface EvolutionTeamRow {
  equipo: string;
  jornadas: (number | null)[];
}

export interface FixtureMatch {
  fase: string;
  fechaNro: string;
  local: string;
  golesL: number | null;
  golesV: number | null;
  resultadoRaw: string;
  visitante: string;
  estadio: string;
  dia: string;
  hora: string;
  tv: string;
}

export interface PlayoffMatch {
  instancia: string;
  dia: string;
  hora: string;
  local: string;
  golesL: number | null;
  golesV: number | null;
  resultadoRaw: string;
  visitante: string;
  estadio: string;
}

export interface TeamCoachRow {
  equipo: string;
  logoUrl?: string;
  ciudad: string;
  estadio: string;
  capacidad: number | string;
  fundacion: string;
  temporadas: number | string;
  tempConsecutivas: number | string;
  titulos: number | string;
  indumentaria: string;
  formaJuridica: string;
  pos2025: string;
  dtInicial: string;
  dtSustitutos: string;
}

export interface HistoricalTeamStanding {
  equipo: string;
  puntosPorJornada: number[];
  pjPorJornada: number[];
  dgPorJornada: number[];
}

export interface WikiDataset {
  source: 'WIKIPEDIA API' | 'LOCAL .HTML';
  revid: number | string;
  timestamp: number;
  standings: {
    anual: StandingRow[];
    serieA: StandingRow[];
    serieB: StandingRow[];
  };
  relegation: RelegationRow[];
  evolution: {
    clasificacion: EvolutionTeamRow[];
    descenso: EvolutionTeamRow[];
  };
  fixtures: FixtureMatch[];
  historicalStandings?: Record<string, HistoricalTeamStanding>;
  playoffs: {
    clasificados: string[];
    semifinales: PlayoffMatch[];
    finalPlayoff: PlayoffMatch[];
    finalCompetencia: PlayoffMatch[];
  };
  teamsAndCoaches: TeamCoachRow[];
}

type TabKey =
  | 'standings'
  | 'relegation'
  | 'evolution'
  | 'fixtures'
  | 'playoffs'
  | 'teams';

function cleanCellText(cell: Element, preserveBrAsSlash = false): string {
  const clone = cell.cloneNode(true) as Element;
  clone
    .querySelectorAll(
      'style, script, sup.reference, .mw-references, .mw-collapsible-toggle, .mw-editsection, .sortkey, span[style*="display:none"]'
    )
    .forEach((el) => el.remove());

  if (preserveBrAsSlash) {
    clone.querySelectorAll('br').forEach((br) => {
      br.replaceWith(' / ');
    });
  }

  const raw = clone.textContent || '';
  return raw
    .replace(/[\u200B\uFEFF]/g, '')
    .replace(/\u00A0/g, ' ')
    .replace(/\u2212/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeTableMatrix(
  tableElement: Element,
  preserveBrAsSlash = false
): string[][] {
  const rows = Array.from(tableElement.querySelectorAll('tr'));
  const grid: string[][] = [];

  rows.forEach((row, rIdx) => {
    if (!grid[rIdx]) grid[rIdx] = [];
    let cIdx = 0;
    const cells = Array.from(row.children).filter(
      (el) => el.tagName === 'TD' || el.tagName === 'TH'
    );

    cells.forEach((cell) => {
      while (grid[rIdx][cIdx] !== undefined) {
        cIdx++;
      }
      const text = cleanCellText(cell, preserveBrAsSlash);
      const rowspan = Math.max(1, parseInt(cell.getAttribute('rowspan') || '1', 10) || 1);
      const colspan = Math.max(1, parseInt(cell.getAttribute('colspan') || '1', 10) || 1);

      for (let dr = 0; dr < rowspan; dr++) {
        for (let dc = 0; dc < colspan; dc++) {
          if (!grid[rIdx + dr]) grid[rIdx + dr] = [];
          grid[rIdx + dr][cIdx + dc] = text;
        }
      }
      cIdx += colspan;
    });
  });

  return grid;
}

function parseIntSafe(val: string | undefined): number {
  if (!val) return 0;
  const cleaned = val
    .replace(/\u2212/g, '-')
    .replace(/[+°º]/g, '')
    .replace(/\./g, '')
    .trim();
  if (cleaned === '-' || cleaned === '–' || cleaned === '—' || cleaned === '') {
    return 0;
  }
  const num = parseInt(cleaned, 10);
  return Number.isNaN(num) ? 0 : num;
}

function parseFloatProm(val: string | undefined): { num: number; formatted: string } {
  if (!val) return { num: 0, formatted: '0.000' };
  const normalized = val.replace(/\u2212/g, '-').replace(',', '.').trim();
  const num = parseFloat(normalized);
  if (Number.isNaN(num)) return { num: 0, formatted: '0.000' };
  return { num, formatted: num.toFixed(3) };
}

function normalizeTeamKey(name: string): string {
  return name
    .replace(/\([A-Z]\)/g, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function findAnchorElement(doc: Document, ids: string[]): Element | null {
  for (const id of ids) {
    const byId = doc.getElementById(id);
    if (byId) return byId;
    const escaped = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(id) : id;
    try {
      const q = doc.querySelector(`[id="${escaped}"]`);
      if (q) return q;
    } catch {
      // ignore selector error
    }
  }
  return null;
}

function findNextTableAfterAnchor(
  doc: Document,
  anchorIds: string[],
  selector = 'table.wikitable, table'
): Element | null {
  const anchor = findAnchorElement(doc, anchorIds);
  if (!anchor) return null;
  const tables = Array.from(doc.querySelectorAll(selector));
  for (const table of tables) {
    if (anchor.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING) {
      return table;
    }
  }
  return null;
}

function findTablesBetweenAnchors(
  doc: Document,
  startAnchorIds: string[],
  endAnchorIds: string[],
  selector = 'table.wikitable'
): Element[] {
  const startAnchor = findAnchorElement(doc, startAnchorIds);
  if (!startAnchor) return [];
  const endAnchor = findAnchorElement(doc, endAnchorIds);
  const tables = Array.from(doc.querySelectorAll(selector));

  return tables.filter((table) => {
    const afterStart =
      (startAnchor.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
    if (!afterStart) return false;
    if (!endAnchor) return true;
    const beforeEnd =
      (endAnchor.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_PRECEDING) !== 0;
    return beforeEnd;
  });
}

function parseStandingsTable(table: Element | null): StandingRow[] {
  if (!table) return [];
  const matrix = normalizeTableMatrix(table);
  const rows: StandingRow[] = [];

  for (let i = 1; i < matrix.length; i++) {
    const r = matrix[i];
    if (!r || r.length < 10) continue;
    if (!/^\d+/.test(r[0].trim())) continue;

    rows.push({
      pos: parseIntSafe(r[0]),
      equipo: r[1].trim(),
      pts: parseIntSafe(r[2]),
      pj: parseIntSafe(r[3]),
      g: parseIntSafe(r[4]),
      e: parseIntSafe(r[5]),
      p: parseIntSafe(r[6]),
      gf: parseIntSafe(r[7]),
      gc: parseIntSafe(r[8]),
      dif: parseIntSafe(r[9]),
    });
  }
  return rows;
}

function parseRelegationTable(table: Element | null): RelegationRow[] {
  if (!table) return [];
  const matrix = normalizeTableMatrix(table);
  const rows: RelegationRow[] = [];

  for (let i = 1; i < matrix.length; i++) {
    const r = matrix[i];
    if (!r || r.length < 10) continue;
    if (!/^\d+/.test(r[0].trim())) continue;

    const { num: prom, formatted: promFormatted } = parseFloatProm(r[9]);
    rows.push({
      pos: parseIntSafe(r[0]),
      posRaw: r[0].trim(),
      equipo: r[1].trim(),
      pj2025: parseIntSafe(r[2]),
      pts2025: parseIntSafe(r[3]),
      pj2026: parseIntSafe(r[4]),
      pts2026: parseIntSafe(r[5]),
      pj: parseIntSafe(r[6]),
      pts: parseIntSafe(r[7]),
      dg: parseIntSafe(r[8]),
      prom,
      promFormatted,
    });
  }
  return rows;
}

function parseEvolutionTable(table: Element | null): EvolutionTeamRow[] {
  if (!table) return [];
  const trs = Array.from(table.querySelectorAll('tr'));
  const result: EvolutionTeamRow[] = [];

  trs.forEach((tr, idx) => {
    if (idx === 0 || idx === 1) return;
    const cells = Array.from(tr.children).filter(
      (c) => c.tagName === 'TD' || c.tagName === 'TH'
    );
    if (cells.length < 2) return;
    const equipo = cleanCellText(cells[0]);
    if (!equipo || equipo.toLowerCase().includes('jornada')) return;

    const jornadas: (number | null)[] = [];
    for (let j = 1; j <= 33; j++) {
      const cell = cells[j];
      if (!cell) {
        jornadas.push(null);
      } else {
        const txt = cleanCellText(cell).replace(/[°º]/g, '');
        const n = parseInt(txt, 10);
        jornadas.push(Number.isNaN(n) ? null : n);
      }
    }
    result.push({ equipo, jornadas });
  });

  return result;
}

function parseScoreString(scoreRaw: string): {
  golesL: number | null;
  golesV: number | null;
} {
  const cleaned = scoreRaw.replace(/\u2212/g, '-').trim();
  const match = cleaned.match(/(\d+)\s*[:\-]\s*(\d+)/);
  if (!match) {
    return { golesL: null, golesV: null };
  }
  return {
    golesL: parseInt(match[1], 10),
    golesV: parseInt(match[2], 10),
  };
}

export function normalizeStadiumName(raw: string): string {
  const cleaned = raw
    .replace(/\[\d+\]/g, '')
    .replace(/[\u200B\uFEFF]/g, '')
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (/^parque\s+abraham\s+paladino$/i.test(cleaned)) {
    return 'Abraham Paladino';
  }
  return cleaned;
}

function extractClubLogosMap(table: Element | null): Map<string, string> {
  const map = new Map<string, string>();
  if (!table) return map;
  const trs = Array.from(table.querySelectorAll('tr'));
  trs.forEach((tr) => {
    const cells = Array.from(tr.querySelectorAll('td, th'));
    if (cells.length < 2) return;
    for (const c of cells.slice(0, 2)) {
      const img = c.querySelector('img');
      if (img) {
        let src = img.getAttribute('src') || '';
        if (src.startsWith('//')) {
          src = `https:${src}`;
        }
        const teamText = cleanCellText(c);
        if (src && teamText) {
          map.set(normalizeTeamKey(teamText), src);
        }
      }
    }
  });
  return map;
}

function parseFixturesSection(tables: Element[], faseLabel: string): FixtureMatch[] {
  const matches: FixtureMatch[] = [];

  tables.forEach((table) => {
    const matrix = normalizeTableMatrix(table);
    if (matrix.length < 2) return;

    let fechaNro = 'Fecha ?';
    const firstRowText = matrix[0]?.[0] || '';
    if (/fecha\s*\d+/i.test(firstRowText)) {
      fechaNro = firstRowText.replace(/mostrar|ocultar/gi, '').trim();
    }

    for (let rIdx = 0; rIdx < matrix.length; rIdx++) {
      const row = matrix[rIdx];
      if (!row || row.length < 6) continue;

      const local = row[0]?.trim() || '';
      const resultadoRaw = row[1]?.trim() || '';
      const visitante = row[2]?.trim() || '';
      const estadio = normalizeStadiumName(row[3]?.trim() || '');
      const dia = row[4]?.trim() || '';
      const hora = row[5]?.trim() || '';
      const tv = row[6]?.trim() || '';

      if (
        !local ||
        local.toLowerCase() === 'local' ||
        /^fecha\s*\d+/i.test(local) ||
        /^libre\b/i.test(local) ||
        (local === resultadoRaw && resultadoRaw === visitante)
      ) {
        continue;
      }

      const { golesL, golesV } = parseScoreString(resultadoRaw);
      matches.push({
        fase: faseLabel,
        fechaNro,
        local,
        golesL,
        golesV,
        resultadoRaw,
        visitante,
        estadio,
        dia,
        hora,
        tv,
      });
    }
  });

  return matches;
}

function parseVeventTables(tables: Element[], instanciaLabel: string): PlayoffMatch[] {
  const list: PlayoffMatch[] = [];

  tables.forEach((table) => {
    const trs = Array.from(table.querySelectorAll('tr'));
    if (trs.length === 0) return;

    const firstRowCells = Array.from(trs[0].querySelectorAll('td, th'));
    if (firstRowCells.length < 4) return;

    const dia = cleanCellText(firstRowCells[0]);
    const local = cleanCellText(firstRowCells[1]);
    const resultadoRaw = cleanCellText(firstRowCells[2]);
    const visitante = cleanCellText(firstRowCells[3]);
    const estadio = firstRowCells[4] ? normalizeStadiumName(cleanCellText(firstRowCells[4])) : '';

    let hora = '';
    if (trs[1]) {
      const secondRowCells = Array.from(trs[1].querySelectorAll('td, th'));
      if (secondRowCells[0]) {
        const candidateHora = cleanCellText(secondRowCells[0]);
        if (/^\d{1,2}:\d{2}/.test(candidateHora)) {
          hora = candidateHora;
        }
      }
    }

    if (!local && !visitante) return;
    const { golesL, golesV } = parseScoreString(resultadoRaw);

    list.push({
      instancia: instanciaLabel,
      dia,
      hora,
      local,
      golesL,
      golesV,
      resultadoRaw,
      visitante,
      estadio,
    });
  });

  return list;
}

export function buildHistoricalStandings(
  fixtures: FixtureMatch[]
): Record<string, HistoricalTeamStanding> {
  const mapByNorm = new Map<
    string,
    {
      equipo: string;
      deltaPts: number[];
      deltaPj: number[];
      deltaDg: number[];
    }
  >();

  const ensureTeam = (rawName: string) => {
    const cleanName = rawName.replace(/\([A-Z]\)/gi, '').trim();
    const key = normalizeTeamKey(cleanName);
    if (!key) return null;
    let entry = mapByNorm.get(key);
    if (!entry) {
      entry = {
        equipo: cleanName,
        deltaPts: Array(33).fill(0),
        deltaPj: Array(33).fill(0),
        deltaDg: Array(33).fill(0),
      };
      mapByNorm.set(key, entry);
    }
    return entry;
  };

  fixtures.forEach((m) => {
    if (m.golesL === null || m.golesV === null) return;
    if (Number.isNaN(m.golesL) || Number.isNaN(m.golesV)) return;

    const faseLower = (m.fase || '').toLowerCase();
    const isCompetencia =
      faseLower.includes('competencia') &&
      (faseLower.includes('serie a') || faseLower.includes('serie b'));
    const isRegular =
      faseLower.includes('fase regular') &&
      (faseLower.includes('r1') || faseLower.includes('r2'));

    if (!isCompetencia && !isRegular) return;

    const fechaMatch = (m.fechaNro || '').match(/(\d+)/);
    if (!fechaMatch) return;
    const numeroDeFecha = parseInt(fechaMatch[1], 10);
    if (Number.isNaN(numeroDeFecha)) return;

    let jornadaGlobal = 0;
    if (isCompetencia) {
      if (numeroDeFecha < 1 || numeroDeFecha > 7) return;
      jornadaGlobal = numeroDeFecha; // J1 a J7
    } else {
      if (numeroDeFecha < 1 || numeroDeFecha > 26) return;
      jornadaGlobal = numeroDeFecha + 7; // J8 a J33
    }

    const jIdx = jornadaGlobal - 1;
    const localEntry = ensureTeam(m.local);
    const visitEntry = ensureTeam(m.visitante);

    if (localEntry) {
      localEntry.deltaPj[jIdx] += 1;
      localEntry.deltaDg[jIdx] += m.golesL - m.golesV;
      if (m.golesL > m.golesV) {
        localEntry.deltaPts[jIdx] += 3;
      } else if (m.golesL === m.golesV) {
        localEntry.deltaPts[jIdx] += 1;
      }
    }

    if (visitEntry) {
      visitEntry.deltaPj[jIdx] += 1;
      visitEntry.deltaDg[jIdx] += m.golesV - m.golesL;
      if (m.golesV > m.golesL) {
        visitEntry.deltaPts[jIdx] += 3;
      } else if (m.golesV === m.golesL) {
        visitEntry.deltaPts[jIdx] += 1;
      }
    }
  });

  const historicalStandings: Record<string, HistoricalTeamStanding> = {};
  mapByNorm.forEach((entry) => {
    const puntosPorJornada: number[] = [];
    const pjPorJornada: number[] = [];
    const dgPorJornada: number[] = [];

    let accPts = 0;
    let accPj = 0;
    let accDg = 0;

    for (let i = 0; i < 33; i++) {
      accPts += entry.deltaPts[i];
      accPj += entry.deltaPj[i];
      accDg += entry.deltaDg[i];
      puntosPorJornada.push(accPts);
      pjPorJornada.push(accPj);
      dgPorJornada.push(accDg);
    }

    historicalStandings[entry.equipo] = {
      equipo: entry.equipo,
      puntosPorJornada,
      pjPorJornada,
      dgPorJornada,
    };
  });

  return historicalStandings;
}

export function parseWikipediaHtml(
  htmlString: string,
  revid: number | string,
  source: 'WIKIPEDIA API' | 'LOCAL .HTML'
): WikiDataset {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, 'text/html');

  const infoTable = findNextTableAfterAnchor(doc, [
    'Información_general',
    'Informaci.C3.B3n_general',
  ]);
  const coachesTable = findNextTableAfterAnchor(doc, ['Entrenadores']);
  const tablaAnualEl = findNextTableAfterAnchor(doc, [
    'Clasificación',
    'Clasificaci.C3.B3n',
  ]);

  const logosInfoMap = extractClubLogosMap(infoTable);
  const logosAnualMap = extractClubLogosMap(tablaAnualEl);

  const coachesMap = new Map<string, { inicial: string; sustitutos: string }>();
  if (coachesTable) {
    const cMatrix = normalizeTableMatrix(coachesTable, true);
    for (let i = 1; i < cMatrix.length; i++) {
      const row = cMatrix[i];
      if (!row || row.length < 2) continue;
      const teamName = row[0]?.trim();
      if (!teamName || teamName.toLowerCase() === 'equipo') continue;
      coachesMap.set(normalizeTeamKey(teamName), {
        inicial: row[1]?.trim() || '—',
        sustitutos: row[2]?.trim() || '—',
      });
    }
  }

  const teamsAndCoaches: TeamCoachRow[] = [];
  if (infoTable) {
    const infoMatrix = normalizeTableMatrix(infoTable);
    for (let i = 1; i < infoMatrix.length; i++) {
      const r = infoMatrix[i];
      if (!r || r.length < 11) continue;
      const equipo = r[0]?.trim();
      if (!equipo || equipo.toLowerCase() === 'equipo') continue;
      const key = normalizeTeamKey(equipo);
      const coachInfo = coachesMap.get(key) || {
        inicial: '—',
        sustitutos: '—',
      };

      const capNum = parseIntSafe(r[3]);
      teamsAndCoaches.push({
        equipo,
        logoUrl: logosInfoMap.get(key) || logosAnualMap.get(key),
        ciudad: r[1]?.trim() || '',
        estadio: normalizeStadiumName(r[2]?.trim() || ''),
        capacidad: capNum > 0 ? capNum : r[3]?.trim() || '',
        fundacion: r[4]?.trim() || '',
        temporadas: parseIntSafe(r[5]) || r[5]?.trim() || '',
        tempConsecutivas: parseIntSafe(r[6]) || r[6]?.trim() || '',
        titulos: r[7]?.trim() === '–' || r[7]?.trim() === '-' ? 0 : parseIntSafe(r[7]),
        indumentaria: r[8]?.trim() || '',
        formaJuridica: r[9]?.trim() || '',
        pos2025: r[10]?.trim() || '',
        dtInicial: coachInfo.inicial,
        dtSustitutos: coachInfo.sustitutos || '—',
      });
    }
  }

  const serieATableEl = findNextTableAfterAnchor(doc, ['Posiciones']);
  const serieBTableEl = findNextTableAfterAnchor(doc, ['Posiciones_2']);

  const standings = {
    anual: parseStandingsTable(tablaAnualEl).map((row) => ({
      ...row,
      logoUrl:
        logosAnualMap.get(normalizeTeamKey(row.equipo)) ||
        logosInfoMap.get(normalizeTeamKey(row.equipo)),
    })),
    serieA: parseStandingsTable(serieATableEl),
    serieB: parseStandingsTable(serieBTableEl),
  };

  const relegationTableEl = findNextTableAfterAnchor(doc, [
    'Clasificación_2',
    'Clasificaci.C3.B3n_2',
  ]);
  const relegation = parseRelegationTable(relegationTableEl);

  const evolClasifEl = findNextTableAfterAnchor(doc, [
    'Evolución_de_la_clasificación',
    'Evoluci.C3.B3n_de_la_clasificaci.C3.B3n',
  ]);
  const evolDescensoEl = findNextTableAfterAnchor(doc, [
    'Evolución_de_la_clasificación_2',
    'Evoluci.C3.B3n_de_la_clasificaci.C3.B3n_2',
  ]);

  const evolution = {
    clasificacion: parseEvolutionTable(evolClasifEl),
    descenso: parseEvolutionTable(evolDescensoEl),
  };

  const tablesSerieA = findTablesBetweenAnchors(doc, ['Resultados'], ['Serie_B']);
  const tablesSerieB = findTablesBetweenAnchors(doc, ['Resultados_2'], ['Final', 'Fase_regular']);
  const tablesRonda1 = findTablesBetweenAnchors(doc, ['Primera_Ronda'], ['Segunda_Ronda']);
  const tablesRonda2 = findTablesBetweenAnchors(doc, ['Segunda_Ronda'], [
    'Tabla_del_descenso',
  ]);

  const fixtures: FixtureMatch[] = [
    ...parseFixturesSection(tablesSerieA, 'Torneo Competencia - Serie A'),
    ...parseFixturesSection(tablesSerieB, 'Torneo Competencia - Serie B'),
    ...parseFixturesSection(tablesRonda1, 'Fase Regular - R1'),
    ...parseFixturesSection(tablesRonda2, 'Fase Regular - R2'),
  ];

  const historicalStandings = buildHistoricalStandings(fixtures);

  const clasificados: string[] = [];
  const clasifAnchor = findAnchorElement(doc, ['Equipos_clasificados']);
  if (clasifAnchor) {
    const container = clasifAnchor.closest('.mw-heading') || clasifAnchor;
    let nextEl = container.nextElementSibling;
    while (nextEl && !nextEl.matches('h2, h3, .mw-heading')) {
      if (nextEl.tagName === 'UL') {
        Array.from(nextEl.querySelectorAll('li')).forEach((li) => {
          const t = cleanCellText(li);
          if (t) clasificados.push(t);
        });
        break;
      }
      nextEl = nextEl.nextElementSibling;
    }
  }

  const semiVevents = findTablesBetweenAnchors(
    doc,
    ['Semifinales'],
    ['Final_2'],
    'table.vevent'
  );
  const finalPlayoffVevents = findTablesBetweenAnchors(
    doc,
    ['Final_2'],
    ['Ascensos_a_Primera_División', 'Ascensos_a_Primera_Divisi.C3.B3n'],
    'table.vevent'
  );
  const finalTCVevents = findTablesBetweenAnchors(
    doc,
    ['Final'],
    ['Fase_regular'],
    'table.vevent'
  );

  const playoffs = {
    clasificados,
    semifinales: parseVeventTables(semiVevents, 'Play-Offs · Semifinal'),
    finalPlayoff: parseVeventTables(finalPlayoffVevents, 'Play-Offs · Final'),
    finalCompetencia: parseVeventTables(finalTCVevents, 'Torneo Competencia · Final'),
  };

  return {
    source,
    revid,
    timestamp: Date.now(),
    standings,
    relegation,
    evolution,
    fixtures,
    historicalStandings,
    playoffs,
    teamsAndCoaches,
  };
}

export function leerWikiCache(): WikiDataset | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WikiDataset;
    if (parsed && typeof parsed.timestamp === 'number') {
      if (Array.isArray(parsed.fixtures)) {
        parsed.fixtures = parsed.fixtures.map((f) => ({
          ...f,
          estadio: normalizeStadiumName(f.estadio),
        }));
        if (
          !parsed.historicalStandings ||
          Object.keys(parsed.historicalStandings).length === 0
        ) {
          parsed.historicalStandings = buildHistoricalStandings(parsed.fixtures);
          try {
            localStorage.setItem(CACHE_KEY, JSON.stringify(parsed));
          } catch {
            // ignore quota errors
          }
        }
      }
      return parsed;
    }
  } catch {
    // ignore
  }
  return null;
}

export async function scrapeAndCacheWikipedia(): Promise<WikiDataset> {
  const response = await fetch(WIKI_API_URL);
  if (!response.ok) {
    throw new Error(`HTTP_${response.status} ${response.statusText}`);
  }
  const json = await response.json();
  const htmlString: string | undefined = json?.parse?.text?.['*'];
  const revid: number | string = json?.parse?.revid ?? 'UNKNOWN';

  if (!htmlString) {
    throw new Error('INVALID_MEDIAWIKI_PARSE_PAYLOAD');
  }

  const parsed = parseWikipediaHtml(htmlString, revid, 'WIKIPEDIA API');
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(parsed));
  } catch {
    // ignore storage quota errors
  }
  return parsed;
}

function formatDateTime(ts: number | null): string {
  if (!ts) return 'NEVER';
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function computeRemainingHours(ts: number | null): string {
  if (!ts) return '0.0';
  const elapsed = Date.now() - ts;
  const remainingMs = Math.max(0, AUTO_SYNC_TTL_MS - elapsed);
  return (remainingMs / 3600000).toFixed(1);
}

export const WikiSandbox: React.FC = () => {
  const [dataset, setDataset] = useState<WikiDataset | null>(() => leerWikiCache());
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('standings');
  const [viewMode, setViewMode] = useState<'table' | 'json'>('table');
  const [copied, setCopied] = useState<boolean>(false);

  const [faseFilter, setFaseFilter] = useState<string>('ALL');
  const [fechaFilter, setFechaFilter] = useState<string>('ALL');
  const [teamFilter, setTeamFilter] = useState<string>('ALL');

  useEffect(() => {
    const cached = leerWikiCache();
    if (cached && Date.now() - cached.timestamp <= AUTO_SYNC_TTL_MS) {
      setDataset(cached);
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    scrapeAndCacheWikipedia()
      .then((parsed) => setDataset(parsed))
      .catch((err: unknown) =>
        setErrorMsg(err instanceof Error ? err.message : 'SCRAPE_ERROR')
      )
      .finally(() => setLoading(false));
  }, []);

  const handleExportAllJson = () => {
    if (!dataset) return;
    const blob = new Blob([JSON.stringify(dataset, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'segunda_uruguay_2026.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const activeTabPayload = useMemo(() => {
    if (!dataset) return null;
    switch (activeTab) {
      case 'standings':
        return dataset.standings;
      case 'relegation':
        return dataset.relegation;
      case 'evolution':
        return dataset.evolution;
      case 'fixtures':
        return dataset.fixtures;
      case 'playoffs':
        return dataset.playoffs;
      case 'teams':
        return dataset.teamsAndCoaches;
    }
  }, [dataset, activeTab]);

  const handleCopyJson = async () => {
    const payload = activeTabPayload ?? dataset;
    if (!payload) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  const fixtureFases = useMemo(() => {
    if (!dataset) return [];
    return Array.from(new Set(dataset.fixtures.map((f) => f.fase)));
  }, [dataset]);

  const fixtureFechas = useMemo(() => {
    if (!dataset) return [];
    const subset =
      faseFilter === 'ALL'
        ? dataset.fixtures
        : dataset.fixtures.filter((f) => f.fase === faseFilter);
    return Array.from(new Set(subset.map((f) => f.fechaNro)));
  }, [dataset, faseFilter]);

  const fixtureTeams = useMemo(() => {
    if (!dataset) return [];
    const set = new Set<string>();
    dataset.fixtures.forEach((f) => {
      if (f.local) set.add(f.local);
      if (f.visitante) set.add(f.visitante);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [dataset]);

  const filteredFixtures = useMemo(() => {
    if (!dataset) return [];
    return dataset.fixtures.filter((f) => {
      if (faseFilter !== 'ALL' && f.fase !== faseFilter) return false;
      if (fechaFilter !== 'ALL' && f.fechaNro !== fechaFilter) return false;
      if (teamFilter !== 'ALL' && f.local !== teamFilter && f.visitante !== teamFilter)
        return false;
      return true;
    });
  }, [dataset, faseFilter, fechaFilter, teamFilter]);

  const renderStandingsTable = (rows: StandingRow[], title: string) => (
    <div className="border border-slate-300 rounded bg-white overflow-hidden shadow-xs">
      <div className="px-2.5 py-1.5 bg-slate-100 border-b border-slate-300 flex items-center justify-between text-[11px] font-mono">
        <span className="font-bold text-slate-900">{title}</span>
        <span className="text-slate-600 font-semibold tabular-nums">ROWS: {rows.length}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-[11px] font-mono tabular-nums">
          <thead>
            <tr className="bg-slate-50 text-slate-700 border-b border-slate-300 font-semibold">
              <th className="py-1.5 px-2 w-10">Pos.</th>
              <th className="py-1.5 px-2">Equipo</th>
              <th className="py-1.5 px-2 text-right">Pts.</th>
              <th className="py-1.5 px-2 text-right">PJ</th>
              <th className="py-1.5 px-2 text-right">G</th>
              <th className="py-1.5 px-2 text-right">E</th>
              <th className="py-1.5 px-2 text-right">P</th>
              <th className="py-1.5 px-2 text-right">GF</th>
              <th className="py-1.5 px-2 text-right">GC</th>
              <th className="py-1.5 px-2 text-right">Dif.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {rows.map((r) => (
              <tr key={`${title}-${r.pos}-${r.equipo}`} className="hover:bg-slate-100/80">
                <td className="py-1 px-2 font-bold text-slate-800">{r.pos}</td>
                <td className="py-1 px-2 font-sans font-semibold text-slate-950 whitespace-nowrap">
                  {r.equipo}
                </td>
                <td className="py-1 px-2 text-right font-bold text-emerald-800">{r.pts}</td>
                <td className="py-1 px-2 text-right text-slate-800">{r.pj}</td>
                <td className="py-1 px-2 text-right text-slate-800">{r.g}</td>
                <td className="py-1 px-2 text-right text-slate-800">{r.e}</td>
                <td className="py-1 px-2 text-right text-slate-800">{r.p}</td>
                <td className="py-1 px-2 text-right text-slate-800">{r.gf}</td>
                <td className="py-1 px-2 text-right text-slate-800">{r.gc}</td>
                <td
                  className={`py-1 px-2 text-right font-bold ${
                    r.dif > 0
                      ? 'text-emerald-700'
                      : r.dif < 0
                      ? 'text-rose-700'
                      : 'text-slate-600'
                  }`}
                >
                  {r.dif > 0 ? `+${r.dif}` : r.dif}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderEvolutionMatrix = (rows: EvolutionTeamRow[], title: string) => (
    <div className="border border-slate-300 rounded bg-white overflow-hidden shadow-xs">
      <div className="px-2.5 py-1.5 bg-slate-100 border-b border-slate-300 flex items-center justify-between text-[11px] font-mono">
        <span className="font-bold text-slate-900">{title}</span>
        <span className="text-slate-600 font-semibold tabular-nums">
          MATRIX: {rows.length}x33
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-[11px] font-mono tabular-nums">
          <thead>
            <tr className="bg-slate-50 text-slate-700 border-b border-slate-300 font-semibold">
              <th className="py-1.5 px-2 sticky left-0 bg-slate-100 z-10 border-r border-slate-300 min-w-[145px]">
                Equipo
              </th>
              {Array.from({ length: 33 }, (_, i) => i + 1).map((j) => (
                <th key={j} className="py-1.5 px-1.5 text-center min-w-[28px]">
                  {j}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {rows.map((row) => (
              <tr key={`${title}-${row.equipo}`} className="hover:bg-slate-100/70">
                <td className="py-1 px-2 font-sans font-semibold text-slate-950 sticky left-0 bg-white z-10 border-r border-slate-300 whitespace-nowrap">
                  {row.equipo}
                </td>
                {row.jornadas.map((pos, jIdx) => {
                  const isTop2 = pos === 1 || pos === 2;
                  const isBottom2 = pos === 13 || pos === 14;
                  return (
                    <td
                      key={jIdx}
                      className={`py-1 px-1 text-center border-r border-slate-200 ${
                        isTop2
                          ? 'bg-emerald-100 text-emerald-900 font-bold'
                          : isBottom2
                          ? 'bg-rose-100 text-rose-900 font-bold'
                          : 'text-slate-800'
                      }`}
                    >
                      {pos ?? '-'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans text-xs select-text">
      {/* 3. BARRA SUPERIOR DE CONTROL (Modo Producción — Solo Lectura, Sin Refresh Manual) */}
      <header className="border-b border-slate-300 bg-slate-50 px-3 py-2 sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] tabular-nums text-slate-700">
            <span className="px-1.5 py-0.5 rounded bg-white border border-slate-300">
              SOURCE:{' '}
              <strong className="text-emerald-800">
                {dataset?.source ?? 'WIKIPEDIA API'}
              </strong>
            </span>
            <span className="text-slate-400">|</span>
            <span className="px-1.5 py-0.5 rounded bg-white border border-slate-300">
              REV_ID: <strong className="text-sky-800">{dataset?.revid ?? '—'}</strong>
            </span>
            <span className="text-slate-400">|</span>
            <span className="px-1.5 py-0.5 rounded bg-white border border-slate-300">
              LAST_SYNC:{' '}
              <strong className="text-slate-950">
                {formatDateTime(dataset?.timestamp ?? null)}
              </strong>
            </span>
            <span className="text-slate-400">|</span>
            <span className="px-1.5 py-0.5 rounded bg-white border border-slate-300">
              AUTO_SYNC_TTL:{' '}
              <strong className="text-amber-800">
                {computeRemainingHours(dataset?.timestamp ?? null)}h
              </strong>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
            <button
              type="button"
              onClick={handleExportAllJson}
              disabled={!dataset}
              className="px-2.5 py-1 rounded bg-white hover:bg-slate-100 text-slate-900 border border-slate-300 font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
            >
              <Download className="w-3 h-3 text-amber-700" />
              <span>[Export All JSON]</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-[1600px] mx-auto p-3 space-y-2.5">
        {errorMsg && (
          <div className="p-2 rounded bg-rose-50 border border-rose-300 text-rose-900 font-mono text-[11px] font-semibold">
            SCRAPER_ERROR: {errorMsg}
          </div>
        )}

        {/* 4. NAVEGACIÓN POR PESTAÑAS + TOGGLE [Table | Raw JSON] + [Copy JSON] */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-300 pb-2">
          <div className="flex flex-wrap items-center gap-1 font-mono">
            {(
              [
                { id: 'standings', label: 'Standings (Anual & Series)', count: dataset ? dataset.standings.anual.length : 0 },
                { id: 'relegation', label: 'Relegation (Promedios)', count: dataset ? dataset.relegation.length : 0 },
                { id: 'evolution', label: 'Evolution Matrices (J1-J33)', count: dataset ? dataset.evolution.clasificacion.length : 0 },
                { id: 'fixtures', label: 'Fixtures (All Matches)', count: dataset ? dataset.fixtures.length : 0 },
                {
                  id: 'playoffs',
                  label: 'Playoffs',
                  count: dataset
                    ? dataset.playoffs.semifinales.length +
                      dataset.playoffs.finalPlayoff.length +
                      dataset.playoffs.finalCompetencia.length
                    : 0,
                },
                { id: 'teams', label: 'Teams & Coaches', count: dataset ? dataset.teamsAndCoaches.length : 0 },
              ] as { id: TabKey; label: string; count: number }[]
            ).map((t) => {
              const active = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTab(t.id)}
                  className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                    active
                      ? 'bg-sky-700 text-white border border-sky-800'
                      : 'bg-slate-100 text-slate-700 hover:text-slate-950 border border-slate-300'
                  }`}
                >
                  <span>{t.label}</span>
                  <span
                    className={`px-1 py-0.2 rounded text-[10px] tabular-nums ${
                      active
                        ? 'bg-sky-900 text-white'
                        : 'bg-white text-slate-700 border border-slate-300'
                    }`}
                  >
                    {t.count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1.5 font-mono text-[11px]">
            <div className="flex items-center bg-slate-100 border border-slate-300 rounded p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`px-2 py-0.5 rounded cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-slate-900 text-white font-semibold'
                    : 'text-slate-700 hover:text-slate-950'
                }`}
              >
                Table
              </button>
              <button
                type="button"
                onClick={() => setViewMode('json')}
                className={`px-2 py-0.5 rounded cursor-pointer ${
                  viewMode === 'json'
                    ? 'bg-slate-900 text-white font-semibold'
                    : 'text-slate-700 hover:text-slate-950'
                }`}
              >
                Raw JSON
              </button>
            </div>

            <button
              type="button"
              onClick={handleCopyJson}
              disabled={!dataset}
              className="px-2.5 py-1 rounded bg-white hover:bg-slate-100 text-slate-900 border border-slate-300 font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-40"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3 text-emerald-700" />
                  <span className="text-emerald-800">[Copied]</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3 text-slate-700" />
                  <span>[Copy JSON]</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* CONTENIDO DE PESTAÑA */}
        {!dataset ? (
          <div className="border border-slate-300 rounded bg-slate-50 p-6 text-center font-mono text-[11px] text-slate-600">
            {loading ? 'SCRAPING_WIKIPEDIA_DOM...' : 'CACHE_EMPTY'}
          </div>
        ) : viewMode === 'json' ? (
          <pre className="p-3 rounded bg-slate-50 border border-slate-300 font-mono text-[11px] text-slate-900 overflow-x-auto max-h-[78vh] leading-relaxed tabular-nums">
            {JSON.stringify(activeTabPayload, null, 2)}
          </pre>
        ) : (
          <>
            {/* 1. STANDINGS (Anual & Series) */}
            {activeTab === 'standings' && (
              <div className="space-y-3">
                {renderStandingsTable(
                  dataset.standings.anual,
                  'TABLA ANUAL / FASE REGULAR (#Clasificación)'
                )}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {renderStandingsTable(
                    dataset.standings.serieA,
                    'TORNEO COMPETENCIA · SERIE A (#Posiciones)'
                  )}
                  {renderStandingsTable(
                    dataset.standings.serieB,
                    'TORNEO COMPETENCIA · SERIE B (#Posiciones_2)'
                  )}
                </div>
              </div>
            )}

            {/* 2. RELEGATION (Promedios) */}
            {activeTab === 'relegation' && (
              <div className="border border-slate-300 rounded bg-white overflow-hidden shadow-xs">
                <div className="px-2.5 py-1.5 bg-slate-100 border-b border-slate-300 flex items-center justify-between text-[11px] font-mono">
                  <span className="font-bold text-slate-900">
                    TABLA DEL DESCENSO / PROMEDIOS (#Clasificación_2)
                  </span>
                  <span className="text-slate-600 font-semibold tabular-nums">
                    ROWS: {dataset.relegation.length}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-[11px] font-mono tabular-nums">
                    <thead>
                      <tr className="bg-slate-50 text-slate-700 border-b border-slate-300 font-semibold">
                        <th className="py-1.5 px-2 w-12">Pos.</th>
                        <th className="py-1.5 px-2">Equipos</th>
                        <th className="py-1.5 px-2 text-right">PJ 2025</th>
                        <th className="py-1.5 px-2 text-right">PTS 2025</th>
                        <th className="py-1.5 px-2 text-right">PJ 2026</th>
                        <th className="py-1.5 px-2 text-right">PTS 2026</th>
                        <th className="py-1.5 px-2 text-right">PJ</th>
                        <th className="py-1.5 px-2 text-right">PTS</th>
                        <th className="py-1.5 px-2 text-right">DG</th>
                        <th className="py-1.5 px-2 text-right">Prom.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {dataset.relegation.map((r) => {
                        const isRelegated = r.pos === 13 || r.pos === 14;
                        return (
                          <tr
                            key={`rel-${r.pos}-${r.equipo}`}
                            className={
                              isRelegated
                                ? 'bg-rose-50 hover:bg-rose-100/70 text-rose-950'
                                : 'hover:bg-slate-100/70'
                            }
                          >
                            <td className="py-1 px-2 font-bold">{r.posRaw}</td>
                            <td className="py-1 px-2 font-sans font-semibold whitespace-nowrap">
                              {r.equipo}
                            </td>
                            <td className="py-1 px-2 text-right text-slate-600">{r.pj2025}</td>
                            <td className="py-1 px-2 text-right text-slate-600">{r.pts2025}</td>
                            <td className="py-1 px-2 text-right text-slate-800">{r.pj2026}</td>
                            <td className="py-1 px-2 text-right text-slate-800">{r.pts2026}</td>
                            <td className="py-1 px-2 text-right font-semibold">{r.pj}</td>
                            <td className="py-1 px-2 text-right font-semibold">{r.pts}</td>
                            <td
                              className={`py-1 px-2 text-right font-bold ${
                                r.dg > 0
                                  ? 'text-emerald-700'
                                  : r.dg < 0
                                  ? 'text-rose-700'
                                  : 'text-slate-600'
                              }`}
                            >
                              {r.dg > 0 ? `+${r.dg}` : r.dg}
                            </td>
                            <td className="py-1 px-2 text-right font-bold text-amber-800">
                              {r.promFormatted}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 3. EVOLUTION MATRICES (J1-J33) */}
            {activeTab === 'evolution' && (
              <div className="space-y-3">
                {renderEvolutionMatrix(
                  dataset.evolution.clasificacion,
                  'EVOLUCIÓN DE LA CLASIFICACIÓN (#Evolución_de_la_clasificación)'
                )}
                {renderEvolutionMatrix(
                  dataset.evolution.descenso,
                  'EVOLUCIÓN DEL DESCENSO (#Evolución_de_la_clasificación_2)'
                )}
              </div>
            )}

            {/* 4. FIXTURES (All Matches) */}
            {activeTab === 'fixtures' && (
              <div className="border border-slate-300 rounded bg-white overflow-hidden shadow-xs">
                <div className="px-2.5 py-1.5 bg-slate-100 border-b border-slate-300 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-1 text-slate-700 font-semibold">
                      <span>FASE:</span>
                      <select
                        value={faseFilter}
                        onChange={(e) => {
                          setFaseFilter(e.target.value);
                          setFechaFilter('ALL');
                        }}
                        className="bg-white border border-slate-300 rounded px-1.5 py-0.5 text-slate-900 font-normal"
                      >
                        <option value="ALL">ALL ({dataset.fixtures.length})</option>
                        {fixtureFases.map((f) => (
                          <option key={f} value={f}>
                            {f}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="flex items-center gap-1 text-slate-700 font-semibold">
                      <span>FECHA:</span>
                      <select
                        value={fechaFilter}
                        onChange={(e) => setFechaFilter(e.target.value)}
                        className="bg-white border border-slate-300 rounded px-1.5 py-0.5 text-slate-900 font-normal"
                      >
                        <option value="ALL">ALL</option>
                        {fixtureFechas.map((fe) => (
                          <option key={fe} value={fe}>
                            {fe}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="flex items-center gap-1 text-slate-700 font-semibold">
                      <span>EQUIPO:</span>
                      <select
                        value={teamFilter}
                        onChange={(e) => setTeamFilter(e.target.value)}
                        className="bg-white border border-slate-300 rounded px-1.5 py-0.5 text-slate-900 font-normal"
                      >
                        <option value="ALL">ALL</option>
                        {fixtureTeams.map((tm) => (
                          <option key={tm} value={tm}>
                            {tm}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <span className="text-slate-700 font-semibold tabular-nums">
                    MATCHES: {filteredFixtures.length} / {dataset.fixtures.length}
                  </span>
                </div>

                <div className="overflow-x-auto max-h-[75vh]">
                  <table className="w-full text-left border-collapse text-[11px] font-mono tabular-nums">
                    <thead className="sticky top-0 bg-slate-100 z-10 border-b border-slate-300 text-slate-700 font-semibold">
                      <tr>
                        <th className="py-1.5 px-2">Fase</th>
                        <th className="py-1.5 px-2">Fecha_Nro</th>
                        <th className="py-1.5 px-2 text-right">Local</th>
                        <th className="py-1.5 px-2 text-center w-14">Goles_L</th>
                        <th className="py-1.5 px-2 text-center w-14">Goles_V</th>
                        <th className="py-1.5 px-2">Visitante</th>
                        <th className="py-1.5 px-2">Estadio</th>
                        <th className="py-1.5 px-2">Dia</th>
                        <th className="py-1.5 px-2">Hora</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {filteredFixtures.map((m, idx) => (
                        <tr
                          key={`${m.fase}-${m.fechaNro}-${m.local}-${m.visitante}-${idx}`}
                          className="hover:bg-slate-100/70"
                        >
                          <td className="py-1 px-2 text-slate-600 whitespace-nowrap">
                            {m.fase}
                          </td>
                          <td className="py-1 px-2 text-sky-800 font-semibold whitespace-nowrap">
                            {m.fechaNro}
                          </td>
                          <td className="py-1 px-2 text-right font-sans font-semibold text-slate-950 whitespace-nowrap">
                            {m.local}
                          </td>
                          <td className="py-1 px-2 text-center font-bold bg-slate-50 text-emerald-800">
                            {m.golesL ?? '-'}
                          </td>
                          <td className="py-1 px-2 text-center font-bold bg-slate-50 text-emerald-800">
                            {m.golesV ?? '-'}
                          </td>
                          <td className="py-1 px-2 font-sans font-semibold text-slate-950 whitespace-nowrap">
                            {m.visitante}
                          </td>
                          <td className="py-1 px-2 font-sans text-slate-700 whitespace-nowrap">
                            {m.estadio}
                          </td>
                          <td className="py-1 px-2 text-slate-800 whitespace-nowrap">
                            {m.dia}
                          </td>
                          <td className="py-1 px-2 text-slate-700 whitespace-nowrap">
                            {m.hora}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 5. PLAYOFFS */}
            {activeTab === 'playoffs' && (
              <div className="space-y-3">
                <div className="border border-slate-300 rounded bg-slate-50 p-2.5 font-mono text-[11px] flex flex-wrap items-center gap-2">
                  <span className="text-slate-700 font-bold">
                    EQUIPOS_CLASIFICADOS (#Equipos_clasificados):
                  </span>
                  {dataset.playoffs.clasificados.map((c) => (
                    <span
                      key={c}
                      className="px-2 py-0.5 rounded bg-white border border-slate-300 text-sky-900 font-sans font-semibold"
                    >
                      {c}
                    </span>
                  ))}
                </div>

                <div className="border border-slate-300 rounded bg-white overflow-hidden shadow-xs">
                  <div className="px-2.5 py-1.5 bg-slate-100 border-b border-slate-300 flex items-center justify-between text-[11px] font-mono">
                    <span className="font-bold text-slate-900">
                      PLAY-OFFS (#Semifinales & #Final_2) + FINAL COMPETENCIA (#Final)
                    </span>
                    <span className="text-slate-600 font-semibold tabular-nums">
                      MATCHES:{' '}
                      {dataset.playoffs.semifinales.length +
                        dataset.playoffs.finalPlayoff.length +
                        dataset.playoffs.finalCompetencia.length}
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-[11px] font-mono tabular-nums">
                      <thead>
                        <tr className="bg-slate-50 text-slate-700 border-b border-slate-300 font-semibold">
                          <th className="py-1.5 px-2">Instancia</th>
                          <th className="py-1.5 px-2">Dia</th>
                          <th className="py-1.5 px-2">Hora</th>
                          <th className="py-1.5 px-2 text-right">Local</th>
                          <th className="py-1.5 px-2 text-center">Goles_L</th>
                          <th className="py-1.5 px-2 text-center">Goles_V</th>
                          <th className="py-1.5 px-2 text-center">Raw</th>
                          <th className="py-1.5 px-2">Visitante</th>
                          <th className="py-1.5 px-2">Estadio</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {[
                          ...dataset.playoffs.semifinales,
                          ...dataset.playoffs.finalPlayoff,
                          ...dataset.playoffs.finalCompetencia,
                        ].map((p, idx) => (
                          <tr key={`po-${idx}`} className="hover:bg-slate-100/70">
                            <td className="py-1 px-2 text-sky-800 font-semibold whitespace-nowrap">
                              {p.instancia}
                            </td>
                            <td className="py-1 px-2 text-slate-800 whitespace-nowrap">
                              {p.dia}
                            </td>
                            <td className="py-1 px-2 text-slate-700 whitespace-nowrap">
                              {p.hora || '—'}
                            </td>
                            <td className="py-1 px-2 text-right font-sans font-semibold text-slate-950 whitespace-nowrap">
                              {p.local}
                            </td>
                            <td className="py-1 px-2 text-center font-bold text-emerald-800">
                              {p.golesL ?? '-'}
                            </td>
                            <td className="py-1 px-2 text-center font-bold text-emerald-800">
                              {p.golesV ?? '-'}
                            </td>
                            <td className="py-1 px-2 text-center text-slate-600">
                              {p.resultadoRaw}
                            </td>
                            <td className="py-1 px-2 font-sans font-semibold text-slate-950 whitespace-nowrap">
                              {p.visitante}
                            </td>
                            <td className="py-1 px-2 font-sans text-slate-700 whitespace-nowrap">
                              {p.estadio || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* 6. TEAMS & COACHES */}
            {activeTab === 'teams' && (
              <div className="border border-slate-300 rounded bg-white overflow-hidden shadow-xs">
                <div className="px-2.5 py-1.5 bg-slate-100 border-b border-slate-300 flex items-center justify-between text-[11px] font-mono">
                  <span className="font-bold text-slate-900">
                    TEAMS & COACHES (#Información_general ⋈ #Entrenadores)
                  </span>
                  <span className="text-slate-600 font-semibold tabular-nums">
                    CLUBS: {dataset.teamsAndCoaches.length}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-[11px] font-mono tabular-nums">
                    <thead>
                      <tr className="bg-slate-50 text-slate-700 border-b border-slate-300 font-semibold">
                        <th className="py-1.5 px-2">Equipo</th>
                        <th className="py-1.5 px-2">Ciudad</th>
                        <th className="py-1.5 px-2">Estadio</th>
                        <th className="py-1.5 px-2 text-right">Capacidad</th>
                        <th className="py-1.5 px-2">Fundación</th>
                        <th className="py-1.5 px-2 text-right">Temp.</th>
                        <th className="py-1.5 px-2 text-right">Consec.</th>
                        <th className="py-1.5 px-2 text-right">Títulos</th>
                        <th className="py-1.5 px-2">Indumentaria</th>
                        <th className="py-1.5 px-2">Jurídica</th>
                        <th className="py-1.5 px-2">2025</th>
                        <th className="py-1.5 px-2">DT Inicial</th>
                        <th className="py-1.5 px-2">DT Sustituto(s)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {dataset.teamsAndCoaches.map((t) => (
                        <tr key={t.equipo} className="hover:bg-slate-100/70">
                          <td className="py-1 px-2 font-sans font-bold text-slate-950 whitespace-nowrap">
                            {t.equipo}
                          </td>
                          <td className="py-1 px-2 font-sans text-slate-800 whitespace-nowrap">
                            {t.ciudad}
                          </td>
                          <td className="py-1 px-2 font-sans text-slate-800 whitespace-nowrap">
                            {t.estadio}
                          </td>
                          <td className="py-1 px-2 text-right text-slate-800">
                            {t.capacidad}
                          </td>
                          <td className="py-1 px-2 text-slate-700 whitespace-nowrap">
                            {t.fundacion}
                          </td>
                          <td className="py-1 px-2 text-right text-slate-800">
                            {t.temporadas}
                          </td>
                          <td className="py-1 px-2 text-right text-slate-800">
                            {t.tempConsecutivas}
                          </td>
                          <td className="py-1 px-2 text-right text-amber-800 font-bold">
                            {t.titulos}
                          </td>
                          <td className="py-1 px-2 font-sans text-slate-800 whitespace-nowrap">
                            {t.indumentaria}
                          </td>
                          <td className="py-1 px-2 text-sky-800 font-bold">
                            {t.formaJuridica}
                          </td>
                          <td className="py-1 px-2 text-slate-800 whitespace-nowrap">
                            {t.pos2025}
                          </td>
                          <td className="py-1 px-2 font-sans text-emerald-800 font-semibold whitespace-nowrap">
                            {t.dtInicial}
                          </td>
                          <td className="py-1 px-2 font-sans text-amber-900 font-medium whitespace-nowrap">
                            {t.dtSustitutos}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
