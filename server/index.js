/**
 * JevMed ERP — application server.
 *
 * Responsibilities, in order of importance:
 *   1. Hold the provider API key server-side and never expose it to a browser.
 *   2. Proxy assistant traffic so the key is used but never shipped.
 *   3. Serve the built single-page application.
 *
 * The clinical data itself is synthetic and lives in the client bundle, so this
 * process stores nothing about any patient. The only durable state is the
 * encrypted vault file.
 */
import express from 'express'
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { Vault, verifyPassphrase } from './vault.js'
import { PROVIDERS, listModels, streamCompletion } from './providers.js'
import { buildSystemPrompt } from './prompt.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

// ── Configuration ───────────────────────────────────────────────────────────
// A tiny .env reader rather than a dependency: this file is read once, at boot,
// and the format we need is three lines of KEY=value.
function loadDotEnv() {
  const file = join(ROOT, '.env')
  if (!existsSync(file)) return
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = value
  }
}
loadDotEnv()

const PORT = Number(process.env.PORT || 8787)
const PUBLIC_ORIGIN = process.env.PUBLIC_ORIGIN || `http://localhost:${PORT}`
const SECURE_COOKIES = PUBLIC_ORIGIN.startsWith('https://')
const DATA_DIR = resolve(ROOT, process.env.DATA_DIR || './data')
const VAULT_PATH = (process.env.VAULT_PATH || '').replace(/^\/+|\/+$/g, '')
const PASSPHRASE_HASH = process.env.VAULT_PASSPHRASE_HASH || ''

const vault = new Vault({ dataDir: DATA_DIR, masterKeyHex: process.env.VAULT_MASTER_KEY })

// Session cookies are signed with a key derived from the master key, so that a
// process restart does not sign every administrator out. If the master key is
// absent the vault is unusable anyway; a random secret is fine there.
const SESSION_SECRET = vault.usable
  ? createHmac('sha256', Buffer.from(process.env.VAULT_MASTER_KEY, 'hex')).update('jevmed:vault-session:v1').digest()
  : randomBytes(32)

const SESSION_TTL_MS = 2 * 60 * 60 * 1000  // two hours
const COOKIE = 'jm_vault'

// ── Boot-time configuration report ──────────────────────────────────────────
const problems = []
if (!VAULT_PATH) problems.push('VAULT_PATH is not set — the key console is disabled')
else if (VAULT_PATH.length < 16) problems.push('VAULT_PATH is shorter than 16 characters — it is guessable')
if (!PASSPHRASE_HASH) problems.push('VAULT_PASSPHRASE_HASH is not set — the key console is disabled')
if (!vault.usable) problems.push(vault.reason)

// ── App ─────────────────────────────────────────────────────────────────────
const app = express()
app.disable('x-powered-by')
app.set('trust proxy', 1)          // nginx sits in front; we want the real client IP
app.use(express.json({ limit: '256kb' }))

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'no-referrer')
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()')
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
  if (SECURE_COOKIES) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  // The bundle is self-contained: no third-party scripts, styles, fonts or
  // images, and no outbound connections except to this origin.
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",   // Tailwind emits an inline style tag
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join('; '))
  next()
})

// ── Rate limiting ───────────────────────────────────────────────────────────
// A fixed-window counter in memory. Single process, single node — a shared
// store would be the right answer behind several instances, and is deliberate
// over-engineering for one.
function makeLimiter({ windowMs, max }) {
  const hits = new Map()
  setInterval(() => {
    const now = Date.now()
    for (const [k, v] of hits) if (v.reset < now) hits.delete(k)
  }, windowMs).unref()

  return function limit(req, res, next) {
    const ip = req.ip || 'unknown'
    const now = Date.now()
    let rec = hits.get(ip)
    if (!rec || rec.reset < now) { rec = { count: 0, reset: now + windowMs }; hits.set(ip, rec) }
    rec.count++
    if (rec.count > max) {
      res.setHeader('Retry-After', Math.ceil((rec.reset - now) / 1000))
      return res.status(429).json({ error: 'Too many requests. Please wait and try again.' })
    }
    next()
  }
}
const loginLimiter = makeLimiter({ windowMs: 15 * 60 * 1000, max: 5 })
const chatLimiter  = makeLimiter({ windowMs: 5 * 60 * 1000, max: 40 })

// ── Session helpers ─────────────────────────────────────────────────────────
function signSession(expiresAt) {
  const payload = Buffer.from(JSON.stringify({ exp: expiresAt })).toString('base64url')
  const sig = createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

function readSession(req) {
  const raw = (req.headers.cookie || '')
    .split(';').map((s) => s.trim())
    .find((s) => s.startsWith(`${COOKIE}=`))
  if (!raw) return null
  const token = decodeURIComponent(raw.slice(COOKIE.length + 1))
  const [payload, sig] = token.split('.')
  if (!payload || !sig) return null
  const expected = createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url')
  const a = Buffer.from(sig), b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    return exp > Date.now() ? { exp } : null
  } catch { return null }
}

