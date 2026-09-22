# JevMed ERP

A medical record and operations system with an embedded AI clinical assistant,
built for a healthcare network operating across Hong Kong and southern mainland
China. Every record it contains is synthetic.

**Live:** https://jevmed.trilumi.xyz

---

## What it is

Seven modules over one synthetic dataset:

| Module | What it holds |
|---|---|
| Dashboard | Network KPIs, an attention list, four charts, today's clinic schedule |
| Patient registry | 32 patients, searchable across all three name scripts, sorted by acuity |
| Patient record | Summary, encounters, laboratory results with trends, medications, imaging, billing |
| Appointments | Today / upcoming / past, grouped by day, interpreter flags |
| Billing & claims | Invoices, payer mix, claim status, rejection reasons, receivables ageing |
| Inventory & pharmacy | Stock levels, reorder points, lot numbers, expiry control, controlled drugs |
| Staff & roster | Directory with credentials, fortnightly duty roster, on-call |
| Access audit | Every record access with its stated purpose |

Plus a clinical assistant docked to the side of every page, and a
key-management console at an unlisted URL.

## The three things that shaped the build

**The readers are old.** Board members and senior clinicians, many past seventy.
So: 17px base type scalable to 24px without breaking a single layout, every
interactive target at least 48px tall, AAA contrast on body text, long
unambiguous dates (`22 September 2026`, never `22/09`), a high-contrast mode,
and no affordance that only appears on hover.

**Three scripts, two conventions.** English, 繁體中文 and 简体中文 are separate
dictionaries, not a character conversion. Hong Kong readers get 覆診, 化驗, 更表,
病人; mainland readers get 复诊, 检验, 排班, 患者, 危急值. The assistant is
instructed to keep them distinct too. No web fonts are loaded — Google Fonts is
unreachable from mainland China, so the stack is system fonts only.

**Colour never carries meaning alone.** Every dashboard chart plots a single
series, because the multi-hue status palette that was tried first measured
ΔE 14.2 between amber and red under normal vision and 4.9 under protanopia —
two bars a good number of the intended readers could not tell apart. Status
colour survives only as a chip sitting beside its own text label. Every chart
also ships a screen-reader table.

## Running it locally

```bash
npm install
npm run seed          # regenerate the synthetic dataset (deterministic)
npm run build         # type-check and build
npm start             # serve on http://localhost:8787
```

For development with hot reload:

```bash
npm run dev           # Vite on :5173, API on :8787
```

The assistant runs in **demonstration mode** until an API key is stored. In that
mode it still answers the suggested questions — computing the answers from the
records directly rather than calling a model — and says so in every reply.

### Enabling the assistant locally

```bash
cp .env.example .env
openssl rand -hex 24                                   # → VAULT_PATH (prefix it with "ops-")
openssl rand -hex 32                                   # → VAULT_MASTER_KEY
node server/hash-passphrase.js 'your long passphrase'  # → VAULT_PASSPHRASE_HASH
npm start
```

Then open `http://localhost:8787/<VAULT_PATH>`, unlock with the passphrase,
paste an Anthropic or OpenAI key, press **Test key & list models**, choose a
model, and save.

## How the key is handled

The provider API key is the only real secret in this system.

- Encrypted at rest with **AES-256-GCM**, under a key held in the environment
  rather than beside the ciphertext. A stolen copy of `data/` is inert.
- **Never returned to any browser.** The console shows provider, model and the
  last four characters — enough to tell two keys apart, not enough to use one.
- The console lives at an unlisted 48-hex-character path, is excluded from
  search indexing, and is protected by a **scrypt**-hashed passphrase
  (N=2¹⁵) compared in constant time. Five failed attempts lock the address out
  for fifteen minutes.
- Session cookies are HMAC-signed, `HttpOnly`, `SameSite=Strict`, `Secure` in
  production, scoped to the console path, and expire after two hours.
- The vault file is written `0600` through a temp-file rename, so a crash
  mid-write cannot leave a truncated vault behind.
- Model identifiers are fetched from the provider rather than hard-coded, so the
  console never offers a menu of retired model names.

The service itself runs under a dedicated account with `ProtectSystem=strict`,
an empty capability bounding set, and exactly one writable path.

## Roles

| Role | Sees |
|---|---|
| Board Chairman | Aggregates only — dashboard, billing, inventory, staff, audit |
| Physician | Full clinical record, plus the assistant |
| Nurse | Worklists, records, inventory |
| Pharmacist | Records, dispensing, stock and expiry |
| Administrator | Everything except record-level clinical detail restrictions |

The chairman deliberately cannot open an identified patient record. A governance
role needs aggregates; giving it record-level access by default is how avoidable
breaches happen. The assistant follows the same rule, since it reads clinical
detail.

The sign-in screen has a direct-entry button per role — no password, by design,
in a demonstration.

## The data

`src/data/mock.json` is generated by `scripts/generate-mock-data.mjs` from a
fixed seed, so every build produces byte-identical records and a screenshot
taken today still matches the system next month. CI regenerates it and fails if
the committed copy has drifted.

It is realistic where realism matters: ICD-10 codes, SI reference intervals as
used in Hong Kong and the mainland, real drug classes, and a method and
instrument recorded against every laboratory value — because results from
different methods are not comparable, and a system that hides that is lying by
omission.

It is synthetic everywhere else. No real person is represented, identity
documents are masked to a check digit, and the footer says so on every page.

## Deployment

See [`deploy/README.md`](deploy/README.md) for the full runbook. In short:

The target VPS (`212.85.27.147`) is **AlmaLinux 9 running CyberPanel +
OpenLiteSpeed**, shared with `trilumi.xyz` and its sibling sites. There is no
nginx on it and there cannot be — lsws already owns `:80` and `:443`. JevMed
runs as a systemd service on `127.0.0.1:8787` with an OpenLiteSpeed vhost in
front of it.

1. Add an **A record** for `jevmed` → `212.85.27.147` in Hostinger hPanel. DNS is
   external, so this cannot be done over SSH, and the certificate step depends
   on it.
2. `sudo bash deploy/setup-vps.sh` on the VPS — creates the service account, the
   systemd unit, the OpenLiteSpeed vhost and the `acme.sh` certificate, and
   generates the console path and encryption key. It backs up the shared lsws
   config first and restores it automatically if the other sites stop answering.
3. Add the five `VPS_*` secrets to the GitHub repository.
4. Push to `main`.

The workflow type-checks, builds, runs the full smoke test across every role,
page and language, then deploys atomically: upload to a timestamped release
directory, swap a symlink, restart, health-check, and roll back automatically if
the health check fails.

## Verification

```bash
npm run typecheck     # strict TypeScript, no unused locals or parameters
npm run smoke         # 5 roles × 8 pages × 3 languages, headless
```

The smoke test fails on any console error, any uncaught exception, any
horizontal overflow at 390px or at the largest text size, and any untranslated
dictionary key leaking into the rendered page.

## Layout

```
src/
  components/   Shell, UI primitives, charts, assistant, markdown renderer
  data/         generated mock.json
  i18n/         en · zh-Hant · zh-Hans dictionaries (360 keys each)
  lib/          types, data access, roles, formatting, assistant context
  pages/        one file per module
server/
  index.js      express app, security headers, rate limits, SPA serving
  vault.js      AES-256-GCM store and scrypt passphrase hashing
  providers.js  Anthropic and OpenAI adapters behind one interface
  prompt.js     assistant system prompt
  admin-page.html
deploy/         systemd unit, OpenLiteSpeed vhost, VPS bootstrap, runbook
scripts/        data generator, reference tables, smoke test
```
