# Deployment runbook

Target: `jevmed.trilumi.xyz` on a Hostinger VPS, deployed from GitHub Actions.

The domain `trilumi.xyz` currently uses Hostinger's nameservers
(`ns1.dns-parking.com` / `ns2.dns-parking.com`), so DNS is managed in hPanel.

---

## 1. Point the subdomain at the VPS

In hPanel → **Domains → DNS / Nameservers** for `trilumi.xyz`, add:

| Type | Name | Points to | TTL |
|------|------|-----------|-----|
| A | `jevmed` | *your VPS IPv4* | 300 |

Add an `AAAA` record for `jevmed` too if the VPS has IPv6.

Confirm before going further — certbot's challenge fails if the record has not
propagated:

```bash
dig +short jevmed.trilumi.xyz
```

## 2. Prepare the deploy key

On your own machine:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/jevmed_deploy -C "github-actions@jevmed" -N ""
ssh-copy-id -i ~/.ssh/jevmed_deploy.pub <user>@<vps-ip>
```

`~/.ssh/jevmed_deploy` (the **private** half) becomes the `VPS_SSH_KEY` secret.

> A GitHub *deploy key* grants a machine read access to the repository — useful
> if you would rather have the VPS pull than have CI push (see §6). The key
> above is the other direction: it lets CI reach the VPS. You need this one for
> the workflow as written.

## 3. Bootstrap the VPS

```bash
ssh <user>@<vps-ip>
git clone git@github.com:<you>/jevmed-erp.git /tmp/jevmed-src
sudo bash /tmp/jevmed-src/deploy/setup-vps.sh
```

It installs Node 22, nginx and certbot; creates the `jevmed` service account and
`/opt/jevmed`; generates the unlisted console path and the AES master key; asks
for your vault passphrase and stores only its scrypt hash; installs the systemd
unit, the nginx vhost and a narrow sudoers rule; and obtains the certificate.

**Write down the console URL it prints.** It is not shown again, and it is the
only way into the key-management console. If you lose it, read `VAULT_PATH` from
`/opt/jevmed/shared/.env`.

On a first run the application is not deployed yet, so the script cannot hash
your passphrase. It says so and leaves a placeholder. After the first deploy:

```bash
cd /opt/jevmed/current
node server/hash-passphrase.js 'your passphrase'
sudo -u jevmed sed -i "s|^VAULT_PASSPHRASE_HASH=.*|VAULT_PASSPHRASE_HASH=<paste>|" /opt/jevmed/shared/.env
sudo systemctl restart jevmed
```

## 4. Add the repository secrets

**Settings → Secrets and variables → Actions → New repository secret**

| Secret | Value |
|---|---|
| `VPS_HOST` | VPS IP or hostname |
| `VPS_USER` | the SSH user from §2 |
| `VPS_SSH_KEY` | contents of `~/.ssh/jevmed_deploy` (the private key, including both header lines) |
| `VPS_SSH_PORT` | `22`, or your custom port |
| `VPS_APP_DIR` | `/opt/jevmed` |

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
sudo tail -f /var/log/nginx/jevmed.error.log
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

**Rotating the API key** — open the console, paste the new key, test, save. The
old ciphertext is overwritten in place.

**Rotating the console path** — edit `VAULT_PATH` in `/opt/jevmed/shared/.env`
and restart. The stored API key is unaffected.

**Rotating the master key** — generate a new `VAULT_MASTER_KEY`, restart, and
re-enter the API key in the console. The old vault file becomes unreadable,
which is the point; the application treats an undecryptable vault as absent and
falls back to demonstration mode rather than failing.

**Certificate renewal** — certbot installs its own timer. Check it with
`systemctl list-timers | grep certbot`.

## Troubleshooting

| Symptom | Cause |
|---|---|
| Console path returns the app instead of the sign-in card | `VAULT_PATH` or `VAULT_PASSPHRASE_HASH` is unset; the console is disabled. Check `journalctl -u jevmed` — it prints a warning line per problem at boot. |
| Assistant replies arrive all at once, not streamed | nginx is buffering. Confirm the `location /api/chat` block with `proxy_buffering off` is present and reload nginx. |
| "The provider rejected that key" | Wrong provider selected for the key, or the key lacks model-list permission. |
| Assistant says it is in demonstration mode after saving a key | The master key changed since the key was stored, so the vault no longer decrypts. Re-enter the key. |
| certbot fails the challenge | The A record has not propagated, or points elsewhere. `dig +short jevmed.trilumi.xyz` must equal the VPS IP. |
| Deploy fails at `sudo -n systemctl restart` | The sudoers rule is missing or names a different user. Re-run `setup-vps.sh` as the deploy user, or check `/etc/sudoers.d/jevmed-deploy`. |
