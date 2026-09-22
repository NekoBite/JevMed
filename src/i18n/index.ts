import { en } from './en'
import { zhHant } from './zh-Hant'
import { zhHans } from './zh-Hans'
import type { Lang, Tri } from '@/lib/types'

export type MsgKey = keyof typeof en

export const DICTS: Record<Lang, Record<MsgKey, string>> = {
  en,
  'zh-Hant': zhHant,
  'zh-Hans': zhHans,
}

export const LANGUAGES: { code: Lang; label: string; short: string }[] = [
  { code: 'en',      label: 'English',  short: 'EN' },
  { code: 'zh-Hant', label: '繁體中文', short: '繁' },
  { code: 'zh-Hans', label: '简体中文', short: '简' },
]

/** Resolve a message key, with optional {placeholder} substitution. */
export function translate(lang: Lang, key: MsgKey, vars?: Record<string, string | number>): string {
  let s: string = DICTS[lang][key] ?? DICTS.en[key] ?? key
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v))
  return s
}

/** Resolve a trilingual data field, falling back to English. */
export function pickTri(lang: Lang, v: Tri | undefined | null): string {
  if (!v) return ''
  return v[lang] || v.en || ''
}

/** Locale tag for Intl formatting. */
export const intlTag: Record<Lang, string> = {
  en: 'en-HK',
  'zh-Hant': 'zh-HK',
  'zh-Hans': 'zh-CN',
}
