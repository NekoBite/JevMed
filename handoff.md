# HANDOFF — JevMed ERP

**Project:** JevMed ERP — medical record & operations system with an embedded AI clinical assistant
**Repo root:** `~/Documents/Claude/Projects/Med` (this folder *is* the git working tree)
**Target:** https://jevmed.trilumi.xyz — Hostinger VPS, deployed from GitHub Actions
**Last updated:** 2026-09-22 (second session)

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

- Clean working tree on `main`, pushed to `github.com/NekoBite/jevmed-erp` (private)
- DNS live: `jevmed.trilumi.xyz` → `212.85.27.147`, verified authoritatively
- `npm ci`, `npm run build`, `npm start` and the smoke test all confirmed **on this Mac**
- Smoke test passes: 64 checks — 5 roles × 8 pages × 3 languages, headless Chromium
- Assistant has only ever run in **demonstration mode** — no API key has been stored anywhere

Stack: React 19 + TypeScript + Vite + Tailwind; Express on Node 22 behind **OpenLiteSpeed**.
No database — the dataset ships in the bundle, and the only durable server state is
`data/vault.enc`.

| Area | State |
|---|---|
| Seven modules | Done |
| Trilingual UI (361 keys × 3) | Done |
| Seeded synthetic dataset | Done — 32 patients, 117 encounters, 1184 labs, 64 invoices |
| Assistant + streaming proxy | Done, untested against a live provider key |
| Encrypted key vault + console | Done |
| CI pipeline | `verify` green on a clean runner; `deploy` never succeeded (no secrets yet) |
| VPS bootstrap, systemd, OpenLiteSpeed vhost | Rewritten for the real host; dry-run verified, not yet run on the VPS |

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

**Assuming the deploy target without looking at it.** The entire first-pass deploy layer —
`setup-vps.sh`, an nginx vhost, `certbot --nginx`, `ufw` — was written for Ubuntu + nginx.
The actual host, `212.85.27.147`, is **AlmaLinux 9 running CyberPanel + OpenLiteSpeed**, and
`lsws` owns `:80` and `:443` for `trilumi.xyz` and ~24 sibling sites. The script would have
died on `apt-get` before touching anything, so nothing was damaged — but the plan was wrong
end to end. Replaced with a dnf/OpenLiteSpeed/acme.sh version. **Probe the host before
writing anything that configures it.**

**Trusting "confirmed working on this Mac".** It was not. `node_modules` held
**linux-arm64** binaries from the container the previous session actually ran in, so
`npm run build` failed on a missing `@rollup/rollup-darwin-arm64`. A clean `npm ci` fixed it.
Re-verify a handoff's green ticks on the machine you are on.

**`StartLimitIntervalSec` / `StartLimitBurst` under `[Service]`.** They are `[Unit]`
directives; systemd logs "Unknown key name" and ignores them, so the crash-loop guard the
comment promised did nothing. Moved to `[Unit]`.

**A trailing wildcard in the sudoers rule.** `journalctl -u jevmed *` lets the deploy user
pass arbitrary flags to journalctl as root, and journalctl's pager escapes to a root shell —
a full privilege escalation for any non-root deploy user. Now pinned to exact argument lists.

