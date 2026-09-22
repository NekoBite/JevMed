import type { ReactNode } from 'react'

export type Tone = 'neutral' | 'ok' | 'warn' | 'danger' | 'info'

const TONE_CHIP: Record<Tone, string> = {
  neutral: 'bg-canvas text-ink-soft border-line-strong',
  ok:      'bg-ok-light text-ok border-ok/40',
  warn:    'bg-warn-light text-warn border-warn/40',
  danger:  'bg-danger-light text-danger border-danger/40',
  info:    'bg-primary-light text-primary border-primary/30',
}

export function Chip({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`jm-chip ${TONE_CHIP[tone]}`}>{children}</span>
}

/** A dot carries the status for anyone who cannot separate the hues. Colour is
 *  never the only signal — the label beside it always says the same thing. */
export function StatusDot({ tone }: { tone: Tone }) {
  const c: Record<Tone, string> = {
    neutral: 'bg-ink-faint', ok: 'bg-ok', warn: 'bg-warn',
    danger: 'bg-danger', info: 'bg-primary',
  }
  return <span aria-hidden className={`inline-block w-2.5 h-2.5 rounded-full ${c[tone]}`} />
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`jm-card p-6 ${className}`}>{children}</section>
}

export function CardHeader({ title, note, action }: { title: string; note?: string; action?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3 mb-5">
      <div>
        <h2 className="jm-h3">{title}</h2>
        {note && <p className="text-sm text-ink-soft mt-1 max-w-prose">{note}</p>}
      </div>
      {action}
    </header>
  )
}

export function StatTile({
  label, value, sub, tone = 'neutral',
}: { label: string; value: string; sub?: string; tone?: Tone }) {
  const accent: Record<Tone, string> = {
    neutral: 'border-l-line-strong', ok: 'border-l-ok', warn: 'border-l-warn',
    danger: 'border-l-danger', info: 'border-l-primary',
  }
  return (
    <div className={`jm-card border-l-8 ${accent[tone]} p-5`}>
      <div className="jm-eyebrow">{label}</div>
      <div className="font-serif text-3xl font-bold mt-2 tabular-nums">{value}</div>
      {sub && <div className="text-sm text-ink-soft mt-1.5">{sub}</div>}
    </div>
  )
}

export function PageHeading({ title, note, children }: { title: string; note?: string; children?: ReactNode }) {
  return (
    <header className="mb-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="jm-h1">{title}</h1>
          {note && <p className="text-ink-soft mt-2 max-w-prose">{note}</p>}
        </div>
        {children}
      </div>
    </header>
  )
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="text-center py-14 px-6">
      <p className="jm-h3 text-ink-soft">{title}</p>
      {hint && <p className="text-ink-faint mt-2">{hint}</p>}
    </div>
  )
}

export function Field({ label, children, id }: { label: string; children: ReactNode; id: string }) {
  return (
    <div>
      <label className="jm-label" htmlFor={id}>{label}</label>
      {children}
    </div>
  )
}

export function Select({
  id, label, value, onChange, options,
}: {
  id: string; label: string; value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <Field id={id} label={label}>
      <select id={id} className="jm-input" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </Field>
  )
}

export function SearchInput({
  id, label, value, onChange, placeholder,
}: { id: string; label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <Field id={id} label={label}>
      <input
        id={id} type="search" className="jm-input" value={value} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)} autoComplete="off"
      />
    </Field>
  )
}

export function TableFrame({
  children, caption, minWidth,
}: { children: ReactNode; caption?: string; minWidth?: string }) {
  return (
    <div className="jm-panel overflow-hidden">
      <div className="overflow-x-auto">
        <table className={`jm-table ${minWidth ?? ''}`}>
          {caption && <caption className="sr-only">{caption}</caption>}
          {children}
        </table>
      </div>
    </div>
  )
}

export function Tabs({
  tabs, active, onChange, label,
}: {
  tabs: { id: string; label: string; badge?: number }[]
  active: string; onChange: (id: string) => void; label: string
}) {
  return (
    <div role="tablist" aria-label={label} className="flex flex-wrap gap-2 border-b-2 border-line mb-6">
      {tabs.map((tab) => {
        const on = tab.id === active
        return (
          <button
            key={tab.id} role="tab" type="button"
            aria-selected={on} aria-controls={`panel-${tab.id}`} id={`tab-${tab.id}`}
            onClick={() => onChange(tab.id)}
            className={`min-h-[3rem] px-5 font-semibold text-base border-b-4 -mb-[2px] transition-colors
              ${on ? 'border-primary text-primary' : 'border-transparent text-ink-soft hover:text-ink hover:border-line-strong'}`}
          >
            {tab.label}
            {tab.badge !== undefined && (
              <span className="ml-2 text-sm tabular-nums text-ink-faint">({tab.badge})</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export function TabPanel({ id, active, children }: { id: string; active: string; children: ReactNode }) {
  if (id !== active) return null
  return <div role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}`}>{children}</div>
}

/** Definition row used throughout the patient record. */
export function DefRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[minmax(11rem,auto)_1fr] gap-x-6 gap-y-1 py-3 border-b border-line last:border-0">
      <dt className="text-sm font-semibold text-ink-soft">{label}</dt>
      <dd className="text-ink">{children}</dd>
    </div>
  )
}

export function Banner({ tone = 'info', title, children }: { tone?: Tone; title?: string; children: ReactNode }) {
  const styles: Record<Tone, string> = {
    neutral: 'bg-canvas border-line-strong',
    ok: 'bg-ok-light border-ok/40',
    warn: 'bg-warn-light border-warn/50',
    danger: 'bg-danger-light border-danger/50',
    info: 'bg-primary-light border-primary/30',
  }
  return (
    <div className={`border-l-8 border ${styles[tone]} rounded p-5`}>
      {title && <p className="font-bold mb-1">{title}</p>}
      <div className="text-base">{children}</div>
    </div>
  )
}
