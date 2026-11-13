import React, { useEffect, useMemo, useState } from 'react';

const API_BASE_URL = 'https://v3.football.api-sports.io';
const API_KEY = '1dccb853ca9f443b409ecaf911eae1f1';

type EndpointKey = 'standings' | 'fixtures' | 'rounds' | 'teams' | 'topscorers';

interface CachedPayload<T = any> {
  timestamp: string;
  savedAtIso: string;
  league: number;
  season: number;
  raw: T;
}

interface QuotaInfo {
  current: number | string;
  limitDay: number | string;
  remaining?: number | string;
  updatedAt: string;
}

const ENDPOINTS: {
  key: EndpointKey;
  label: string;
  tabLabel: string;
  buildPath: (league: number, season: number) => string;
}[] = [
  {
    key: 'standings',
    label: 'Fetch Standings',
    tabLabel: 'Standings',
    buildPath: (l, s) => `/standings?league=${l}&season=${s}`,
  },
  {
    key: 'fixtures',
    label: 'Fetch Fixtures',
    tabLabel: 'Fixtures',
    buildPath: (l, s) => `/fixtures?league=${l}&season=${s}`,
  },
  {
    key: 'rounds',
    label: 'Fetch Rounds',
    tabLabel: 'Rounds',
    buildPath: (l, s) => `/fixtures/rounds?league=${l}&season=${s}`,
  },
  {
    key: 'teams',
    label: 'Fetch Teams',
    tabLabel: 'Teams',
    buildPath: (l, s) => `/teams?league=${l}&season=${s}`,
  },
  {
    key: 'topscorers',
    label: 'Fetch Top Scorers',
    tabLabel: 'Top Scorers',
    buildPath: (l, s) => `/players/topscorers?league=${l}&season=${s}`,
  },
];

function getStorageKey(endpoint: EndpointKey, league: number, season: number): string {
  return `apifootball_v3_${endpoint}_${league}_${season}`;
}

const QUOTA_STORAGE_KEY = 'apifootball_v3_quota_state';

