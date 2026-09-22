/**
 * Headless smoke test.
 *
 * Walks every role through every page it can reach, in all three languages,
 * and fails on any console error, any page error, or any missing translation
 * key leaking into the rendered text. Screenshots land in ./screenshots.
 *
 *   node scripts/smoke-test.mjs [baseUrl]
 */
import { chromium } from 'playwright'
import { mkdirSync, existsSync } from 'node:fs'

// Use the chromium already present in this environment when Playwright's own
// pinned build is absent, rather than downloading a second copy.
const PINNED = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const launchOpts = existsSync(PINNED) ? { executablePath: PINNED } : {}

const BASE = process.argv[2] || 'http://localhost:8787'
const SHOTS = 'screenshots'
mkdirSync(SHOTS, { recursive: true })

const ROLES = ['chairman', 'physician', 'nurse', 'pharmacist', 'admin']
const PAGES = [
  ['/', 'dashboard'],
  ['/patients', 'patients'],
  ['/patients/P0001', 'patient-detail'],
  ['/appointments', 'appointments'],
  ['/billing', 'billing'],
  ['/inventory', 'inventory'],
  ['/staff', 'staff'],
  ['/audit', 'audit'],
]
const LANGS = ['en', 'zh-Hant', 'zh-Hans']

const failures = []
const note = (msg) => { failures.push(msg); console.error(`  ✗ ${msg}`) }

const browser = await chromium.launch(launchOpts)
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 })
const page = await ctx.newPage()

page.on('console', (m) => {
  if (m.type() === 'error') note(`console error @ ${page.url()}: ${m.text()}`)
})
page.on('pageerror', (e) => note(`page error @ ${page.url()}: ${e.message}`))

async function seed(role, lang) {
  const staff = { chairman: 'S017', physician: 'S001', nurse: 'S011', pharmacist: 'S015', admin: 'S017' }[role]
  await page.addInitScript(([r, s, l]) => {
    localStorage.setItem('jevmed.session', JSON.stringify({ role: r, staffId: s }))
    localStorage.setItem('jevmed.lang', JSON.stringify(l))
  }, [role, staff, lang])
}

console.log(`Smoke-testing ${BASE}\n`)

// 1. Sign-in screen, one shot per language
for (const lang of LANGS) {
  const p = await ctx.newPage()
  await p.addInitScript((l) => {
    localStorage.removeItem('jevmed.session')
    localStorage.setItem('jevmed.lang', JSON.stringify(l))
  }, lang)
  await p.goto(BASE, { waitUntil: 'networkidle' })
  const text = await p.textContent('body')
  if (!text || text.length < 200) note(`login page looks empty (${lang})`)
  await p.screenshot({ path: `${SHOTS}/login-${lang}.png`, fullPage: true })
  console.log(`  ✓ login · ${lang}`)
  await p.close()
}

// 2. Every role × every page, English; plus all pages in both Chinese scripts
//    for the admin role, which sees the most surface area.
for (const role of ROLES) {
  for (const [path, name] of PAGES) {
    const p = await ctx.newPage()
    p.on('pageerror', (e) => note(`page error @ ${role}${path}: ${e.message}`))
    p.on('console', (m) => { if (m.type() === 'error') note(`console error @ ${role}${path}: ${m.text()}`) })
    const staff = { chairman: 'S017', physician: 'S001', nurse: 'S011', pharmacist: 'S015', admin: 'S017' }[role]
    await p.addInitScript(([r, s]) => {
      localStorage.setItem('jevmed.session', JSON.stringify({ role: r, staffId: s }))
      localStorage.setItem('jevmed.lang', JSON.stringify('en'))
    }, [role, staff])
    await p.goto(BASE + path, { waitUntil: 'networkidle' })
    await p.waitForTimeout(250)

    const body = await p.textContent('body') ?? ''
    // A missing dictionary entry renders as the raw key, which always contains
    // a dot and never a space — cheap to detect, and the only way a
    // three-language build silently regresses.
    const leaked = body.match(/\b(?:nav|common|dash|patients?|enc|lab|med|img|appt|bill|inv|staff|audit|ai|login|role|ui|a11y|footer)\.[a-z][a-zA-Z.-]*\b/g)
    if (leaked) note(`untranslated key(s) on ${role}${path}: ${[...new Set(leaked)].slice(0, 5).join(', ')}`)

    if (role === 'admin') {
      await p.screenshot({ path: `${SHOTS}/${name}-en.png`, fullPage: true })
    }
    console.log(`  ✓ ${role.padEnd(11)} ${path}`)
    await p.close()
  }
}

