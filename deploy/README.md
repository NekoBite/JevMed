# Deployment runbook

Target: `jevmed.trilumi.xyz` on the Trilumi Hostinger VPS, deployed from GitHub Actions.

## The host, before anything else

`212.85.27.147` is a shared box. It is **AlmaLinux 9** running **CyberPanel +
OpenLiteSpeed**, and `lsws` owns `:80` and `:443` for `trilumi.xyz` and roughly
two dozen sibling sites. That dictates everything below:

| | This host |
|---|---|
| Packages | `dnf` — **not** `apt` |
| Web server | OpenLiteSpeed — **no nginx**, and none can be installed; it could not bind |
| TLS | `acme.sh` at `/root/.acme.sh` — **not** certbot |
| Firewall | `firewalld` — **not** ufw; 80/443 are already open |
| Node | `/usr/bin/node` (v22), system-wide |
| lsws config | `/usr/local/lsws/conf/httpd_config.conf`, per-vhost `conf/vhosts/<domain>/vhost.conf` |
| Restart | `systemctl restart lsws` |

JevMed runs as a normal systemd service on `127.0.0.1:8787`; OpenLiteSpeed
reverse-proxies to it. Nothing about the other sites changes.

DNS for `trilumi.xyz` is external — authoritative NS is `ns1/ns2.dns-parking.com`,
managed in Hostinger hPanel. **New subdomains cannot be created over SSH.**

---

## 1. Point the subdomain at the VPS

In hPanel → **Domains → DNS / Nameservers** for `trilumi.xyz`, add:

| Type | Name | Points to | TTL |
|------|------|-----------|-----|
| A | `jevmed` | `212.85.27.147` | 300 |

This is the one step nobody can automate from here. Confirm it before going
further — the ACME HTTP-01 challenge fails if the record has not propagated:

```bash
dig +short jevmed.trilumi.xyz
```

It must print `212.85.27.147`.

> **Status: done.** As of 2026-09-22 this record is live and verified on both
> authoritative servers and from 8.8.8.8 / 1.1.1.1 / 9.9.9.9, with no AAAA and no
> CNAME. A stale AAAA would break issuance, since Let's Encrypt prefers IPv6.

## 2. Prepare the deploy key

**Done 2026-09-22.** CI deploys as a dedicated unprivileged account, not root —
this box runs ~24 production sites and a leaked workflow secret must not own it.

- VPS user: **`jevmed-deploy`** (uid 5012, `/home/jevmed-deploy`)
- Key: `~/.ssh/jevmed-deploy` → `VPS_SSH_KEY`

> The key file and the account are deliberately named the same. They are
> different things and confusing them has broken this deploy twice: `VPS_USER`
> is the **Linux account**, never the key filename. A wrong username fails
> *before* publickey auth, so sshd falls through to password attempts and the
> log reads `Permission denied, please try again.` — which looks like a bad key
> but is not. `journalctl -u sshd` on the VPS says `Invalid user <name>` and
> settles it in one line.

Verified: the key authenticates as `jevmed-deploy` and is **refused** as `root`.
The only privilege it gains is the narrow sudoers rule §3 installs — restarting
the `jevmed` unit and reading its journal, nothing else.

To recreate it from scratch:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/jevmed-deploy -C "github-actions@jevmed-erp" -N ""
ssh -i ~/.ssh/claude_deploy root@212.85.27.147 \
  "useradd -m -s /bin/bash jevmed-deploy; \
   install -d -o jevmed-deploy -g jevmed-deploy -m 700 /home/jevmed-deploy/.ssh"
