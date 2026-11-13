import React, { useState } from 'react';
import { BumpChart } from './components/BumpChart';
import { HitosScrollytelling } from './components/HitosScrollytelling';

export default function App() {
  const [activeView, setActiveView] = useState<'hitos' | 'visualizer'>('hitos');

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col">
      {/* Minimal View Switcher */}
      <nav className="w-full bg-slate-50 border-b border-slate-300 px-3 sm:px-6 py-1.5 flex items-center justify-between">
        <div className="flex flex-wrap items-center gap-1 bg-white p-0.5 rounded border border-slate-300">
          <button
            type="button"
            onClick={() => setActiveView('hitos')}
            className={`px-2.5 py-1 rounded text-[11px] font-mono font-semibold transition-colors cursor-pointer ${
              activeView === 'hitos'
                ? 'bg-slate-900 text-white border border-slate-950'
                : 'text-slate-700 hover:text-slate-950 border border-transparent'
            }`}
          >
            HITOS 2026
          </button>
          <button
            type="button"
            onClick={() => setActiveView('visualizer')}
            className={`px-2.5 py-1 rounded text-[11px] font-mono font-semibold transition-colors cursor-pointer ${
              activeView === 'visualizer'
                ? 'bg-sky-700 text-white border border-sky-800'
                : 'text-slate-700 hover:text-slate-950 border border-transparent'
            }`}
          >
            VISUALIZADOR 2026
          </button>
        </div>
        <span className="text-[10px] font-mono font-semibold text-slate-600 tabular-nums">
          URU · SEGUNDA DIVISIÓN · 2026
        </span>
      </nav>

      {activeView === 'hitos' ? (
        <main className="flex-1 w-full bg-white">
          <HitosScrollytelling />
        </main>
      ) : (
        <div className="flex-1 sm:flex sm:items-center sm:justify-center p-0 sm:p-6 bg-white">
          <main className="w-full max-w-[1440px] mx-auto">
            <BumpChart />
          </main>
        </div>
      )}
    </div>
  );
}



