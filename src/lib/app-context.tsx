import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { translate, pickTri, intlTag, type MsgKey } from '@/i18n'
import type { Lang, Role, Tri } from './types'

type TextScale = 'normal' | 'large' | 'larger'
type Contrast = 'standard' | 'high'

const SCALE_VALUE: Record<TextScale, number> = { normal: 1, large: 1.15, larger: 1.32 }

export interface Session { role: Role; staffId: string }

interface AppState {
  lang: Lang
  setLang: (l: Lang) => void
  t: (k: MsgKey, vars?: Record<string, string | number>) => string
  tri: (v: Tri | undefined | null) => string
  locale: string
  textScale: TextScale
  setTextScale: (s: TextScale) => void
  /** Numeric multiplier for anything that cannot use rem — SVG chart ticks. */
  scaleValue: number
  contrast: Contrast
  setContrast: (c: Contrast) => void
  session: Session | null
  signIn: (s: Session) => void
  signOut: () => void
}

const Ctx = createContext<AppState | null>(null)

const LS = {
  lang: 'jevmed.lang',
  scale: 'jevmed.textScale',
  contrast: 'jevmed.contrast',
  session: 'jevmed.session',
}

/** localStorage is wrapped because it throws in private-browsing on some
 *  browsers, and a senior user on a locked-down hospital desktop is exactly
 *  the person who would hit that. Preference loss must never break the app. */
function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch { return fallback }
}
function write(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* ignore */ }
}

function detectLang(): Lang {
  const stored = read<Lang | null>(LS.lang, null)
  if (stored) return stored
  const nav = (typeof navigator !== 'undefined' ? navigator.language : 'en').toLowerCase()
  if (nav.startsWith('zh')) {
    // Script subtag wins; otherwise region decides. HK/TW/MO → Traditional.
    if (nav.includes('hant') || /-(hk|tw|mo)\b/.test(nav)) return 'zh-Hant'
    return 'zh-Hans'
  }
  return 'en'
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectLang)
  const [textScale, setScaleState] = useState<TextScale>(() => read(LS.scale, 'normal' as TextScale))
  const [contrast, setContrastState] = useState<Contrast>(() => read(LS.contrast, 'standard' as Contrast))
  const [session, setSession] = useState<Session | null>(() => read<Session | null>(LS.session, null))

  useEffect(() => {
    document.documentElement.lang = lang === 'en' ? 'en' : lang.toLowerCase()
    write(LS.lang, lang)
  }, [lang])

  useEffect(() => {
    document.documentElement.style.setProperty('--jm-scale', String(SCALE_VALUE[textScale]))
    write(LS.scale, textScale)
  }, [textScale])

  useEffect(() => {
    document.documentElement.dataset.contrast = contrast
    write(LS.contrast, contrast)
  }, [contrast])

  const value = useMemo<AppState>(() => ({
    lang,
    setLang: setLangState,
    t: (k, vars) => translate(lang, k, vars),
    tri: (v) => pickTri(lang, v),
    locale: intlTag[lang],
    textScale,
    setTextScale: setScaleState,
    scaleValue: SCALE_VALUE[textScale],
    contrast,
    setContrast: setContrastState,
    session,
    signIn: (s) => { setSession(s); write(LS.session, s) },
    signOut: () => { setSession(null); write(LS.session, null) },
  }), [lang, textScale, contrast, session])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useApp(): AppState {
  const v = useContext(Ctx)
  if (!v) throw new Error('useApp must be used inside <AppProvider>')
  return v
}