// 3. Admin, all pages, both Chinese scripts
for (const lang of ['zh-Hant', 'zh-Hans']) {
  for (const [path, name] of PAGES) {
    const p = await ctx.newPage()
    p.on('pageerror', (e) => note(`page error @ ${lang}${path}: ${e.message}`))
    await p.addInitScript((l) => {
      localStorage.setItem('jevmed.session', JSON.stringify({ role: 'admin', staffId: 'S017' }))
      localStorage.setItem('jevmed.lang', JSON.stringify(l))
    }, lang)
    await p.goto(BASE + path, { waitUntil: 'networkidle' })
    await p.waitForTimeout(250)
    await p.screenshot({ path: `${SHOTS}/${name}-${lang}.png`, fullPage: true })
    console.log(`  ✓ ${lang}  ${path}`)
    await p.close()
  }
}

// 4. Assistant in demonstration mode, plus the largest text size
{
  const p = await ctx.newPage()
  p.on('pageerror', (e) => note(`page error @ assistant: ${e.message}`))
  await p.addInitScript(() => {
    localStorage.setItem('jevmed.session', JSON.stringify({ role: 'physician', staffId: 'S001' }))
    localStorage.setItem('jevmed.lang', JSON.stringify('en'))
  })
  await p.goto(`${BASE}/patients/P0001`, { waitUntil: 'networkidle' })
  await p.getByRole('button', { name: /ask the assistant/i }).click()
  await p.waitForTimeout(400)
  await p.getByRole('button', { name: /which results are outside/i }).click()
  await p.waitForTimeout(1200)
  const panel = await p.textContent('[role="complementary"]') ?? ''
  if (!/reference interval|method/i.test(panel)) note('assistant demo reply did not render')
  await p.screenshot({ path: `${SHOTS}/assistant-demo.png`, fullPage: false })
  console.log('  ✓ assistant  demonstration reply')
  await p.close()
}
{
  const p = await ctx.newPage()
  await p.addInitScript(() => {
    localStorage.setItem('jevmed.session', JSON.stringify({ role: 'admin', staffId: 'S017' }))
    localStorage.setItem('jevmed.textScale', JSON.stringify('larger'))
    localStorage.setItem('jevmed.contrast', JSON.stringify('high'))
  })
  await p.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(300)
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  if (overflow > 2) note(`horizontal overflow of ${overflow}px at largest text size`)
  await p.screenshot({ path: `${SHOTS}/dashboard-large-highcontrast.png`, fullPage: true })
  console.log('  ✓ largest text size + high contrast')
  await p.close()
}

// 5. Key-management console
{
  const p = await ctx.newPage()
  const vaultPath = process.env.VAULT_PATH || 'ops-testpath0123456789abcdef'
  await p.goto(`${BASE}/${vaultPath}/`, { waitUntil: 'networkidle' })
  if (!/Key Management/i.test(await p.title() + (await p.textContent('body') ?? ''))) {
    note('key management console did not render')
  }
  await p.screenshot({ path: `${SHOTS}/vault-console.png`, fullPage: true })
  console.log('  ✓ key management console')
  await p.close()
}

// 6. Mobile viewport
{
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
  const p = await mobile.newPage()
  await p.addInitScript(() => {
    localStorage.setItem('jevmed.session', JSON.stringify({ role: 'physician', staffId: 'S001' }))
  })
  await p.goto(`${BASE}/patients`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(300)
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  if (overflow > 2) note(`horizontal overflow of ${overflow}px at 390px wide`)
  await p.screenshot({ path: `${SHOTS}/mobile-patients.png`, fullPage: false })
  console.log('  ✓ mobile viewport')
  await mobile.close()
}

await browser.close()

console.log('')
if (failures.length) {
  console.error(`${failures.length} problem(s) found.`)
  process.exit(1)
}
console.log('All checks passed. Screenshots in ./screenshots')
