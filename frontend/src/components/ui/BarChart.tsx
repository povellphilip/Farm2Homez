import { useId, useState } from 'react';
import { cn } from '@/lib/cn';

export interface BarDatum {
  label: string;
  /** Short axis label; falls back to label. */
  tick?: string;
  value: number;
  /** Extra tooltip line, e.g. "3 orders". */
  detail?: string;
}

// Single-series magnitude colour: validated (chroma, lightness band, ≥3:1 on white) with the dataviz palette checker.
const BAR = '#2E7D4F';
const BAR_HOVER = '#226140';
const HEIGHT = 180;
const AXIS = 44; // left gutter for y labels
const BOTTOM = 24;

function niceMax(value: number) {
  if (value <= 0) return 1;
  const exponent = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * exponent >= value / 1) ?? 10;
  return step * exponent;
}

/**
 * Accessible single-series bar chart: rounded data-ends on a quiet baseline, a hover/focus
 * tooltip per bar with a full-column hit target, and a "view as table" alternative.
 */
export function BarChart({ data, format, title, className }: { data: BarDatum[]; format: (value: number) => string; title: string; className?: string }) {
  const [active, setActive] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);
  const titleId = useId();
  const max = niceMax(Math.max(...data.map((d) => d.value), 0));
  const width = 640;
  const plotWidth = width - AXIS;
  const slot = plotWidth / Math.max(data.length, 1);
  const barWidth = Math.max(2, slot - 2); // 2px surface gap between bars
  const tickEvery = Math.ceil(data.length / 6);
  const y = (value: number) => HEIGHT - (value / max) * HEIGHT;
  const current = active !== null ? data[active] : null;

  return (
    <figure className={cn('relative', className)} aria-labelledby={titleId}>
      <figcaption className="mb-3 flex items-center justify-between gap-3">
        <span id={titleId} className="text-sm font-semibold text-charcoal-900">
          {title}
        </span>
        <button type="button" onClick={() => setAsTable((value) => !value)} className="text-xs font-medium text-forest-700 hover:underline">
          {asTable ? 'View as chart' : 'View as table'}
        </button>
      </figcaption>
      {data.every((d) => d.value === 0) && !asTable ? (
        <div className="grid h-[204px] place-items-center rounded-xl bg-ivory-100 text-sm text-charcoal-500">No sales in this period yet.</div>
      ) : asTable ? (
        <div className="max-h-64 overflow-y-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-charcoal-500">
                <th className="py-1.5 font-medium">Date</th>
                <th className="py-1.5 text-right font-medium">Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-charcoal-800/[0.06]">
              {data.map((d) => (
                <tr key={d.label}>
                  <td className="py-1.5 text-charcoal-700">{d.label}</td>
                  <td className="py-1.5 text-right tabular-nums text-charcoal-900">
                    {format(d.value)}
                    {d.detail ? <span className="ml-2 text-charcoal-500">{d.detail}</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative">
          <svg viewBox={`0 0 ${width} ${HEIGHT + BOTTOM}`} className="h-auto w-full overflow-visible" role="img" aria-label={`${title}. Use “View as table” for the values.`}>
            {[0, 0.5, 1].map((fraction) => (
              <g key={fraction}>
                <line x1={AXIS} x2={width} y1={y(max * fraction)} y2={y(max * fraction)} stroke="#191D1A" strokeOpacity={fraction === 0 ? 0.25 : 0.07} />
                <text x={AXIS - 8} y={y(max * fraction) + 4} textAnchor="end" className="fill-charcoal-500 text-[11px]">
                  {format(max * fraction)}
                </text>
              </g>
            ))}
            {data.map((d, index) => {
              const x = AXIS + index * slot + 1;
              const top = y(d.value);
              const h = HEIGHT - top;
              const r = Math.min(4, barWidth / 2, h);
              return (
                <g key={d.label}>
                  {d.value > 0 ? (
                    <path
                      d={`M${x},${HEIGHT} V${top + r} Q${x},${top} ${x + r},${top} H${x + barWidth - r} Q${x + barWidth},${top} ${x + barWidth},${top + r} V${HEIGHT} Z`}
                      fill={active === index ? BAR_HOVER : BAR}
                    />
                  ) : null}
                  {index % tickEvery === 0 ? (
                    <text x={x + barWidth / 2} y={HEIGHT + 16} textAnchor="middle" className="fill-charcoal-500 text-[11px]">
                      {d.tick ?? d.label}
                    </text>
                  ) : null}
                  <rect
                    x={AXIS + index * slot}
                    y={0}
                    width={slot}
                    height={HEIGHT}
                    fill="transparent"
                    tabIndex={0}
                    aria-label={`${d.label}: ${format(d.value)}${d.detail ? `, ${d.detail}` : ''}`}
                    onMouseEnter={() => setActive(index)}
                    onMouseLeave={() => setActive(null)}
                    onFocus={() => setActive(index)}
                    onBlur={() => setActive(null)}
                    className="cursor-default outline-none"
                  />
                </g>
              );
            })}
          </svg>
          {current && active !== null ? (
            <div
              className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-lg bg-charcoal-900 px-3 py-2 text-xs text-ivory-50 shadow-lift"
              style={{ left: `${((AXIS + active * slot + slot / 2) / width) * 100}%`, top: `${(y(current.value) / (HEIGHT + BOTTOM)) * 100}%` }}
              role="status"
            >
              <p className="font-medium">{current.label}</p>
              <p className="tabular-nums">{format(current.value)}</p>
              {current.detail ? <p className="text-sage-300">{current.detail}</p> : null}
            </div>
          ) : null}
        </div>
      )}
    </figure>
  );
}
