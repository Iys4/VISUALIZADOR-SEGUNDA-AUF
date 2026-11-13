import React from 'react';

interface DualRangeSliderProps {
  label: string;
  min: number;
  max: number;
  valueMin: number;
  valueMax: number;
  formatValue?: (val: number) => string;
  onChange: (newMin: number, newMax: number) => void;
}

export const DualRangeSlider: React.FC<DualRangeSliderProps> = ({
  label,
  min,
  max,
  valueMin,
  valueMax,
  formatValue = (v) => String(v),
  onChange,
}) => {
  const totalSpan = Math.max(1, max - min);
  const leftPct = ((valueMin - min) / totalSpan) * 100;
  const rightPct = ((valueMax - min) / totalSpan) * 100;
  const widthPct = Math.max(0, rightPct - leftPct);

  const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextMin = Math.min(Number(e.target.value), valueMax - 1);
    onChange(nextMin, valueMax);
  };

  const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextMax = Math.max(Number(e.target.value), valueMin + 1);
    onChange(valueMin, nextMax);
  };

  return (
    <div className="flex flex-col gap-1.5 min-w-[210px] flex-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-400 font-medium">{label}</span>
        <span className="font-mono font-semibold text-sky-400 tabular-nums">
          {formatValue(valueMin)} – {formatValue(valueMax)}
        </span>
      </div>

      <div className="relative h-6 flex items-center select-none">
        {/* Riel base */}
        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden" />

        {/* Área activa marcada entre las dos puntas */}
        <div
          className="absolute h-1.5 bg-sky-500/80 rounded-full pointer-events-none"
          style={{
            left: `${leftPct}%`,
            width: `${widthPct}%`,
          }}
        />

        {/* Punta izquierda (Mínimo) */}
        <input
          type="range"
          min={min}
          max={max}
          step={1}
          value={valueMin}
          onChange={handleMinChange}
          aria-label={`${label} mínimo`}
          className="dual-range-input absolute inset-0 w-full h-full appearance-none bg-transparent pointer-events-none"
          style={{ zIndex: valueMin > max - 3 ? 5 : 3 }}
        />

        {/* Punta derecha (Máximo) */}
        <input
          type="range"
          min={min}
          max={max}
          step={1}
          value={valueMax}
          onChange={handleMaxChange}
          aria-label={`${label} máximo`}
          className="dual-range-input absolute inset-0 w-full h-full appearance-none bg-transparent pointer-events-none"
          style={{ zIndex: 4 }}
        />
      </div>
    </div>
  );
};
