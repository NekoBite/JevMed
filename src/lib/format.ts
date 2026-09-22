import type { Lang } from './types'

export function money(amount: number, locale: string, currency = 'HKD'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency', currency, maximumFractionDigits: 0,
  }).format(amount)
}

export function num(n: number, locale: string, dp = 0): string {
  return new Intl.NumberFormat(locale, { minimumFractionDigits: dp, maximumFractionDigits: dp }).format(n)
}

export function pct(fraction: number, locale: string, dp = 1): string {
  return new Intl.NumberFormat(locale, { style: 'percent', minimumFractionDigits: dp, maximumFractionDigits: dp }).format(fraction)
}

/** Long, unambiguous date. Elderly readers should never have to decode 03/04. */
export function longDate(isoDate: string, locale: string): string {
  const d = new Date(`${isoDate}T00:00:00`)
  if (Number.isNaN(d.getTime())) return isoDate
  return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long', day: 'numeric' }).format(d)
}

export function shortDate(isoDate: string, locale: string): string {
  const d = new Date(`${isoDate}T00:00:00`)
  if (Number.isNaN(d.getTime())) return isoDate
  return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric' }).format(d)
}

export function weekday(isoDate: string, locale: string): string {
  const d = new Date(`${isoDate}T00:00:00`)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(d)
}

/** "2026-09-22 14:30" → date + time, both localised. */
export function dateTime(value: string, locale: string): string {
  const [date, time] = value.split(' ')
  return `${shortDate(date, locale)} ${time ?? ''}`.trim()
}

export const timeOnly = (value: string): string => value.split(' ')[1] ?? value

export function greetingKey(hour = new Date().getHours()): 'dash.goodMorning' | 'dash.goodAfternoon' | 'dash.goodEvening' {
  if (hour < 12) return 'dash.goodMorning'
  if (hour < 18) return 'dash.goodAfternoon'
  return 'dash.goodEvening'
}

/** Reference interval as a readable string: "13.5 – 17.5", "< 5.2", "> 90". */
export function refRange(lo: number | null, hi: number | null, locale: string, lang: Lang): string {
  const dash = lang === 'en' ? ' – ' : ' – '
  if (lo !== null && hi !== null) return `${num(lo, locale, decimals(lo))}${dash}${num(hi, locale, decimals(hi))}`
  if (hi !== null) return `< ${num(hi, locale, decimals(hi))}`
  if (lo !== null) return `> ${num(lo, locale, decimals(lo))}`
  return '—'
}

const decimals = (n: number) => (Number.isInteger(n) ? 0 : String(n).split('.')[1]?.length ?? 1)
