import { useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useApp } from '@/lib/app-context'
import { LANGUAGES } from '@/i18n'
import { can, type Section } from '@/lib/roles'
import { getStaff, db } from '@/lib/data'
import type { MsgKey } from '@/i18n'
import type { Lang } from '@/lib/types'

const NAV: { group: MsgKey; items: { to: string; key: MsgKey; section: Section }[] }[] = [
  {
    group: 'nav.section.clinical',
    items: [
      { to: '/', key: 'nav.dashboard', section: 'dashboard' },
      { to: '/patients', key: 'nav.patients', section: 'patients' },
      { to: '/appointments', key: 'nav.appointments', section: 'appointments' },
    ],
  },
  {
    group: 'nav.section.operations',
    items: [
      { to: '/billing', key: 'nav.billing', section: 'billing' },
      { to: '/inventory', key: 'nav.inventory', section: 'inventory' },
      { to: '/staff', key: 'nav.staff', section: 'staff' },
    ],
  },
  {
    group: 'nav.section.governance',
    items: [{ to: '/audit', key: 'nav.audit', section: 'audit' }],
  },
]

function ToggleGroup<T extends string>({
  label, value, options, onChange,
}: { label: string; value: T; options: { v: T; l: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-semibold text-white/75 whitespace-nowrap">{label}</span>
      <div role="group" aria-label={label} className="flex rounded border border-white/35 overflow-hidden">
        {options.map((o) => {
          const on = o.v === value
          return (
            <button
              key={o.v} type="button" onClick={() => onChange(o.v)} aria-pressed={on}
              className={`min-h-[2.5rem] px-3 text-sm font-semibold transition-colors
                ${on ? 'bg-white text-primary' : 'bg-transparent text-white hover:bg-white/15'}`}
            >
              {o.l}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function Shell({ children }: { children: ReactNode }) {
  const { t, tri, lang, setLang, textScale, setTextScale, contrast, setContrast, session, signOut } = useApp()
  const [navOpen, setNavOpen] = useState(false)
  const location = useLocation()

  const role = session?.role ?? 'admin'
  const me = getStaff(session?.staffId ?? '')

  const visible = NAV
    .map((g) => ({ ...g, items: g.items.filter((i) => can(role, i.section)) }))
    .filter((g) => g.items.length > 0)

  return (
    <div className="min-h-screen flex flex-col">
      <a href="#main" className="jm-skip">{t('a11y.skip')}</a>

      {/* ── Masthead ─────────────────────────────────────────────────────── */}
      <header className="bg-primary text-white jm-noprint">
        <div className="mx-auto max-w-[110rem] px-4 sm:px-6">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 py-3">
            <div className="flex items-center gap-3 mr-auto">
              <svg viewBox="0 0 64 64" aria-hidden className="w-10 h-10 shrink-0">
                <rect width="64" height="64" rx="8" fill="#fff" fillOpacity=".12" />
                <path d="M32 14 L46 21 v13 c0 9-6 15-14 18-8-3-14-9-14-18V21z" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinejoin="round" />
                <path d="M32 26v14M25 33h14" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
              </svg>
              <div className="leading-tight">
                <div className="font-serif text-xl font-bold tracking-tight">{t('app.name')}</div>
                <div className="text-xs text-white/80">{t('app.subtitle')}</div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <ToggleGroup
                label={t('a11y.language')} value={lang}
                options={LANGUAGES.map((l) => ({ v: l.code as Lang, l: l.short }))}
                onChange={setLang}
              />
              <ToggleGroup
                label={t('a11y.textSize')} value={textScale}
                options={[
                  { v: 'normal' as const, l: 'A' },
                  { v: 'large' as const, l: 'A+' },
                  { v: 'larger' as const, l: 'A++' },
                ]}
                onChange={setTextScale}
              />
              <ToggleGroup
                label={t('a11y.contrast')} value={contrast}
                options={[
                  { v: 'standard' as const, l: t('ui.contrast.standard') },
                  { v: 'high' as const, l: t('ui.contrast.high') },
                ]}
                onChange={setContrast}
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 border-t border-white/20 py-2.5">
            <div className="text-sm text-white/90">
              <span className="text-white/70">{t('common.signedInAs')}: </span>
              <span className="font-semibold">{me ? tri(me.name) : '—'}</span>
              <span className="text-white/70"> · {t(`role.${role}` as MsgKey)}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button" onClick={signOut}
                className="min-h-[2.5rem] px-4 text-sm font-semibold rounded border border-white/40 hover:bg-white/15"
              >
                {t('common.signOut')}
              </button>
              <button
                type="button" onClick={() => setNavOpen((v) => !v)}
                aria-expanded={navOpen} aria-controls="sidenav"
                className="lg:hidden min-h-[2.5rem] px-4 text-sm font-semibold rounded border border-white/40 hover:bg-white/15"
              >
                {navOpen ? t('a11y.closeMenu') : t('a11y.openMenu')}
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[110rem] w-full px-4 sm:px-6 flex-1 flex flex-col lg:flex-row gap-6 py-6">
        {/* ── Side navigation ───────────────────────────────────────────── */}
        <nav
          id="sidenav" aria-label={t('a11y.mainNav')}
          className={`lg:w-[17rem] shrink-0 jm-noprint ${navOpen ? 'block' : 'hidden lg:block'}`}
        >
          <div className="jm-panel p-3 sticky top-4">
            {visible.map((group) => (
              <div key={group.group} className="mb-5 last:mb-1">
                <div className="jm-eyebrow px-3 pb-2">{t(group.group)}</div>
                <ul className="space-y-1">
                  {group.items.map((item) => (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        end={item.to === '/'}
                        onClick={() => setNavOpen(false)}
                        className={({ isActive }) =>
                          `flex items-center min-h-[3rem] px-3 rounded font-semibold border-l-4 transition-colors ${
                            isActive || (item.to !== '/' && location.pathname.startsWith(item.to))
                              ? 'bg-primary-light border-primary text-primary'
                              : 'border-transparent text-ink hover:bg-canvas'
                          }`
                        }
                      >
                        {t(item.key)}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </nav>

        {/* ── Main ──────────────────────────────────────────────────────── */}
        <main id="main" className="flex-1 min-w-0">{children}</main>
      </div>

      <footer className="bg-white border-t border-line mt-auto">
        <div className="mx-auto max-w-[110rem] px-4 sm:px-6 py-5 flex flex-wrap gap-x-6 gap-y-2 justify-between text-sm text-ink-soft">
          <p>{t('app.org')} · {t('footer.system')}</p>
          <p className="font-semibold text-warn">{t('footer.synthetic')}</p>
          <p className="tabular-nums">{t('dash.asOf')} {db.meta.generatedAt}</p>
        </div>
      </footer>
    </div>
  )
}