ssh-copy-id -i ~/.ssh/jevmed-deploy.pub -o IdentityFile=~/.ssh/claude_deploy jevmed-deploy@212.85.27.147
```

Store the **private** half with `gh secret set VPS_SSH_KEY < ~/.ssh/jevmed-deploy` —
that never prints the key.

> A GitHub *deploy key* grants a machine read access to the repository — useful
> if you would rather have the VPS pull than have CI push (see §6). The key
> above is the other direction: it lets CI reach the VPS. You need this one for
> the workflow as written.

## 3. Bootstrap the VPS

The repository is **private** and the VPS holds no GitHub credential, so copy the
deploy directory up rather than cloning on the box. That keeps the VPS free of any
credential it does not need:

```bash
# from your Mac, in the repo root
scp -i ~/.ssh/claude_deploy -r deploy root@212.85.27.147:/tmp/jevmed-deploy
ssh -t -i ~/.ssh/claude_deploy root@212.85.27.147 \
  'DEPLOY_USER=jevmed-deploy bash /tmp/jevmed-deploy/setup-vps.sh'
```

**`DEPLOY_USER=jevmed-deploy` is required.** Without it the script falls back to
`logname`, gets `root` over a non-interactive SSH, and then chowns `/opt/jevmed`
to root and writes the sudoers rule for root — so the CI user could not deploy.
`ssh -t` is there because the script prompts for the vault passphrase.

(If you would rather clone on the VPS, add a **read-only** deploy key for it first.)

The script refuses to run if the host is not what it expects — no `dnf`, lsws
not running, an active nginx, or no system-wide Node ≥ 20 all abort before
anything is modified.

It creates the `jevmed` service account and `/opt/jevmed`; generates the
unlisted console path and the AES master key; asks for your vault passphrase and
stores only its scrypt hash; installs the systemd unit and a narrow sudoers
rule; adds the OpenLiteSpeed vhost; and issues the certificate with `acme.sh`.

**The one shared file it edits is `httpd_config.conf`** — a `virtualHost` block
plus one `map` line in each of the three listeners (`Default`, `SSL`,
`SSL IPv6`). Before editing it takes a timestamped backup, and afterwards it
restarts lsws and re-fetches `https://trilumi.xyz/`. If lsws does not come back
or that canary stops answering, it **restores the backup, restarts, and exits
non-zero**. Re-running the script is safe; the edit is idempotent.

**Write down the console URL it prints.** It is not shown again, and it is the
only way into the key-management console. If you lose it, read `VAULT_PATH` from
`/opt/jevmed/shared/.env`.

On a first run the application is not deployed yet, so the script cannot hash
your passphrase. It says so and leaves a placeholder. After the first deploy:

```bash
cd /opt/jevmed/current
node server/hash-passphrase.js 'your passphrase'
sudo sed -i "s|^VAULT_PASSPHRASE_HASH=.*|VAULT_PASSPHRASE_HASH=<paste>|" /opt/jevmed/shared/.env
sudo systemctl restart jevmed
```

Until that is done the console stays disabled and the assistant stays in
demonstration mode.

## 4. Add the repository secrets

**Settings → Secrets and variables → Actions → New repository secret**

| Secret | Value |
|---|---|
| `VPS_HOST` | `212.85.27.147` |
| `VPS_USER` | `jevmed-deploy` |
| `VPS_SSH_KEY` | contents of `~/.ssh/jevmed-deploy` — set it with `gh secret set VPS_SSH_KEY < ~/.ssh/jevmed-deploy` |
| `VPS_SSH_PORT` | `22` — *optional*, the workflow defaults to 22 if unset |
| `VPS_APP_DIR` | `/opt/jevmed` — *optional*, the workflow defaults to this if unset |

The `deploy` job targets a `production` environment, so you can add a required
reviewer under **Settings → Environments** if you want a human gate before
anything reaches the box.

## 5. Deploy

Push to `main`. The workflow:

1. regenerates the synthetic dataset and fails if the committed copy has drifted
2. type-checks and builds
3. runs the smoke test across 5 roles × 8 pages × 3 languages and uploads the
   screenshots as an artifact
4. packages `dist/` + `server/` + the lockfile
5. uploads to `/opt/jevmed/releases/<timestamp>`, installs production
   dependencies, links the shared `.env` and `data/`, swaps `current`, restarts
