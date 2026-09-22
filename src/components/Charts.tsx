import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList,
} from 'recharts'
import { useApp } from '@/lib/app-context'

/* ─────────────────────────────────────────────────────────────────────────────
   Chart palette.

   Every chart on this dashboard plots ONE series, so identity is carried by the
   axis label and colour carries nothing — which is the right answer for readers
   in their seventies and eighties. A multi-hue status palette was tried first
   and rejected: amber against red measured ΔE 14.2 under normal vision and 4.9
   under protanopia, i.e. two bars a good number of board members could not tell
   apart. Status colour still exists in this system, but only as a chip sitting
   beside its own text label, never as the thing that distinguishes two shapes.

   Ramp validated against a #FFFFFF surface: monotone lightness, ≥0.06 ΔL between
   adjacent steps, light end 2.99:1 against the surface.
   ──────────────────────────────────────────────────────────────────────────── */
export const SERIES = '#1C5CAB'
export const ORDINAL_RAMP = ['#5598E7', '#2A78D6', '#1C5CAB', '#0D366B']

const GRID = '#E4EAF0'
const AXIS = '#93A5B5'
const INK  = '#3A4C5E'

export interface Datum { label: string; value: number; hint?: string }

function ChartTooltip({ active, payload, formatter }: any) {
  if (!active || !payload?.length) return null
  const p = payload[0]
  return (
    <div className="bg-surface border-2 border-line-strong rounded px-4 py-3 shadow-lift text-base">
      <div className="font-semibold text-ink">{p.payload.label}</div>
      <div className="tabular-nums text-ink-soft mt-0.5">
        {formatter ? formatter(p.value) : p.value}
      </div>
    </div>
  )
}

/** Screen-reader table. A chart that only exists as pixels is unreadable to
 *  anyone on assistive tech, and unusable when printed in monochrome. */
function DataTable({ title, data, format }: { title: string; data: Datum[]; format?: (n: number) => string }) {
  return (
    <table className="sr-only">
      <caption>{title}</caption>
      <tbody>
        {data.map((d) => (
          <tr key={d.label}><th scope="row">{d.label}</th><td>{format ? format(d.value) : d.value}</td></tr>
        ))}
      </tbody>
    </table>
  )
}

export function HorizontalBars({
  title, data, format, height,
}: { title: string; data: Datum[]; format?: (n: number) => string; height?: number }) {
  const { scaleValue } = useApp()
  const tick = Math.round(14 * scaleValue)
  const h = height ?? Math.max(180, data.length * Math.round(42 * scaleValue) + 24)

  // The right margin has to clear the widest end-of-bar label. Currency strings
  // like "HK$144,850" are long enough that a fixed margin clips them, and a
  // clipped figure on a finance chart is worse than no figure.
  const widestLabel = Math.max(...data.map((d) => (format ? format(d.value) : String(d.value)).length), 3)
  const rightPad = Math.ceil(widestLabel * 8.4 * scaleValue) + 14
  // Category labels wrap in Chinese; give them room rather than truncating.
  const axisWidth = Math.min(
    Math.round(260 * scaleValue),
    Math.max(Math.round(110 * scaleValue), Math.round(Math.max(...data.map((d) => d.label.length)) * 11 * scaleValue) + 16),
  )

  return (
    <figure className="m-0">
      <ResponsiveContainer width="100%" height={h}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: rightPad, bottom: 4, left: 4 }} barCategoryGap="22%">
          <CartesianGrid horizontal={false} stroke={GRID} />
          <XAxis type="number" hide />
          <YAxis
            type="category" dataKey="label" width={axisWidth}
            tickLine={false} axisLine={{ stroke: AXIS }}
            tick={{ fill: INK, fontSize: tick }}
          />
          <Tooltip cursor={{ fill: '#E7EEF5' }} content={<ChartTooltip formatter={format} />} />
          <Bar dataKey="value" fill={SERIES} radius={[0, 4, 4, 0]} isAnimationActive={false}>
            <LabelList
              dataKey="value" position="right"
              formatter={(v: number) => (format ? format(v) : String(v))}
              style={{ fill: INK, fontSize: tick, fontWeight: 600 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <DataTable title={title} data={data} format={format} />
    </figure>
  )
}

export function VerticalBars({
  title, data, format, ordinal = false, height = 260,
}: { title: string; data: Datum[]; format?: (n: number) => string; ordinal?: boolean; height?: number }) {
  const { scaleValue } = useApp()
  const tick = Math.round(14 * scaleValue)

  return (
    <figure className="m-0">
      <ResponsiveContainer width="100%" height={Math.round(height * Math.min(scaleValue, 1.2))}>
        <BarChart data={data} margin={{ top: 26, right: 8, bottom: 4, left: 4 }} barCategoryGap="24%">
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis
            dataKey="label" tickLine={false} axisLine={{ stroke: AXIS }}
            tick={{ fill: INK, fontSize: tick }} interval={0}
          />
          <YAxis hide />
          <Tooltip cursor={{ fill: '#E7EEF5' }} content={<ChartTooltip formatter={format} />} />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} isAnimationActive={false}>
            {data.map((_, i) => (
              <Cell key={i} fill={ordinal ? ORDINAL_RAMP[Math.min(i, ORDINAL_RAMP.length - 1)] : SERIES} />
            ))}
            <LabelList
              dataKey="value" position="top"
              formatter={(v: number) => (format ? format(v) : String(v))}
              style={{ fill: INK, fontSize: tick, fontWeight: 600 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <DataTable title={title} data={data} format={format} />
    </figure>
  )
}

/** Small inline trend line for a single lab analyte over time. */
export function Sparkline({ values, width = 120, height = 32 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) return null
  const min = Math.min(...values), max = Math.max(...values)
  const span = max - min || 1
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * (width - 4) + 2
    const y = height - 2 - ((v - min) / span) * (height - 6)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden className="overflow-visible">
      <polyline points={pts} fill="none" stroke={SERIES} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle
        cx={(width - 4) + 2} cy={height - 2 - ((values[values.length - 1] - min) / span) * (height - 6)}
        r="3.5" fill={SERIES}
      />
    </svg>
  )
}
