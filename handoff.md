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

**Deployed and live at https://jevmed.trilumi.xyz.**

- Clean working tree on `main`, pushed to `github.com/NekoBite/JevMed` (private)
- DNS live: `jevmed.trilumi.xyz` → `212.85.27.147`, verified authoritatively
- **First successful deploy 2026-09-22** (run 35755860278). Verified from outside:
  `GET /` → 200 in 190ms, TLS verifies, `<title>JevMed · Medical Record System</title>`,
  asset hashes matching the bundle CI built. `/api/health` →
  `{"ok":true,"vaultConfigured":false,"problems":0}`
- All neighbour sites (`trilumi.xyz`, `reccontent`, `viridis`) still 200 throughout
- `npm ci`, `npm run build`, `npm start` and the smoke test all confirmed **on this Mac**
- Smoke test passes: 64 checks — 5 roles × 8 pages × 3 languages, headless Chromium
- Assistant is still in **demonstration mode** — no API key has been stored anywhere,
  and `vaultConfigured:false` because the passphrase hash is not set yet

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
| CI pipeline | **Both jobs green.** `verify` + `deploy` end to end |
| VPS bootstrap, systemd, OpenLiteSpeed vhost | **Done 2026-09-22**; TLS live to 2026-12-21, idempotent on re-run |
| Live deployment | **Done 2026-09-22** — 200, correct bundle, health OK |
| Key console + live provider call | **Not done** — passphrase hash unset; the only untested path |

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

**Eight failed deploys, none of them a code fault.** `verify` passed every time. The
causes, in order: `VPS_USER` set to a GitHub deploy-key name (`trilumi-ci-deploy`); then to
a key *filename* (`jevmed_ci`); then a broken `VPS_HOST`; then four attempts where
`VPS_SSH_KEY` held the key body **without its `-----BEGIN-----`/`-----END-----` lines**.

Two things would have saved hours. First, `VPS_USER` is a **Linux account**, never a key
filename — and a wrong username is rejected *before* publickey auth, so sshd falls back to
passwords and the client prints `Permission denied, please try again.`, which looks like a
bad key. `journalctl -u sshd` on the VPS says `Invalid user <name>` and settles it in one
line. Second, OpenSSH reports an unparseable key only as `error in libcrypto`, which reads
as *rejected* rather than *unreadable*.

The fix was to make the workflow diagnose itself rather than keep guessing: it validates the
key with `ssh-keygen -y` before any ssh call, prints the fingerprint on success, and on
failure reports byte count, line count and CR count. Those numbers gave the answer
immediately — 349 bytes / 5 lines against 419 / 7, and the markers are exactly 70 bytes and
2 lines. It now accepts the key as a PEM, as base64-encoded PEM, or as a bare body it
rewraps. **Instrument the failure before iterating on it.**

**Following generic SSH setup instructions for a scoped deploy key.** A snippet written for
`root@host` appended the CI key to `/root/.ssh/authorized_keys`, silently handing GitHub
Actions root on a box serving ~24 production sites and making the narrow sudoers rule
pointless. Removed by fingerprint, with the rewrite refusing to install unless the admin key
survived; backup at `/root/.ssh/authorized_keys.bak-20260922164332`. Re-verified on fresh
connections: CI key → root **denied**, CI key → `jevmed-deploy` **OK**.

**Playwright's own pinned Chromium.** In the Linux container the first session ran in, `playwright`
expected build 1243 while only 1194 was present at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`.
The smoke test falls back to that path when it exists rather than downloading a second browser. On
this Mac the path is absent and Playwright's own Chromium 1243 is used, so the fallback is inert —
leave it in for CI and container runs.

---

## Next Steps

### Done — 2026-09-22

1. **DNS A record.** `jevmed.trilumi.xyz` → `212.85.27.147`, TTL 3300. Verified on both
   authoritative servers (`ns1/ns2.dns-parking.com`) and from 8.8.8.8 / 1.1.1.1 / 9.9.9.9.
   No AAAA and no CNAME, which matters — Let's Encrypt prefers IPv6 and would fail the
   challenge against a stale AAAA.

2. **VPS bootstrap.** Ran with `DEPLOY_USER=jevmed-deploy`. Created `/opt/jevmed`, the
   `jevmed` service account, the systemd unit, the sudoers rule, the OpenLiteSpeed vhost
   (`virtualHost` block + a `map` in all three listeners), and a Let's Encrypt cert valid to
   **2026-12-21**. Canary held throughout: `https://trilumi.xyz/` → 200 before and after.
   Re-ran to confirm idempotency — no further config change.