6. health-checks, and **rolls back to the previous release automatically** if the
   check fails
7. prunes all but the last five releases

Nothing in the deploy job touches lsws. The vhost points at a fixed port; only
the process behind it is replaced.

## 6. Alternative: have the VPS pull

If you would rather not hold an SSH private key in GitHub, put a **deploy key**
(read-only) on the repository, clone to the VPS, and replace the `deploy` job
with a webhook or a timer that runs:

```bash
cd /opt/jevmed/src && git pull --ff-only \
  && npm ci && npm run build \
  && rsync -a --delete dist/ /opt/jevmed/current/dist/ \
  && sudo systemctl restart jevmed
```

This trades CI-side verification for a smaller blast radius. The workflow's
`verify` job still runs on every push either way.

---

## Operating notes

**Logs**

```bash
sudo journalctl -u jevmed -f
sudo tail -f /home/trilumi.xyz/logs/jevmed.error_log
sudo tail -f /usr/local/lsws/logs/error.log
```

**Restart / status**

```bash
sudo systemctl restart jevmed
sudo systemctl status jevmed
curl -s localhost:8787/api/health
```

**Manual rollback**

```bash
ls -1dt /opt/jevmed/releases/*/          # newest first
sudo -u <deploy-user> ln -sfn /opt/jevmed/releases/<stamp> /opt/jevmed/current
sudo systemctl restart jevmed
```

**Rolling back the lsws config** — `setup-vps.sh` leaves
`/usr/local/lsws/conf/httpd_config.conf.bak-jevmed-<timestamp>`:

```bash
sudo cp -a /usr/local/lsws/conf/httpd_config.conf.bak-jevmed-<ts> \
           /usr/local/lsws/conf/httpd_config.conf
sudo systemctl restart lsws
```

**Rotating the API key** — open the console, paste the new key, test, save. The
old ciphertext is overwritten in place.

**Rotating the console path** — edit `VAULT_PATH` in `/opt/jevmed/shared/.env`
and restart. The stored API key is unaffected.

**Rotating the master key** — generate a new `VAULT_MASTER_KEY`, restart, and
re-enter the API key in the console. The old vault file becomes unreadable,
which is the point; the application treats an undecryptable vault as absent and
falls back to demonstration mode rather than failing.

**Certificate renewal** — `acme.sh` installs a cron entry for `root` and the
cert is installed with `--reloadcmd "systemctl restart lsws"`, so renewals
reload themselves. Check with `crontab -l | grep acme` and
`/root/.acme.sh/acme.sh --list`.

## Troubleshooting

| Symptom | Cause |
|---|---|
| Console path returns the app instead of the sign-in card | `VAULT_PATH` or `VAULT_PASSPHRASE_HASH` is unset; the console is disabled. Check `journalctl -u jevmed` — it prints a warning line per problem at boot. |
| Assistant replies arrive all at once, not streamed | lsws is buffering. Confirm `respBuffer 0` is still on the `jevmed_app` extprocessor in the vhost, then restart lsws. |
| 503 from the domain, app healthy on `localhost:8787` | The vhost or a listener `map` is missing. `grep -n jevmed /usr/local/lsws/conf/httpd_config.conf` should show a `virtualHost` block and **three** `map` lines. |
| Domain 404s or serves another site | The `map` line went into only one listener. Same check as above. |
| `acme.sh` fails the challenge | The A record has not propagated, or points elsewhere. `dig +short jevmed.trilumi.xyz` must equal `212.85.27.147`. |
| Deploy fails at `sudo -n systemctl restart` | The sudoers rule is missing or names a different user. Check `/etc/sudoers.d/jevmed-deploy` — it pins exact argument lists, so a changed command in the workflow will not match. |
| "The provider rejected that key" | Wrong provider selected for the key, or the key lacks model-list permission. |
| Assistant says it is in demonstration mode after saving a key | The master key changed since the key was stored, so the vault no longer decrypts. Re-enter the key. |
