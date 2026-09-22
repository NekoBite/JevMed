# HANDOFF — JevMed ERP

**Project:** JevMed ERP — medical record & operations system with an embedded AI clinical assistant
**Repo root:** `~/Documents/Claude/Projects/Med` (this folder *is* the git working tree)
**Target:** https://jevmed.trilumi.xyz — Hostinger VPS, deployed from GitHub Actions
**Last updated:** 2026-09-22

Companion docs: `README.md` (overview + local run), `deploy/README.md` (full deployment runbook).
A human-facing version of this handoff also exists as a Claude doc titled *JevMed ERP — Handoff & Deployment*.

---

## Goal

Build a demonstrable medical-record ERP for a healthcare network spanning Hong Kong and southern
mainland China, and get it live at `jevmed.trilumi.xyz` with TLS.

Fixed requirements from the client:

- Seven modules over **entirely synthetic** data
- An AI chat assistant embedded in the product
- Assistant API-key management on a **separate, hard-to-guess URL**
- Formal register, legible to elderly users — the audience is board members and senior
  clinicians, many past seventy
- Three interface languages: English, 繁體中文, 简体中文
- Role-based sign-in with a direct-entry bypass button per role (it is a demonstration)

---

## Current Progress

**Built and verified locally. Nothing deployed yet.**

- 58 files, one commit on `main`, clean working tree, no git remote
- `npm install`, `npm run build` and `npm start` all confirmed working on this Mac
- Smoke test passes: 5 roles × 8 pages × 3 languages, headless Chromium
- Assistant has only ever run in **demonstration mode** — no API key has been stored anywhere

Stack: React 19 + TypeScript + Vite + Tailwind; Express on Node 22 behind nginx. No database —
the dataset ships in the bundle, and the only durable server state is `data/vault.enc`.

| Area | State |
|---|---|
| Seven modules | Done |
| Trilingual UI (361 keys × 3) | Done |
| Seeded synthetic dataset | Done — 32 patients, 117 encounters, 1184 labs, 64 invoices |
| Assistant + streaming proxy | Done, untested against a live provider key |
| Encrypted key vault + console | Done |
| CI pipeline | Written, never run |
| VPS bootstrap, systemd, nginx | Written, never run |

---

## What Worked

**A seeded, deterministic data generator.** `scripts/generate-mock-data.mjs` produces
byte-identical output every run, so screenshots stay valid and CI can fail the build when the
committed `mock.json` drifts from the generator. Do not hand-edit the JSON.

**Running the palette validator instead of eyeballing colour.** This caught a real defect before
it shipped — see What Didn't Work.

**Single-hue charts.** Once every chart plotted one series, identity moved to the axis label and
the whole colour-blindness problem disappeared. Keep new charts single-series.

**The smoke test as the actual guardrail.** `scripts/smoke-test.mjs` fails on console errors,
uncaught exceptions, horizontal overflow at 390px or largest text size, and untranslated keys
leaking into the page. It caught the Chinese table-squeeze regression and every layout break.

**Demonstration mode computed from the data, not canned text.** With no key stored the assistant
still answers the prepared questions — abnormal labs, interaction checks, rejected claims,
restock lists — by computing locally and labelling every reply. This makes the system showable to
a board before anyone buys API credit. `src/lib/demo-replies.ts`.

**Fetching model IDs from the provider** rather than hard-coding them. Hard-coded model names rot
and leave the console offering a menu of retired identifiers.

**Working directly in the connected folder** via `device_bash` rather than staging files back and
forth. Install, build and run all happen in place.

---

## What Didn't Work

Recorded so they are not repeated.

**A multi-hue status palette for the claims chart.** Ran `validate_palette.js` against it: amber
vs red measured ΔE 14.2 under normal vision and 4.9 under protanopia — two bars a good number of
the intended readers cannot separate. Abandoned entirely; status colour now appears only as a chip
beside its own text label. **Do not reintroduce colour as a chart's identity channel.**