3. **Repository secrets and first deploy** (run 35755860278). `VPS_HOST`, `VPS_USER` and
   `VPS_SSH_KEY` set on `NekoBite/JevMed`. `VPS_SSH_PORT` and `VPS_APP_DIR` deliberately
   unset — the workflow defaults them to `22` and `/opt/jevmed`, and an unset secret renders
   as an empty string that `${VAR:-default}` handles. Deploy is atomic: upload to
   `releases/<stamp>`, swap `current`, restart, health-check, auto-rollback, prune to five.

### Remaining

1. **Decide on access control before showing anyone the URL.** See Open decisions — this is
   now live on the public internet, which changes the question.

2. **Set the passphrase hash.** Until this is done the key console is disabled and the
   assistant stays in demonstration mode.
   ```bash
   ssh -i ~/.ssh/claude_deploy root@212.85.27.147
   cd /opt/jevmed/current && node server/hash-passphrase.js 'your passphrase'
   # paste into VAULT_PASSPHRASE_HASH in /opt/jevmed/shared/.env
   systemctl restart jevmed
   ```
   Confirm with `curl -s https://jevmed.trilumi.xyz/api/health` — `vaultConfigured` should
   flip to `true`.

3. **Store an API key** in the console and exercise the live provider path. This is the one
   code path never run end to end. The console URL is `VAULT_PATH` in
   `/opt/jevmed/shared/.env`; it is deliberately not recorded in this repo.

### Open decisions

- **Authentication — now urgent, and the premise has changed.** Role buttons sign in with no
  password, which was a reasonable choice while this ran on a laptop. It is now reachable by
  anyone on the internet at `https://jevmed.trilumi.xyz`, and any visitor can click a role and
  browse the whole record system. The data is entirely synthetic and the footer says so on
  every page, so this is not a patient-privacy breach — but a medical-record UI sitting open
  on a public URL invites misreading, and search engines will index it. Cheapest fixes, in
  order: a shared passcode gate in front of the app; HTTP basic auth at the lsws vhost; or an
  IP allowlist for the demo. `public/robots.txt` already ships `Disallow: /` and is live, so
  compliant crawlers will skip it; `X-Robots-Tag: noindex` is absent, which only matters for
  crawlers that ignore robots.txt. Neither keeps a person out. Awaiting a decision from OH.
- **Chairman record access.** `src/lib/roles.ts` blocks the Board Chairman from opening an
  identified patient record. Deliberate, and one line to change if the client objects.
- **Deploy account.** CI deploys as `jevmed-deploy` (uid 5012) on the VPS, not root —
  the box runs ~24 production sites. Key `~/.ssh/jevmed-deploy`, verified to authenticate as
  that user and be refused as root. Its only privilege is the sudoers rule `setup-vps.sh`
  installs: restart the `jevmed` unit, read its journal, nothing else.
- **Repository owner.** Pushed to `NekoBite/JevMed` because that is the authenticated
  account; the first handoff named `oscaro-o/jevmed-erp`. Transfer if the client wants it
  under their own account. An earlier `NekoBite/jevmed-erp` was deleted — if you find a
  stale reference to it anywhere, this is the repo it means.

### Known limits

- Rate limiting is per-process and in memory — needs a shared store behind multiple instances
- The `production` environment on the repo has no required reviewer, so any push to `main`
  deploys. Add one under Settings → Environments if that is not wanted
- The app shares a box with ~24 other sites. A bad `httpd_config.conf` edit takes them all
  down, which is why `setup-vps.sh` backs up and canary-checks rather than editing in place
- Single instance; a restart is a brief outage, hence the deploy health-check and auto-rollback
- The dataset ships in the bundle (859 KB, 53 KB gzipped) — fine now, wrong if records grow 10×
- Assistant conversations are not persisted and clear on patient change, deliberately
