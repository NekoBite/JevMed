import { useEffect, useRef, useState } from 'react'
import { useApp } from '@/lib/app-context'
import { useAssistant } from '@/lib/assistant-context'
import { Markdown } from './Markdown'
import { Chip } from './ui'
import { patientContext, systemContext } from '@/lib/ai-context'
import { demoReply, type DemoTopic } from '@/lib/demo-replies'
import { getPatient } from '@/lib/data'
import { canUseAssistant } from '@/lib/roles'
import type { MsgKey } from '@/i18n'

interface Message { role: 'user' | 'assistant'; content: string }

interface Status { configured: boolean; provider: string | null; model: string | null }

const PATIENT_SUGGESTIONS: { key: MsgKey; topic: DemoTopic }[] = [
  { key: 'ai.suggest1', topic: 'summary' },
  { key: 'ai.suggest2', topic: 'abnormal' },
  { key: 'ai.suggest3', topic: 'interactions' },
  { key: 'ai.suggest4', topic: 'nextVisit' },
]
const GENERAL_SUGGESTIONS: { key: MsgKey; topic: DemoTopic }[] = [
  { key: 'ai.suggestG1', topic: 'rejectedClaims' },
  { key: 'ai.suggestG2', topic: 'restock' },
  { key: 'ai.suggestG3', topic: 'apptLoad' },
]