**Vitals laid out as a two-column `<dl>` of `DefRow`s.** Each `DefRow` has its own internal grid,
so nesting them in a two-column grid made "119/73" overlap "Heart rate". Replaced with a dedicated
`Vital` cell component, label above value. Screenshot review caught this; the smoke test did not.

**A fixed 64px right margin on horizontal bar charts.** Clipped currency labels like `HK$144,850`.
Now computed from the widest formatted label.

**Letting wide tables shrink to fit in Chinese.** CJK wraps at any character, so narrow columns
turned "已達再訂貨點" into a vertical stack one character per line, and the Traditional inventory
page rendered 7513px tall. Fixed with `whitespace-nowrap` on chips plus a `minWidth` on wide
`TableFrame`s so the wrapper scrolls instead. Page height halved.

**Generating `lastVisit` independently of the encounter list.** The summary card claimed a date the
encounters below it contradicted. The generator now derives `lastVisit` from the newest encounter.
Any field shown twice must be derived once.

**`thai-handover-report` skill for this document.** It produces formal Thai delivery letters
(หนังสือส่งมอบงาน) with Buddhist-era dates and signature blocks — correct for Tokenine's Thai
public-sector work, wrong for a Hong Kong engineering handoff.

**Playwright's own pinned Chromium.** `npm i playwright` expects build 1243; this environment has
1194 at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`. The smoke test now falls back to that
path rather than downloading a second browser.

---

## Next Steps

In order. The first three are blocking; nothing can be deployed until they are done.

1. **Create the GitHub repo and push.**
   ```bash
   cd ~/Documents/Claude/Projects/Med
   git remote add origin git@github.com:oscaro-o/jevmed-erp.git
   git push -u origin main
   ```

2. **Add the DNS A record.** In Hostinger hPanel → Domains → DNS for `trilumi.xyz`:
   type `A`, name `jevmed`, pointing at the VPS IPv4, TTL 300. `trilumi.xyz` uses
   `ns1/ns2.dns-parking.com`, so DNS lives in hPanel, not at an external registrar.
   Verify with `dig +short jevmed.trilumi.xyz` before step 3 — certbot fails otherwise.

3. **Bootstrap the VPS.**
   ```bash
   ssh <user>@<vps-ip>
   git clone git@github.com:oscaro-o/jevmed-erp.git /tmp/jevmed-src
   sudo bash /tmp/jevmed-src/deploy/setup-vps.sh
   ```
   It prints the key-console URL **once** — capture it. Recoverable afterwards only by reading
   `VAULT_PATH` from `/opt/jevmed/shared/.env`.

4. **Add five repository secrets** under Settings → Secrets and variables → Actions:
   `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY` (private key), `VPS_SSH_PORT`, `VPS_APP_DIR`.

5. **Push to `main`** to trigger the first deploy.

6. **Finish the passphrase hash.** On a first run `setup-vps.sh` cannot hash the passphrase
   (the app is not deployed yet) and leaves a placeholder. After the first successful deploy:
   ```bash
   cd /opt/jevmed/current
   node server/hash-passphrase.js 'your passphrase'
   # paste into VAULT_PASSPHRASE_HASH in /opt/jevmed/shared/.env, then restart
   ```
   Until this is done the console is disabled and the assistant stays in demonstration mode.

7. **Store an API key** in the console and exercise the live provider path — this is the one
   code path never run end to end.

### Open decisions

- **Authentication.** Role buttons sign in with no password, by design for a demonstration.
  If the board demo runs at the public URL where outsiders could reach it, add a shared passcode
  gate first. Awaiting a decision from OH.
- **Chairman record access.** `src/lib/roles.ts` blocks the Board Chairman from opening an
  identified patient record. Deliberate, and one line to change if the client objects.

### Known limits

- Rate limiting is per-process and in memory — needs a shared store behind multiple instances
- Single instance; a restart is a brief outage, hence the deploy health-check and auto-rollback
- The dataset ships in the bundle (859 KB, 53 KB gzipped) — fine now, wrong if records grow 10×
- Assistant conversations are not persisted and clear on patient change, deliberately