function formatTimeHMS(date: Date): string {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function formatFixtureDate(isoDate: string | null | undefined): string {
  if (!isoDate) return '-';
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return String(isoDate);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

export const ApiSandbox: React.FC = () => {
  const [league, setLeague] = useState<number>(269);
  const [season, setSeason] = useState<number>(2026);
  const [activeTab, setActiveTab] = useState<EndpointKey>('standings');
  const [viewMode, setViewMode] = useState<'table' | 'json'>('table');

  const [cacheMap, setCacheMap] = useState<Record<EndpointKey, CachedPayload | null>>({
    standings: null,
    fixtures: null,
    rounds: null,
    teams: null,
    topscorers: null,
  });

  const [quota, setQuota] = useState<QuotaInfo | null>(null);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedJson, setCopiedJson] = useState<boolean>(false);

  // Filtros de Tab 2 (Fixtures)
  const [selectedRound, setSelectedRound] = useState<string>('ALL');
  const [teamFilter, setTeamFilter] = useState<string>('');

  // Lectura exclusiva desde localStorage (0 llamadas a la API al montar o cambiar league/season)
  useEffect(() => {
    const loaded: Record<EndpointKey, CachedPayload | null> = {
      standings: null,
      fixtures: null,
      rounds: null,
      teams: null,
      topscorers: null,
    };

    ENDPOINTS.forEach(({ key }) => {
      try {
        const rawStr = localStorage.getItem(getStorageKey(key, league, season));
        if (rawStr) {
          loaded[key] = JSON.parse(rawStr);
        }
      } catch {
        loaded[key] = null;
      }
    });

    setCacheMap(loaded);

    try {
      const savedQuota = localStorage.getItem(QUOTA_STORAGE_KEY);
      if (savedQuota) {
        setQuota(JSON.parse(savedQuota));
      }
    } catch {
      // ignore
    }
  }, [league, season]);

  // Resetear filtro de round cuando cambian los fixtures en caché
  useEffect(() => {
    setSelectedRound('ALL');
  }, [league, season, cacheMap.fixtures]);

  const updateQuotaFromHeadersOrStatus = (headers: Headers, statusBody?: any) => {
    const limitHeader = headers.get('x-ratelimit-requests-limit');
    const remainingHeader = headers.get('x-ratelimit-requests-remaining');

    let nextQuota: QuotaInfo | null = null;

    if (statusBody?.response?.requests) {
      const current = statusBody.response.requests.current ?? '-';
      const limitDay = statusBody.response.requests.limit_day ?? 100;
      nextQuota = {
        current,
        limitDay,
        remaining:
          typeof current === 'number' && typeof limitDay === 'number'
            ? limitDay - current
            : undefined,
        updatedAt: formatTimeHMS(new Date()),
      };
    } else if (limitHeader !== null || remainingHeader !== null) {
      const limitNum = Number(limitHeader);
      const remNum = Number(remainingHeader);
      const currentCalc =
        !Number.isNaN(limitNum) && !Number.isNaN(remNum) ? limitNum - remNum : '-';
      nextQuota = {
        current: currentCalc,
        limitDay: limitHeader ?? 100,
        remaining: remainingHeader ?? '-',
        updatedAt: formatTimeHMS(new Date()),
      };
    }

    if (nextQuota) {
      setQuota(nextQuota);
      try {
        localStorage.setItem(QUOTA_STORAGE_KEY, JSON.stringify(nextQuota));
      } catch {
        // ignore
      }
    }
  };

  // Ejecución manual de fetch para un endpoint específico
  const handleManualFetch = async (endpointKey: EndpointKey) => {
    const epConfig = ENDPOINTS.find((e) => e.key === endpointKey);
    if (!epConfig) return;

    setLoadingKey(endpointKey);
    setErrorMsg(null);

    const url = `${API_BASE_URL}${epConfig.buildPath(league, season)}`;

    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'x-apisports-key': API_KEY,
        },
      });

      const data = await res.json();
      updateQuotaFromHeadersOrStatus(res.headers);

      const now = new Date();
      const payload: CachedPayload = {
        timestamp: formatTimeHMS(now),
        savedAtIso: now.toISOString(),
        league,
        season,
        raw: data,
      };

      localStorage.setItem(getStorageKey(endpointKey, league, season), JSON.stringify(payload));
      setCacheMap((prev) => ({
        ...prev,
        [endpointKey]: payload,
      }));
      setActiveTab(endpointKey);

      if (data?.errors && Object.keys(data.errors).length > 0) {
        setErrorMsg(JSON.stringify(data.errors));
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'NETWORK_ERROR');
    } finally {
      setLoadingKey(null);
    }
  };

  // Consulta manual a /status (0 costo de cuota según documentación oficial)
  const handleFetchStatus = async () => {
    setLoadingKey('status');
    setErrorMsg(null);
    try {
      const res = await fetch(`${API_BASE_URL}/status`, {
        method: 'GET',
        headers: {
          'x-apisports-key': API_KEY,
        },
      });
      const data = await res.json();
      updateQuotaFromHeadersOrStatus(res.headers, data);
      if (data?.errors && Object.keys(data.errors).length > 0) {
        setErrorMsg(JSON.stringify(data.errors));
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'STATUS_ERROR');
    } finally {
      setLoadingKey(null);
    }
  };

  const handleClearLocalStorage = () => {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('apifootball_v3_')) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
    setCacheMap({
      standings: null,
      fixtures: null,
      rounds: null,
      teams: null,
      topscorers: null,
    });
    setQuota(null);
    setErrorMsg(null);
  };

  const currentPayload = cacheMap[activeTab];
  const currentRaw = currentPayload?.raw ?? null;

  const handleCopyJson = () => {
    if (!currentRaw) return;
    navigator.clipboard.writeText(JSON.stringify(currentRaw, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 1500);
  };

  // Datos procesados para cada Tab
  const standingsGroups: any[][] = useMemo(() => {
    const resp = cacheMap.standings?.raw?.response;
    if (!Array.isArray(resp) || resp.length === 0) return [];
    const tables = resp[0]?.league?.standings;
    return Array.isArray(tables) ? tables : [];
  }, [cacheMap.standings]);

  const fixturesList: any[] = useMemo(() => {
    const resp = cacheMap.fixtures?.raw?.response;
    return Array.isArray(resp) ? resp : [];
  }, [cacheMap.fixtures]);

  const uniqueFixtureRounds: string[] = useMemo(() => {
    const set = new Set<string>();
    fixturesList.forEach((item) => {
      if (item?.league?.round) {
        set.add(String(item.league.round));
      }
    });
    return Array.from(set);
  }, [fixturesList]);

  const filteredFixtures = useMemo(() => {
    return fixturesList.filter((item) => {
      if (selectedRound !== 'ALL' && item?.league?.round !== selectedRound) {
        return false;
      }
      if (teamFilter.trim() !== '') {
        const q = teamFilter.trim().toLowerCase();
        const home = String(item?.teams?.home?.name ?? '').toLowerCase();
        const away = String(item?.teams?.away?.name ?? '').toLowerCase();
        if (!home.includes(q) && !away.includes(q)) return false;
      }
      return true;
    });
  }, [fixturesList, selectedRound, teamFilter]);

  const roundsList: any[] = useMemo(() => {
    const resp = cacheMap.rounds?.raw?.response;
    return Array.isArray(resp) ? resp : [];
  }, [cacheMap.rounds]);

  const teamsList: any[] = useMemo(() => {
    const resp = cacheMap.teams?.raw?.response;
    return Array.isArray(resp) ? resp : [];
  }, [cacheMap.teams]);

  const topScorersList: any[] = useMemo(() => {
    const resp = cacheMap.topscorers?.raw?.response;
    return Array.isArray(resp) ? resp : [];
  }, [cacheMap.topscorers]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans text-xs p-3 space-y-2">
      {/* 1. BARRA SUPERIOR DE CONTROL Y CUOTA (1 línea compacta) */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-2 bg-slate-900 border border-slate-800 rounded">
        {/* Parámetros Base: League (269 / 8146 / numérico) & Season */}
        <div className="flex items-center gap-2 font-mono">
          <span className="text-slate-400">league:</span>
          <div className="flex items-center border border-slate-700 rounded overflow-hidden">
            <button
              type="button"
              onClick={() => setLeague(269)}
              className={`px-2 py-0.5 text-[11px] font-mono ${
                league === 269 ? 'bg-sky-500 text-slate-950 font-bold' : 'bg-slate-950 text-slate-400'
              }`}
            >
              269
            </button>
            <button
              type="button"
              onClick={() => setLeague(8146)}
              className={`px-2 py-0.5 text-[11px] font-mono border-l border-slate-700 ${
                league === 8146 ? 'bg-sky-500 text-slate-950 font-bold' : 'bg-slate-950 text-slate-400'
              }`}
            >
              8146
            </button>
          </div>
          <input
            type="number"
            value={league}
            onChange={(e) => setLeague(Number(e.target.value) || 0)}
            className="w-16 px-1.5 py-0.5 bg-slate-950 border border-slate-700 rounded text-[11px] font-mono tabular-nums text-slate-100"
            aria-label="league id"
          />

          <span className="text-slate-400 ml-1">season:</span>
          <input
            type="number"
            value={season}
            onChange={(e) => setSeason(Number(e.target.value) || 2026)}
            className="w-16 px-1.5 py-0.5 bg-slate-950 border border-slate-700 rounded text-[11px] font-mono tabular-nums text-slate-100"
            aria-label="season"
          />

          <div className="h-4 w-px bg-slate-800 mx-1" />

          {/* Estado de Cuota API */}
          <span className="text-slate-400">Quota:</span>
          <span className="font-mono font-bold tabular-nums text-emerald-400">
            {quota ? `${quota.current} / ${quota.limitDay}` : '- / 100'}
          </span>
          {quota?.remaining !== undefined && (
            <span className="text-slate-500 font-mono tabular-nums">
              (Rem: {quota.remaining})
            </span>
          )}
          <button
            type="button"
            onClick={handleFetchStatus}
            disabled={loadingKey !== null}
            className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 border border-slate-700 rounded text-[11px] font-mono"
          >
            {loadingKey === 'status' ? '...' : 'Check /status'}
          </button>
        </div>

        {/* Botones de Descarga Manual Independientes + Cache Timestamp */}
        <div className="flex flex-wrap items-center gap-1.5">
          {ENDPOINTS.map((ep) => {
            const cached = cacheMap[ep.key];
            const isLoading = loadingKey === ep.key;
            return (
              <div
                key={ep.key}
                className="flex items-center gap-1 bg-slate-950 border border-slate-800 px-1.5 py-0.5 rounded"
              >
                <button
                  type="button"
                  onClick={() => handleManualFetch(ep.key)}
                  disabled={loadingKey !== null}
                  className="px-2 py-0.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white font-mono text-[11px] font-semibold rounded whitespace-nowrap"
                >
                  {isLoading ? 'Fetching...' : `[${ep.label}]`}
                </button>
                <span className="font-mono text-[10px] text-slate-400 tabular-nums whitespace-nowrap">
                  Cache: {cached ? cached.timestamp : 'Empty'}
                </span>
              </div>
            );
          })}

          <button
            type="button"
            onClick={handleClearLocalStorage}
            className="px-2 py-1 bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800/80 rounded font-mono text-[11px] whitespace-nowrap"
          >
            [Clear LocalStorage]
          </button>
        </div>
      </div>

      {/* Alerta técnica en caso de error de API */}
      {errorMsg && (
        <div className="px-2.5 py-1.5 bg-rose-950/70 border border-rose-800 text-rose-200 font-mono text-[11px] rounded">
          API_ERROR: {errorMsg}
        </div>
      )}

      {/* 2. BARRA DE NAVEGACIÓN POR PESTAÑAS + TOGGLE [Tabla | Raw JSON] */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-1.5">
        <div className="flex items-center gap-1">
          {ENDPOINTS.map((ep) => {
            const isActive = activeTab === ep.key;
            const resultsCount = cacheMap[ep.key]?.raw?.results;
            return (
              <button
                key={`tab-${ep.key}`}
                type="button"
                onClick={() => setActiveTab(ep.key)}
                className={`px-3 py-1 font-mono text-xs rounded border transition-colors ${
                  isActive
                    ? 'bg-slate-800 text-sky-400 border-sky-500/60 font-semibold'
                    : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                {ep.tabLabel}
                {resultsCount !== undefined ? ` (${resultsCount})` : ''}
              </button>
            );
          })}
        </div>

        {/* Esquina superior derecha: Toggle [Tabla | Raw JSON] + [Copy JSON] */}
        <div className="flex items-center gap-2 font-mono">
          {currentRaw && (
            <span className="text-[11px] text-slate-500 tabular-nums">
              GET {ENDPOINTS.find((e) => e.key === activeTab)?.buildPath(league, season)} · results:{' '}
              {currentRaw.results ?? 0}
            </span>
          )}

          {viewMode === 'json' && currentRaw && (
            <button
              type="button"
              onClick={handleCopyJson}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 rounded text-[11px] font-mono"
            >
              {copiedJson ? '[Copied]' : '[Copy JSON]'}
            </button>
          )}

          <div className="flex items-center border border-slate-700 rounded overflow-hidden">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`px-2.5 py-1 text-[11px] font-mono ${
                viewMode === 'table'
                  ? 'bg-sky-500 text-slate-950 font-bold'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
            >
              Tabla
            </button>
            <button
              type="button"
              onClick={() => setViewMode('json')}
              className={`px-2.5 py-1 text-[11px] font-mono border-l border-slate-700 ${
                viewMode === 'json'
                  ? 'bg-sky-500 text-slate-950 font-bold'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
            >
              Raw JSON
            </button>
          </div>
        </div>
      </div>

      {/* 3. CONTENIDO DE LA PESTAÑA ACTIVA */}
      {!currentPayload ? (
        <div className="p-4 border border-slate-800 bg-slate-900/40 rounded font-mono text-xs text-slate-500">
          NO_CACHED_DATA ({activeTab} | league={league} | season={season})
        </div>
      ) : viewMode === 'json' ? (
        /* VISOR DE JSON CRUDO */
        <pre className="p-3 bg-slate-950 border border-slate-800 rounded font-mono text-[11px] text-slate-200 overflow-auto max-h-[calc(100vh-130px)] leading-snug tabular-nums">
          {JSON.stringify(currentRaw, null, 2)}
        </pre>
      ) : (
        /* MODO TABLA POR PESTAÑA */
        <div className="space-y-4">
          {/* TAB 1: STANDINGS */}
          {activeTab === 'standings' && (
            <div className="space-y-4">
              {standingsGroups.length === 0 ? (
                <div className="p-3 border border-slate-800 bg-slate-900/40 font-mono text-slate-500">
                  response[0].league.standings: []
                </div>
              ) : (
                standingsGroups.map((tableRows, idx) => {
                  const groupLabel =
                    tableRows[0]?.group ||
                    tableRows[0]?.description ||
                    `standings[${idx}]`;
                  return (
                    <div
                      key={`st-group-${idx}`}
                      className="border border-slate-800 bg-slate-900/50 rounded overflow-x-auto"
                    >
                      <div className="px-2.5 py-1.5 bg-slate-900 border-b border-slate-800 font-mono text-xs font-semibold text-sky-400">
                        {groupLabel}
                      </div>
                      <table className="w-full border-collapse text-left font-mono text-[11px] tabular-nums">
                        <thead>
                          <tr className="border-b border-slate-800 bg-slate-950/70 text-slate-400">
                            <th className="py-1.5 px-2 border-r border-slate-800">rank</th>
                            <th className="py-1.5 px-2 border-r border-slate-800">team.id</th>
                            <th className="py-1.5 px-2 border-r border-slate-800 font-sans">team.name</th>
                            <th className="py-1.5 px-2 border-r border-slate-800 text-right">points</th>
                            <th className="py-1.5 px-2 border-r border-slate-800 text-right">all.played</th>
                            <th className="py-1.5 px-2 border-r border-slate-800 text-right">all.win</th>
                            <th className="py-1.5 px-2 border-r border-slate-800 text-right">all.draw</th>
                            <th className="py-1.5 px-2 border-r border-slate-800 text-right">all.lose</th>
                            <th className="py-1.5 px-2 border-r border-slate-800 text-right">all.goals.for</th>
                            <th className="py-1.5 px-2 border-r border-slate-800 text-right">all.goals.against</th>
                            <th className="py-1.5 px-2 border-r border-slate-800 text-right">goalsDiff</th>
                            <th className="py-1.5 px-2 border-r border-slate-800">form</th>
                            <th className="py-1.5 px-2 border-r border-slate-800">status</th>
                            <th className="py-1.5 px-2">description</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/70">
                          {tableRows.map((row: any, rIdx: number) => (
                            <tr key={`row-${idx}-${rIdx}`} className="hover:bg-slate-800/50">
                              <td className="py-1 px-2 border-r border-slate-800 font-bold text-slate-100">
                                {row.rank ?? '-'}
                              </td>
                              <td className="py-1 px-2 border-r border-slate-800 text-slate-400">
                                {row.team?.id ?? '-'}
                              </td>
                              <td className="py-1 px-2 border-r border-slate-800 font-sans font-medium text-slate-100 whitespace-nowrap">
                                <div className="flex items-center gap-1.5">
                                  {row.team?.logo && (
                                    <img
                                      src={row.team.logo}
                                      alt=""
                                      width={16}
                                      height={16}
                                      referrerPolicy="no-referrer"
                                      className="w-4 h-4 object-contain shrink-0"
                                    />
                                  )}
                                  <span>{row.team?.name ?? '-'}</span>
                                </div>
                              </td>
                              <td className="py-1 px-2 border-r border-slate-800 text-right font-bold text-sky-300">
                                {row.points ?? '-'}
                              </td>
                              <td className="py-1 px-2 border-r border-slate-800 text-right">
                                {row.all?.played ?? '-'}
                              </td>
                              <td className="py-1 px-2 border-r border-slate-800 text-right">
                                {row.all?.win ?? '-'}
                              </td>
                              <td className="py-1 px-2 border-r border-slate-800 text-right">
                                {row.all?.draw ?? '-'}
                              </td>
                              <td className="py-1 px-2 border-r border-slate-800 text-right">
                                {row.all?.lose ?? '-'}
                              </td>
                              <td className="py-1 px-2 border-r border-slate-800 text-right">
                                {row.all?.goals?.for ?? '-'}
                              </td>
                              <td className="py-1 px-2 border-r border-slate-800 text-right">
                                {row.all?.goals?.against ?? '-'}
                              </td>
                              <td className="py-1 px-2 border-r border-slate-800 text-right">
                                {row.goalsDiff ?? '-'}
                              </td>
                              <td className="py-1 px-2 border-r border-slate-800">
                                {row.form ?? '-'}
                              </td>
                              <td className="py-1 px-2 border-r border-slate-800 text-slate-400">
                                {row.status ?? '-'}
                              </td>
                              <td className="py-1 px-2 text-slate-400 whitespace-nowrap">
                                {row.description ?? '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 2: FIXTURES / PARTIDOS */}
          {activeTab === 'fixtures' && (
            <div className="space-y-2">
              {/* Filtros rápidos por league.round y team.name */}
              <div className="flex flex-wrap items-center gap-3 px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded font-mono text-[11px]">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400">league.round:</span>
                  <select
                    value={selectedRound}
                    onChange={(e) => setSelectedRound(e.target.value)}
                    className="bg-slate-950 border border-slate-700 rounded px-2 py-0.5 text-slate-100 font-mono"
                  >
                    <option value="ALL">ALL ({fixturesList.length})</option>
                    {uniqueFixtureRounds.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400">team.name:</span>
                  <input
                    type="text"
                    value={teamFilter}
                    onChange={(e) => setTeamFilter(e.target.value)}
                    placeholder="filter..."
                    className="bg-slate-950 border border-slate-700 rounded px-2 py-0.5 text-slate-100 font-mono w-44"
                  />
                </div>

                <span className="text-slate-500 ml-auto tabular-nums">
                  rows: {filteredFixtures.length} / {fixturesList.length}
                </span>
              </div>

              <div className="border border-slate-800 bg-slate-900/50 rounded overflow-x-auto">
                <table className="w-full border-collapse text-left font-mono text-[11px] tabular-nums">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/70 text-slate-400">
                      <th className="py-1.5 px-2 border-r border-slate-800">fixture.id</th>
                      <th className="py-1.5 px-2 border-r border-slate-800">fixture.date</th>
                      <th className="py-1.5 px-2 border-r border-slate-800">fixture.status.short</th>
                      <th className="py-1.5 px-2 border-r border-slate-800">league.round</th>
                      <th className="py-1.5 px-2 border-r border-slate-800 text-right">teams.home.id</th>
                      <th className="py-1.5 px-2 border-r border-slate-800 font-sans">teams.home.name</th>
                      <th className="py-1.5 px-2 border-r border-slate-800 text-center">goals.home</th>
                      <th className="py-1.5 px-2 border-r border-slate-800 text-center">goals.away</th>
                      <th className="py-1.5 px-2 border-r border-slate-800 font-sans">teams.away.name</th>
                      <th className="py-1.5 px-2 border-r border-slate-800 text-right">teams.away.id</th>
                      <th className="py-1.5 px-2 font-sans">fixture.venue.name</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {filteredFixtures.map((item: any, idx: number) => (
                      <tr key={item?.fixture?.id ?? idx} className="hover:bg-slate-800/50">
                        <td className="py-1 px-2 border-r border-slate-800 text-slate-400">
                          {item.fixture?.id ?? '-'}
                        </td>
                        <td className="py-1 px-2 border-r border-slate-800 whitespace-nowrap">
                          {formatFixtureDate(item.fixture?.date)}
                        </td>
                        <td className="py-1 px-2 border-r border-slate-800">
                          {item.fixture?.status?.short ?? '-'}
                        </td>
                        <td className="py-1 px-2 border-r border-slate-800 whitespace-nowrap text-sky-300">
                          {item.league?.round ?? '-'}
                        </td>
                        <td className="py-1 px-2 border-r border-slate-800 text-right text-slate-400">
                          {item.teams?.home?.id ?? '-'}
                        </td>
                        <td className="py-1 px-2 border-r border-slate-800 font-sans font-medium text-slate-100 whitespace-nowrap">
                          {item.teams?.home?.name ?? '-'}
                        </td>
                        <td className="py-1 px-2 border-r border-slate-800 text-center font-bold text-slate-100">
                          {item.goals?.home ?? '-'}
                        </td>
                        <td className="py-1 px-2 border-r border-slate-800 text-center font-bold text-slate-100">
                          {item.goals?.away ?? '-'}
                        </td>
                        <td className="py-1 px-2 border-r border-slate-800 font-sans font-medium text-slate-100 whitespace-nowrap">
                          {item.teams?.away?.name ?? '-'}
                        </td>
                        <td className="py-1 px-2 border-r border-slate-800 text-right text-slate-400">
                          {item.teams?.away?.id ?? '-'}
                        </td>
                        <td className="py-1 px-2 font-sans text-slate-400 whitespace-nowrap">
                          {item.fixture?.venue?.name ?? '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: ROUNDS / FECHAS */}
          {activeTab === 'rounds' && (
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-1.5 font-mono text-[11px] tabular-nums">
              {roundsList.length === 0 ? (
                <div className="col-span-full p-3 border border-slate-800 bg-slate-900/40 text-slate-500">
                  response: []
                </div>
              ) : (
                roundsList.map((rItem, idx) => {
                  const roundStr =
                    typeof rItem === 'string'
                      ? rItem
                      : rItem?.round ?? JSON.stringify(rItem);
                  return (
                    <div
                      key={`round-${idx}`}
                      className="flex items-center gap-2 px-2.5 py-1.5 bg-slate-900/70 border border-slate-800 rounded"
                    >
                      <span className="text-slate-500">[{idx}]</span>
                      <span className="text-slate-100 truncate">{roundStr}</span>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 4: TEAMS */}
          {activeTab === 'teams' && (
            <div className="border border-slate-800 bg-slate-900/50 rounded overflow-x-auto">
              <table className="w-full border-collapse text-left font-mono text-[11px] tabular-nums">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/70 text-slate-400">
                    <th className="py-1.5 px-2 border-r border-slate-800">team.id</th>
                    <th className="py-1.5 px-2 border-r border-slate-800">team.logo</th>
                    <th className="py-1.5 px-2 border-r border-slate-800 font-sans">team.name</th>
                    <th className="py-1.5 px-2 border-r border-slate-800">team.code</th>
                    <th className="py-1.5 px-2 border-r border-slate-800 text-right">team.founded</th>
                    <th className="py-1.5 px-2 border-r border-slate-800 text-right">venue.id</th>
                    <th className="py-1.5 px-2 border-r border-slate-800 font-sans">venue.name</th>
                    <th className="py-1.5 px-2 border-r border-slate-800 font-sans">venue.city</th>
                    <th className="py-1.5 px-2 text-right">venue.capacity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {teamsList.map((item: any, idx: number) => (
                    <tr key={item?.team?.id ?? idx} className="hover:bg-slate-800/50">
                      <td className="py-1 px-2 border-r border-slate-800 text-slate-400">
                        {item.team?.id ?? '-'}
                      </td>
                      <td className="py-1 px-2 border-r border-slate-800">
                        {item.team?.logo ? (
                          <img
                            src={item.team.logo}
                            alt=""
                            width={20}
                            height={20}
                            referrerPolicy="no-referrer"
                            className="w-5 h-5 object-contain"
                          />
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="py-1 px-2 border-r border-slate-800 font-sans font-medium text-slate-100">
                        {item.team?.name ?? '-'}
                      </td>
                      <td className="py-1 px-2 border-r border-slate-800">
                        {item.team?.code ?? '-'}
                      </td>
                      <td className="py-1 px-2 border-r border-slate-800 text-right">
                        {item.team?.founded ?? '-'}
                      </td>
                      <td className="py-1 px-2 border-r border-slate-800 text-right text-slate-400">
                        {item.venue?.id ?? '-'}
                      </td>
                      <td className="py-1 px-2 border-r border-slate-800 font-sans text-slate-300">
                        {item.venue?.name ?? '-'}
                      </td>
                      <td className="py-1 px-2 border-r border-slate-800 font-sans text-slate-400">
                        {item.venue?.city ?? '-'}
                      </td>
                      <td className="py-1 px-2 text-right">
                        {item.venue?.capacity ?? '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 5: TOP SCORERS */}
          {activeTab === 'topscorers' && (
            <div className="border border-slate-800 bg-slate-900/50 rounded overflow-x-auto">
              <table className="w-full border-collapse text-left font-mono text-[11px] tabular-nums">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/70 text-slate-400">
                    <th className="py-1.5 px-2 border-r border-slate-800">player.id</th>
                    <th className="py-1.5 px-2 border-r border-slate-800 font-sans">player.name</th>
                    <th className="py-1.5 px-2 border-r border-slate-800 font-sans">statistics[0].team.name</th>
                    <th className="py-1.5 px-2 border-r border-slate-800 text-right">statistics[0].games.appearences</th>
                    <th className="py-1.5 px-2 border-r border-slate-800 text-right">statistics[0].games.minutes</th>
                    <th className="py-1.5 px-2 border-r border-slate-800 text-right">statistics[0].goals.total</th>
                    <th className="py-1.5 px-2 text-right">statistics[0].goals.penalties</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {topScorersList.map((item: any, idx: number) => {
                    const stat = item?.statistics?.[0];
                    return (
                      <tr key={item?.player?.id ?? idx} className="hover:bg-slate-800/50">
                        <td className="py-1 px-2 border-r border-slate-800 text-slate-400">
                          {item.player?.id ?? '-'}
                        </td>
                        <td className="py-1 px-2 border-r border-slate-800 font-sans font-medium text-slate-100">
                          {item.player?.name ?? '-'}
                        </td>
                        <td className="py-1 px-2 border-r border-slate-800 font-sans text-slate-300">
                          {stat?.team?.name ?? '-'}
                        </td>
                        <td className="py-1 px-2 border-r border-slate-800 text-right">
                          {stat?.games?.appearences ?? '-'}
                        </td>
                        <td className="py-1 px-2 border-r border-slate-800 text-right">
                          {stat?.games?.minutes ?? '-'}
                        </td>
                        <td className="py-1 px-2 border-r border-slate-800 text-right font-bold text-sky-300">
                          {stat?.goals?.total ?? '-'}
                        </td>
                        <td className="py-1 px-2 text-right">
                          {stat?.goals?.penalties ?? '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