function setSessionCookie(res, value, maxAgeMs) {
  const parts = [
    `${COOKIE}=${encodeURIComponent(value)}`,
    `Path=/${VAULT_PATH}`,
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${Math.floor(maxAgeMs / 1000)}`,
  ]
  if (SECURE_COOKIES) parts.push('Secure')
  res.setHeader('Set-Cookie', parts.join('; '))
}

const requireSession = (req, res, next) =>
  readSession(req) ? next() : res.status(401).json({ error: 'Not signed in.' })

// ── Public API ──────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, vaultConfigured: vault.status().configured, problems: problems.length })
})

app.get('/api/assistant/status', (_req, res) => {
  const s = vault.status()
  res.json({ configured: Boolean(s.configured), provider: s.provider ?? null, model: s.model ?? null })
})

app.post('/api/chat', chatLimiter, async (req, res) => {
  const record = vault.read()
  if (!record) return res.status(503).json({ error: 'not-configured' })

  const { messages, context, lang } = req.body ?? {}
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'bad-request' })
  }

  // Trim to the last few turns: enough for a coherent exchange, bounded enough
  // that a long session cannot quietly turn into an expensive one.
  const trimmed = messages.slice(-12)
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map((m) => ({ role: m.role, content: m.content.slice(0, 8000) }))
  if (trimmed.length === 0 || trimmed[trimmed.length - 1].role !== 'user') {
    return res.status(400).json({ error: 'bad-request' })
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',   // stop nginx buffering the stream
  })
  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`)

  // Heartbeat so intermediaries do not time the connection out while the model
  // is still thinking.
  const beat = setInterval(() => res.write(': keep-alive\n\n'), 15_000)
  req.on('close', () => clearInterval(beat))

  const result = await streamCompletion({
    provider: record.provider,
    apiKey: record.apiKey,
    model: record.model,
    system: buildSystemPrompt({ lang: typeof lang === 'string' ? lang : 'en', context: typeof context === 'string' ? context.slice(0, 60000) : '' }),
    messages: trimmed,
  }, (text) => send({ type: 'delta', text }))

  clearInterval(beat)
  if (result.ok) send({ type: 'done' })
  else send({
    type: 'error',
    code: result.status === 401 || result.status === 403 ? 'auth'
        : result.status === 429 ? 'rate'
        : 'other',
    message: result.message,
  })
  res.end()
})

// ── Key-management console (unlisted path) ──────────────────────────────────
if (VAULT_PATH && PASSPHRASE_HASH) {
  const admin = express.Router()
  const page = readFileSync(join(__dirname, 'admin-page.html'), 'utf8')

  admin.use((_req, res, next) => {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive')
    res.setHeader('Cache-Control', 'no-store')
    next()
  })

  admin.get('/', (_req, res) => res.type('html').send(page))

  admin.post('/api/login', loginLimiter, (req, res) => {
    const pass = String(req.body?.passphrase ?? '')
    if (!pass || !verifyPassphrase(pass, PASSPHRASE_HASH)) {
      return res.status(401).json({ error: 'Incorrect passphrase.' })
    }
    const exp = Date.now() + SESSION_TTL_MS
    setSessionCookie(res, signSession(exp), SESSION_TTL_MS)
    res.json({ ok: true })
  })

  admin.post('/api/logout', (_req, res) => {
    setSessionCookie(res, '', 0)
    res.json({ ok: true })
  })

  admin.get('/api/state', requireSession, (_req, res) => res.json(vault.status()))

  admin.post('/api/test', requireSession, async (req, res) => {
    const { provider, apiKey } = req.body ?? {}
    if (!PROVIDERS.includes(provider)) return res.status(400).json({ error: 'Unknown provider.' })
    if (typeof apiKey !== 'string' || apiKey.length < 20) return res.status(400).json({ error: 'That does not look like an API key.' })
    const out = await listModels(provider, apiKey)
    if (!out.ok) {
      return res.status(400).json({
        error: out.status === 401 || out.status === 403
          ? 'The provider rejected that key.'
          : `Provider responded ${out.status || 'with an error'}: ${out.message}`,
      })
    }
    res.json({ ok: true, models: out.models })
  })

  admin.post('/api/key', requireSession, (req, res) => {
    const { provider, apiKey, model } = req.body ?? {}
    if (!PROVIDERS.includes(provider)) return res.status(400).json({ error: 'Unknown provider.' })
    if (typeof apiKey !== 'string' || apiKey.length < 20) return res.status(400).json({ error: 'That does not look like an API key.' })
    if (typeof model !== 'string' || !model) return res.status(400).json({ error: 'Choose a model.' })
    try {
      vault.write({ provider, model, apiKey })
      res.json({ ok: true })
    } catch (err) {
      res.status(500).json({ error: String(err.message ?? err) })
    }
  })

  admin.delete('/api/key', requireSession, (_req, res) => {
    vault.clear()
    res.json({ ok: true })
  })

  app.use(`/${VAULT_PATH}`, admin)
}

// ── Static SPA ──────────────────────────────────────────────────────────────
const DIST = join(ROOT, 'dist')
if (existsSync(DIST)) {
  // Hashed asset filenames can be cached hard; index.html must never be.
  app.use('/assets', express.static(join(DIST, 'assets'), { immutable: true, maxAge: '1y' }))
  app.use(express.static(DIST, { index: false, maxAge: '1h' }))
  app.get('*', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    res.sendFile(join(DIST, 'index.html'))
  })
} else {
  app.get('*', (_req, res) => res.status(503).type('text').send('Front end not built. Run: npm run build'))
}

app.listen(PORT, () => {
  console.log(`JevMed ERP listening on :${PORT}`)
  console.log(`  origin      ${PUBLIC_ORIGIN}`)
  console.log(`  data dir    ${DATA_DIR}`)
  console.log(`  key console ${VAULT_PATH && PASSPHRASE_HASH ? `${PUBLIC_ORIGIN}/${VAULT_PATH}` : 'DISABLED'}`)
  console.log(`  assistant   ${vault.status().configured ? `${vault.status().provider} · ${vault.status().model}` : 'demonstration mode (no key stored)'}`)
  for (const p of problems) console.warn(`  ! ${p}`)
})
