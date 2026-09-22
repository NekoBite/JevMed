import { useApp } from '@/lib/app-context'
import { LANGUAGES } from '@/i18n'
import { ROLES, ROLE_STAFF } from '@/lib/roles'
import { getStaff } from '@/lib/data'
import type { MsgKey } from '@/i18n'
import type { Lang } from '@/lib/types'

export default function Login() {
  const { t, tri, lang, setLang, signIn } = useApp()

  return (
    <div className="min-h-screen flex flex-col bg-canvas">
      <header className="bg-primary text-white">
        <div className="mx-auto max-w-5xl px-5 py-7 flex items-center gap-4">
          <svg viewBox="0 0 64 64" aria-hidden className="w-12 h-12 shrink-0">
            <rect width="64" height="64" rx="8" fill="#fff" fillOpacity=".12" />
            <path d="M32 14 L46 21 v13 c0 9-6 15-14 18-8-3-14-9-14-18V21z" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinejoin="round" />
            <path d="M32 26v14M25 33h14" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
          </svg>
          <div>
            <h1 className="font-serif text-2xl font-bold">{t('app.name')}</h1>
            <p className="text-white/85">{t('app.subtitle')}</p>
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto max-w-5xl w-full px-5 py-9">
        {/* Language first: a reader who cannot read the page cannot choose a role. */}
        <section className="jm-card p-6 mb-7">
          <h2 className="jm-h3 mb-4">{t('login.langPrompt')}</h2>
          <div className="flex flex-wrap gap-3">
            {LANGUAGES.map((l) => {
              const on = l.code === lang
              return (
                <button
                  key={l.code} type="button" onClick={() => setLang(l.code as Lang)}
                  aria-pressed={on}
                  className={`jm-btn min-w-[10rem] ${on
                    ? 'bg-primary text-white border-primary'
                    : 'bg-surface text-ink border-line-strong hover:bg-primary-light'}`}
                >
                  {l.label}
                </button>
              )
            })}
          </div>
        </section>

        <div className="jm-card p-6 mb-7 border-l-8 border-l-warn">
          <p className="jm-eyebrow text-warn">{t('login.demoBanner')}</p>
          <p className="mt-2 max-w-prose">{t('login.demoNote')}</p>
        </div>

        <h2 className="jm-h1 mb-2">{t('login.welcome')}</h2>
        <p className="text-ink-soft max-w-prose mb-2">{t('login.intro')}</p>
        <p className="text-ink-soft max-w-prose mb-7">{t('login.bypassNote')}</p>

        <ul className="grid gap-5 sm:grid-cols-2">
          {ROLES.map((role) => {
            const staffId = ROLE_STAFF[role]
            const person = getStaff(staffId)
            return (
              <li key={role} className="jm-card p-6 flex flex-col">
                <h3 className="jm-h3">{t(`role.${role}` as MsgKey)}</h3>
                <p className="text-ink-soft mt-2 flex-1">{t(`role.${role}.desc` as MsgKey)}</p>
                {person && (
                  <p className="text-sm text-ink-faint mt-3">
                    {tri(person.name)} · {person.credential}
                  </p>
                )}
                <button
                  type="button"
                  className="jm-btn-primary w-full mt-5"
                  onClick={() => signIn({ role, staffId })}
                >
                  {t('login.enterAs')} — {t(`role.${role}` as MsgKey)}
                </button>
              </li>
            )
          })}
        </ul>
      </main>

      <footer className="border-t border-line bg-white">
        <div className="mx-auto max-w-5xl px-5 py-5 text-sm text-ink-soft">
          {t('app.org')} · {t('footer.synthetic')}
        </div>
      </footer>
    </div>
  )
}
