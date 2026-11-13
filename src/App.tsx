import React from 'react';
import { BumpChart } from './components/BumpChart';

export default function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 sm:flex sm:items-center sm:justify-center p-0 sm:p-6">
      <main className="w-full max-w-[1440px] mx-auto">
        <BumpChart />
      </main>
    </div>
  );
}