export function Assistant() {
  const { t, tri, lang, session } = useApp()
  const { open, patientId, openWith, close } = useAssistant()
  const [status, setStatus] = useState<Status | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<MsgKey | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const logRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const role = session?.role ?? 'admin'
  const allowed = canUseAssistant(role)
  const patient = patientId ? getPatient(patientId) : null
  const suggestions = patient ? PATIENT_SUGGESTIONS : GENERAL_SUGGESTIONS

  useEffect(() => {
    let cancelled = false
    fetch('/api/assistant/status')
      .then((r) => (r.ok ? r.json() : { configured: false, provider: null, model: null }))
      .then((s: Status) => { if (!cancelled) setStatus(s) })
      .catch(() => { if (!cancelled) setStatus({ configured: false, provider: null, model: null }) })
    return () => { cancelled = true }
  }, [])

  // Keep the newest turn in view without yanking the page around.
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [messages, busy])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open, patientId])

  // Conversations are scoped to their record: carrying one patient's thread
  // into another chart is how the wrong result ends up in the wrong note.
  useEffect(() => { setMessages([]); setError(null) }, [patientId])

  if (!allowed) return null

  async function send(text: string, topic: DemoTopic | null) {
    const question = text.trim()
    if (!question || busy) return
    setError(null)
    setDraft('')
    const next: Message[] = [...messages, { role: 'user', content: question }]
    setMessages(next)

    // Demonstration mode answers from the data directly.
    if (!status?.configured) {
      setBusy(true)
      const answer = demoReply(topic, lang, patientId)
      // A brief pause so the answer reads as a reply rather than as a page jump.
      await new Promise((r) => setTimeout(r, 350))
      setMessages([...next, { role: 'assistant', content: answer }])
      setBusy(false)
      return
    }

    setBusy(true)
    setMessages([...next, { role: 'assistant', content: '' }])
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          messages: next,
          lang,
          context: patientId ? patientContext(patientId) : systemContext(),
        }),
      })

      if (!res.ok || !res.body) {
        setError(res.status === 503 ? 'ai.notConfigured' : 'ai.error')
        setMessages(next)
        setBusy(false)
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let acc = ''

      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        let nl: number
        while ((nl = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, nl).trim()
          buffer = buffer.slice(nl + 1)
          if (!line.startsWith('data:')) continue
          let evt: { type: string; text?: string; code?: string }
          try { evt = JSON.parse(line.slice(5).trim()) } catch { continue }
          if (evt.type === 'delta' && evt.text) {
            acc += evt.text
            setMessages([...next, { role: 'assistant', content: acc }])
          } else if (evt.type === 'error') {
            setError(evt.code === 'auth' ? 'ai.errorKey' : evt.code === 'rate' ? 'ai.errorRate' : 'ai.error')
            if (!acc) setMessages(next)
          }
        }
      }
      if (!acc && !error) { setError('ai.error'); setMessages(next) }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') { setError('ai.error'); setMessages(next) }
    } finally {
      abortRef.current = null
      setBusy(false)
    }
  }

  function stop() {
    abortRef.current?.abort()
    abortRef.current = null
    setBusy(false)
  }

  if (!open) {
    return (
      <button
        type="button" onClick={() => openWith(patientId)}
        className="jm-noprint fixed bottom-5 right-5 z-40 jm-btn-primary shadow-lift"
      >
        {t('ai.open')}
      </button>
    )
  }

  return (
    <aside
      role="complementary" aria-label={t('ai.title')}
      className="jm-noprint fixed z-40 inset-0 sm:inset-auto sm:bottom-5 sm:right-5
                 sm:w-[min(30rem,calc(100vw-2.5rem))] sm:h-[min(46rem,calc(100vh-3rem))]
                 bg-surface sm:rounded-lg border-y sm:border border-line shadow-lift flex flex-col"
    >
      <header className="bg-primary text-white px-5 py-4 sm:rounded-t-lg shrink-0">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="font-serif text-lg font-bold">{t('ai.title')}</h2>
            <p className="text-sm text-white/85 truncate">
              {patient ? `${t('ai.contextPatient')} ${tri(patient.name)}` : t('ai.contextNone')}
            </p>
          </div>
          <button
            type="button" onClick={close} aria-label={t('ai.close')}
            className="shrink-0 min-h-[2.5rem] px-4 text-sm font-semibold rounded border border-white/40 hover:bg-white/15"
          >
            {t('common.close')}
          </button>
        </div>
        {status && !status.configured && (
          <p className="mt-2 text-sm bg-white/15 rounded px-3 py-1.5 inline-block">{t('ai.demoMode')}</p>
        )}
      </header>

      <div ref={logRef} className="flex-1 overflow-y-auto px-5 py-5 space-y-5" aria-live="polite" aria-busy={busy}>
        {messages.length === 0 && (
          <>
            <p className="text-ink-soft">{t('ai.greeting')}</p>
            {status && !status.configured && (
              <div className="border-l-8 border border-warn/50 bg-warn-light rounded p-4 text-sm">
                <p className="font-bold text-warn">{t('ai.notConfigured')}</p>
                <p className="mt-1">{t('ai.notConfiguredHint')}</p>
              </div>
            )}
          </>
        )}

        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'text-right' : ''}>
            <p className="jm-eyebrow mb-1.5">{m.role === 'user' ? t('ai.you') : t('ai.assistant')}</p>
            {m.role === 'user' ? (
              <p className="inline-block text-left bg-primary-light border border-primary/25 rounded-lg px-4 py-3 max-w-[92%]">
                {m.content}
              </p>
            ) : (
              <div className="border-l-4 border-line pl-4">
                {m.content ? <Markdown text={m.content} /> : <p className="text-ink-faint">{t('ai.thinking')}</p>}
              </div>
            )}
          </div>
        ))}

        {error && (
          <div className="border-l-8 border border-danger/50 bg-danger-light rounded p-4" role="alert">
            <p className="text-danger font-semibold">{t(error)}</p>
          </div>
        )}

        {messages.length === 0 && (
          <div className="pt-2">
            <ul className="space-y-2">
              {suggestions.map((s) => (
                <li key={s.key}>
                  <button
                    type="button" onClick={() => send(t(s.key), s.topic)} disabled={busy}
                    className="w-full text-left min-h-[3rem] px-4 py-2 rounded border border-line hover:bg-primary-light disabled:opacity-50"
                  >
                    {t(s.key)}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <footer className="border-t border-line p-4 shrink-0">
        <form
          onSubmit={(e) => { e.preventDefault(); send(draft, null) }}
          className="flex items-end gap-3"
        >
          <label className="sr-only" htmlFor="ai-input">{t('ai.title')}</label>
          <textarea
            ref={inputRef} id="ai-input" rows={2} value={draft}
            placeholder={patient ? t('ai.placeholder') : t('ai.placeholderGeneral')}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends; Shift+Enter makes a new line. Stated in no UI text
              // because the Send button is always present and always works.
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(draft, null) }
            }}
            className="jm-input flex-1 resize-none py-3"
          />
          {busy ? (
            <button type="button" onClick={stop} className="jm-btn-secondary shrink-0">{t('ai.stop')}</button>
          ) : (
            <button type="submit" className="jm-btn-primary shrink-0" disabled={!draft.trim()}>{t('ai.send')}</button>
          )}
        </form>
        <div className="flex flex-wrap items-center gap-3 mt-3">
          {messages.length > 0 && (
            <button type="button" className="text-sm jm-link" onClick={() => { setMessages([]); setError(null) }}>
              {t('ai.clear')}
            </button>
          )}
          {status?.configured && <Chip tone="ok">{status.provider} · {status.model}</Chip>}
        </div>
        <p className="text-xs text-ink-faint mt-3 leading-relaxed">{t('ai.disclaimer')}</p>
      </footer>
    </aside>
  )
}