**Playwright's own pinned Chromium.** In the Linux container the first session ran in, `playwright`
expected build 1243 while only 1194 was present at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`.
The smoke test falls back to that path when it exists rather than downloading a second browser. On
this Mac the path is absent and Playwright's own Chromium 1243 is used, so the fallback is inert —
leave it in for CI and container runs.

---

## Next Steps

~~1. **Add the DNS A record.**~~ **Done 2026-09-22.** `jevmed.trilumi.xyz` → `212.85.27.147`,
   A record, TTL 3300. Verified on both authoritative servers (`ns1/ns2.dns-parking.com`) and
   from 8.8.8.8 / 1.1.1.1 / 9.9.9.9. No AAAA and no CNAME, which matters — Let's Encrypt
   prefers IPv6 and would fail the challenge against a stale AAAA.

1. **Bootstrap the VPS.** The repo is private and the VPS holds no GitHub credential, so
   copy the deploy files up rather than cloning — that keeps the box credential-free:
   ```bash
   # from this Mac, in the repo root
   scp -i ~/.ssh/claude_deploy -r deploy root@212.85.27.147:/tmp/jevmed-deploy
   ssh -t -i ~/.ssh/claude_deploy root@212.85.27.147 \
     'DEPLOY_USER=jevmed-deploy bash /tmp/jevmed-deploy/setup-vps.sh'
   ```
   `DEPLOY_USER=jevmed-deploy` is **required** — without it the script sees `root` over a
   non-interactive SSH and grants the sudoers rule to the wrong account. `-t` is for the
   passphrase prompt.
   It refuses to run on the wrong kind of host, backs up `httpd_config.conf`, and restores it
   automatically if `https://trilumi.xyz/` stops answering. It prints the key-console URL
   **once** — capture it. Recoverable afterwards only by reading `VAULT_PATH` from
   `/opt/jevmed/shared/.env`.

2. **Repository secrets.** `VPS_HOST` and `VPS_USER` are set. `VPS_SSH_PORT` and
   `VPS_APP_DIR` are unset and can stay that way — the workflow defaults them to `22` and
   `/opt/jevmed`. **`VPS_SSH_KEY` still holds the wrong key** and must be replaced with the
   dedicated CI key:
   ```bash
   gh secret set VPS_SSH_KEY --repo NekoBite/jevmed-erp < ~/.ssh/jevmed_ci
   ```

3. **Re-run the workflow** once the secrets exist. CI's `verify` job already passes on a
   clean runner (run 35746882630); only `deploy` has never succeeded.

4. **Finish the passphrase hash.** On a first run `setup-vps.sh` cannot hash the passphrase
   (the app is not deployed yet) and leaves a placeholder. After the first successful deploy:
   ```bash
   cd /opt/jevmed/current
   node server/hash-passphrase.js 'your passphrase'
   # paste into VAULT_PASSPHRASE_HASH in /opt/jevmed/shared/.env, then restart
   ```
   Until this is done the console is disabled and the assistant stays in demonstration mode.

5. **Store an API key** in the console and exercise the live provider path — this is the one
   code path never run end to end.

### Open decisions

- **Authentication.** Role buttons sign in with no password, by design for a demonstration.
  If the board demo runs at the public URL where outsiders could reach it, add a shared passcode
  gate first. Awaiting a decision from OH.
- **Chairman record access.** `src/lib/roles.ts` blocks the Board Chairman from opening an
  identified patient record. Deliberate, and one line to change if the client objects.
- **Deploy account.** CI deploys as `jevmed-deploy` (uid 5012) on the VPS, not root —
  the box runs ~24 production sites. Key `~/.ssh/jevmed_ci`, verified to authenticate as
  that user and be refused as root. Its only privilege is the sudoers rule `setup-vps.sh`
  installs: restart the `jevmed` unit, read its journal, nothing else.
- **Repository owner.** Pushed to `NekoBite/jevmed-erp` because that is the authenticated
  account; the first handoff named `oscaro-o/jevmed-erp`. Transfer if the client wants it
  under their own account.

### Known limits

- Rate limiting is per-process and in memory — needs a shared store behind multiple instances
- The app shares a box with ~24 other sites. A bad `httpd_config.conf` edit takes them all
  down, which is why `setup-vps.sh` backs up and canary-checks rather than editing in place
- Single instance; a restart is a brief outage, hence the deploy health-check and auto-rollback
- The dataset ships in the bundle (859 KB, 53 KB gzipped) — fine now, wrong if records grow 10×
- Assistant conversations are not persisted and clear on patient change, deliberately
