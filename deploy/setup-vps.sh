#!/usr/bin/env bash
#
# One-time bootstrap for the JevMed ERP on the Trilumi Hostinger VPS.
# Safe to run more than once: every step checks before it acts.
#
#   ssh -i ~/.ssh/claude_deploy root@212.85.27.147
#   git clone git@github.com:NekoBite/jevmed-erp.git /tmp/jevmed-src
#   sudo bash /tmp/jevmed-src/deploy/setup-vps.sh
#
# ── Read this before running ─────────────────────────────────────────────────
# This host is AlmaLinux 9 running CyberPanel + OpenLiteSpeed, and lsws owns
# :80 and :443 for every trilumi.xyz site and its siblings. So:
#
#   · package manager is dnf, not apt
#   · there is NO nginx and none gets installed — it could not bind anyway
#   · TLS is issued with acme.sh, not certbot
#   · the firewall is firewalld, not ufw, and 80/443 are already open
#
# The one shared file this touches is /usr/local/lsws/conf/httpd_config.conf.
# It is backed up first, and if lsws or the existing sites fail to come back
# the backup is restored automatically before this script exits non-zero.
#
# What it does:
#   · verifies the host, Node and DNS before changing anything
#   · creates the jevmed service account and /opt/jevmed
#   · generates the unlisted key-console path and the encryption key
#   · asks you for the vault passphrase and stores only its scrypt hash
#   · installs the systemd unit and a narrow sudoers rule for the deploy user
#   · adds an OpenLiteSpeed proxy vhost in front of the Node process
#   · obtains the TLS certificate with acme.sh and enables it
#
set -euo pipefail

DOMAIN="${DOMAIN:-jevmed.trilumi.xyz}"
APP_DIR="${APP_DIR:-/opt/jevmed}"
APP_USER="${APP_USER:-jevmed}"
DEPLOY_USER="${DEPLOY_USER:-$(logname 2>/dev/null || echo root)}"
PORT="${PORT:-8787}"

LSWS_ROOT=/usr/local/lsws
LSWS_CONF="$LSWS_ROOT/conf/httpd_config.conf"
VHOST_DIR="$LSWS_ROOT/conf/vhosts/$DOMAIN"
ACME_WEBROOT="$LSWS_ROOT/Example/html"
ACME_SH=/root/.acme.sh/acme.sh
VH_ROOT=/home/trilumi.xyz
DOCROOT="$VH_ROOT/$(echo "$DOMAIN" | cut -d. -f1)"
SITE_OWNER=trilu9898
# A site that must still be serving when this script finishes. If it is not,
# the lsws config edit gets rolled back.
CANARY="${CANARY:-https://trilumi.xyz/}"
NODE_MIN=20

bold() { printf '\033[1m%s\033[0m\n' "$*"; }
step() { printf '\n\033[1;34m▸ %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m  ! %s\033[0m\n' "$*"; }
die()  { printf '\033[1;31m  ✗ %s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "Run this with sudo."

# ─────────────────────────────────────────────────────────────────────────────
step "Preflight"

command -v dnf >/dev/null 2>&1 || die "No dnf. This script targets AlmaLinux/RHEL 9; \
the host looks like something else. Do not run the old apt/nginx version here."

[ -f "$LSWS_CONF" ] || die "$LSWS_CONF not found — is OpenLiteSpeed installed?"
systemctl is-active --quiet lsws || die "lsws is not running. Refusing to change its \
config while it is down; start it first and re-run."

if command -v nginx >/dev/null 2>&1 && systemctl is-active --quiet nginx; then
  die "nginx is active and will be fighting lsws for :80/:443. Resolve that first."
fi

# /usr/bin/node specifically: the systemd unit runs as $APP_USER with
# ProtectHome=true, so a node living under /root is invisible to the service
# even when `node -v` works fine in your root shell.
[ -x /usr/bin/node ] || die "/usr/bin/node is missing. Install a system-wide Node \
>= $NODE_MIN (dnf module enable nodejs:22 && dnf install -y nodejs) and re-run."
NODE_MAJOR_FOUND="$(/usr/bin/node -v | sed 's/v\([0-9]*\).*/\1/')"
[ "$NODE_MAJOR_FOUND" -ge "$NODE_MIN" ] || die "/usr/bin/node is v$NODE_MAJOR_FOUND, \
need >= $NODE_MIN."
echo "  node $(/usr/bin/node -v) at /usr/bin/node"

for pkg in openssl curl tar; do
  command -v "$pkg" >/dev/null 2>&1 || dnf install -y -q "$pkg"
done

RESOLVED="$(getent hosts "$DOMAIN" | awk '{print $1}' | head -1 || true)"
MYIP="$(curl -fsS --max-time 10 https://api.ipify.org 2>/dev/null || true)"
if [ -z "$RESOLVED" ]; then
  warn "$DOMAIN does not resolve yet."
  warn "Add this A record in Hostinger hPanel → Domains → DNS for trilumi.xyz:"
  warn "    Type A · Name ${DOMAIN%%.*} · Points to ${MYIP:-<this server IP>} · TTL 300"
  warn "DNS is external (ns1/ns2.dns-parking.com) and cannot be set over SSH."
  warn "Continuing — everything except the TLS certificate will be set up."
elif [ -n "$MYIP" ] && [ "$RESOLVED" != "$MYIP" ]; then
  warn "$DOMAIN resolves to $RESOLVED but this server is $MYIP."
  warn "The certificate step will be skipped until the A record is corrected."
else
  echo "  $DOMAIN → $RESOLVED ✓"
fi

# ─────────────────────────────────────────────────────────────────────────────
step "Creating the service account and directories"
id -u "$APP_USER" >/dev/null 2>&1 || \
  useradd --system --home-dir "$APP_DIR" --shell /sbin/nologin "$APP_USER"
mkdir -p "$APP_DIR/releases" "$APP_DIR/shared/data"
# The deploy user writes releases; the service account reads them and owns the
# vault directory. Nothing in this tree is world-readable.
chown -R "$DEPLOY_USER":"$APP_USER" "$APP_DIR"
chown -R "$APP_USER":"$APP_USER" "$APP_DIR/shared/data"
chmod 750 "$APP_DIR"
chmod 700 "$APP_DIR/shared/data"
echo "  $APP_DIR ready, service account $APP_USER"

# ─────────────────────────────────────────────────────────────────────────────
step "Configuring the environment"
ENV_FILE="$APP_DIR/shared/.env"
if [ -f "$ENV_FILE" ]; then
  warn "$ENV_FILE already exists — leaving it untouched."
  warn "Delete it and re-run this script if you want fresh secrets."
  # The recursive chown above will have taken this file with it; systemd reads
  # EnvironmentFile as root so it still works, but put it back anyway.
  chown "$APP_USER":"$APP_USER" "$ENV_FILE"
  chmod 600 "$ENV_FILE"
else
  VAULT_PATH="ops-$(openssl rand -hex 24)"
  MASTER_KEY="$(openssl rand -hex 32)"

  echo
  bold "Choose the passphrase that unlocks the key-management console."
  bold "It is never stored — only a scrypt hash of it is."
  while :; do
    read -rsp "  Passphrase (16+ characters): " PASS1; echo
    read -rsp "  Repeat: " PASS2; echo
    [ "$PASS1" = "$PASS2" ] || { warn "They do not match."; continue; }
    [ "${#PASS1}" -ge 16 ] || { warn "Too short — use at least 16 characters."; continue; }
    break
  done

  # Hash it with the application's own function so the format always matches.
  HASH=""
  if [ -f "$APP_DIR/current/server/hash-passphrase.js" ]; then
    HASH="$(cd "$APP_DIR/current" && /usr/bin/node server/hash-passphrase.js "$PASS1" 2>/dev/null || true)"
  fi
  if [ -z "$HASH" ]; then
    warn "The application is not deployed yet, so the passphrase hash cannot be"
    warn "generated here. Run this on the VPS after the first deploy:"
    warn "    cd $APP_DIR/current && node server/hash-passphrase.js 'your passphrase'"
    warn "then paste the result into VAULT_PASSPHRASE_HASH in $ENV_FILE and"
    warn "    systemctl restart jevmed"
    HASH="PASTE_THE_HASH_HERE"
  fi
  unset PASS1 PASS2

  # Written with a restrictive umask so the secrets are never briefly readable.
  ( umask 077; cat > "$ENV_FILE" <<ENVEOF
# JevMed ERP — generated by setup-vps.sh on $(date -u +%Y-%m-%dT%H:%M:%SZ)
# Keep this file out of version control. Losing VAULT_MASTER_KEY only means
# re-entering the provider API key; losing this whole file means regenerating
# the console path as well.
PORT=$PORT
PUBLIC_ORIGIN=https://$DOMAIN
DATA_DIR=$APP_DIR/shared/data
VAULT_PATH=$VAULT_PATH
VAULT_MASTER_KEY=$MASTER_KEY
VAULT_PASSPHRASE_HASH=$HASH
ENVEOF
  )
  chown "$APP_USER":"$APP_USER" "$ENV_FILE"
  chmod 600 "$ENV_FILE"

  echo
  bold "════════════════════════════════════════════════════════════════════"
  bold " Key-management console — write this down now, it is not shown again"
  bold "════════════════════════════════════════════════════════════════════"
  echo "   https://$DOMAIN/$VAULT_PATH"
  bold "════════════════════════════════════════════════════════════════════"
  echo "   (recoverable later only by reading VAULT_PATH from $ENV_FILE)"
  echo
fi

# ─────────────────────────────────────────────────────────────────────────────
step "Installing the systemd unit"
UNIT_SRC="$(cd "$(dirname "$0")" && pwd)/jevmed.service"
[ -f "$UNIT_SRC" ] || UNIT_SRC="$APP_DIR/current/deploy/jevmed.service"
if [ -f "$UNIT_SRC" ]; then
  sed -e "s#/opt/jevmed#$APP_DIR#g" \
      -e "s#^User=.*#User=$APP_USER#" \
      -e "s#^Group=.*#Group=$APP_USER#" \
      "$UNIT_SRC" > /etc/systemd/system/jevmed.service
  systemctl daemon-reload
  systemctl enable jevmed >/dev/null 2>&1 || true
  echo "  installed /etc/systemd/system/jevmed.service"
  if command -v systemd-analyze >/dev/null 2>&1; then
    systemd-analyze verify /etc/systemd/system/jevmed.service 2>&1 | sed 's/^/    /' || true
  fi
else
  warn "jevmed.service not found — copy deploy/jevmed.service to /etc/systemd/system/ manually."
fi

# ─────────────────────────────────────────────────────────────────────────────
step "Granting the deploy user permission to restart the service"
# The only privileged actions CI performs, pinned to exact argument lists.
# No trailing wildcard: `journalctl -u jevmed *` would let the deploy user pass
# arbitrary flags to journalctl as root, and journalctl's pager escapes to a
# root shell. Both /bin and /usr/bin are listed because this host merges them
# and sudo matches the literal path it resolved from PATH.
cat > /etc/sudoers.d/jevmed-deploy <<SUDOEOF
$DEPLOY_USER ALL=(root) NOPASSWD: /bin/systemctl restart jevmed, /usr/bin/systemctl restart jevmed, /bin/systemctl status jevmed, /usr/bin/systemctl status jevmed, /bin/journalctl -u jevmed -n 60 --no-pager, /usr/bin/journalctl -u jevmed -n 60 --no-pager
SUDOEOF
chmod 440 /etc/sudoers.d/jevmed-deploy
if visudo -cf /etc/sudoers.d/jevmed-deploy >/dev/null; then
  echo "  sudoers rule installed for $DEPLOY_USER"
else
  rm -f /etc/sudoers.d/jevmed-deploy
  die "sudoers rule failed validation and was removed."
fi

# ─────────────────────────────────────────────────────────────────────────────
step "Configuring the OpenLiteSpeed vhost"

install -d -o "$SITE_OWNER" -g "$SITE_OWNER" -m 755 "$DOCROOT"
install -d -o "$SITE_OWNER" -g "$SITE_OWNER" -m 755 "$VH_ROOT/logs" 2>/dev/null || true
install -d -o lsadm -g nobody -m 750 "$VHOST_DIR"
install -d -m 755 "$ACME_WEBROOT/.well-known/acme-challenge"

VHOST_SRC="$(cd "$(dirname "$0")" && pwd)/ols-jevmed-vhost.conf"
[ -f "$VHOST_SRC" ] || VHOST_SRC="$APP_DIR/current/deploy/ols-jevmed-vhost.conf"
[ -f "$VHOST_SRC" ] || die "ols-jevmed-vhost.conf not found next to this script."

if [ -f "$VHOST_DIR/vhost.conf" ] && grep -q 'jevmed_app' "$VHOST_DIR/vhost.conf"; then
  warn "vhost.conf already present — leaving it untouched."
else
  sed -e "s#jevmed.trilumi.xyz#$DOMAIN#g" \
      -e "s#/home/trilumi.xyz/jevmed#$DOCROOT#g" \
      -e "s#127.0.0.1:8787#127.0.0.1:$PORT#g" \
      "$VHOST_SRC" > "$VHOST_DIR/vhost.conf"
  chown lsadm:nobody "$VHOST_DIR/vhost.conf"
  chmod 640 "$VHOST_DIR/vhost.conf"
  echo "  wrote $VHOST_DIR/vhost.conf"
fi

# ── The one shared-file edit, with a backup and an automatic rollback ────────
BACKUP="$LSWS_CONF.bak-jevmed-$(date -u +%Y%m%d%H%M%S)"
cp -a "$LSWS_CONF" "$BACKUP"
echo "  backed up httpd_config.conf → $BACKUP"

restore_lsws() {
  warn "restoring $LSWS_CONF from $BACKUP"
  cp -a "$BACKUP" "$LSWS_CONF"
  systemctl restart lsws || true
}

python3 - "$LSWS_CONF" "$DOMAIN" "$VH_ROOT" <<'PYEOF'
import re, sys

conf_path, domain, vh_root = sys.argv[1], sys.argv[2], sys.argv[3]
text = open(conf_path).read()
changed = []

block = (
    f"virtualHost {domain} {{\n"
    f"  vhRoot                  {vh_root}\n"
    f"  configFile              $SERVER_ROOT/conf/vhosts/$VH_NAME/vhost.conf\n"
    f"  allowSymbolLink         1\n"
    f"  enableScript            1\n"
    f"  restrained              1\n"
    f"}}\n"
)

# 1. The virtualHost block, inserted before the first existing one so it sits
#    with its peers rather than at the end of the file.
if re.search(rf"^virtualHost\s+{re.escape(domain)}\s*\{{", text, re.M):
    print("    virtualHost block already present")
else:
    m = re.search(r"^virtualHost\s+\S+\s*\{", text, re.M)
    if not m:
        sys.exit("no existing virtualHost block found — refusing to guess placement")
    text = text[:m.start()] + block + text[m.start():]
    changed.append("virtualHost block")

# 2. One map line inside every listener. Missing any of the three means the
#    site answers on some ports and 404s on others.
map_line = f"  map                     {domain} {domain}\n"
listeners = list(re.finditer(r"^listener\s+(.+?)\s*\{", text, re.M))
if not listeners:
    sys.exit("no listener blocks found")

# Walk backwards so earlier offsets stay valid as we splice.
for m in reversed(listeners):
    start = m.end()
    depth, i = 1, start
    while i < len(text) and depth:
        if text[i] == "{":
            depth += 1
        elif text[i] == "}":
            depth -= 1
        i += 1
    end = i - 1
    body = text[start:end]
    if re.search(rf"^\s*map\s+{re.escape(domain)}\s", body, re.M):
        continue
    maps = list(re.finditer(r"^[ \t]*map\s+.*\n", body, re.M))
    at = start + (maps[-1].end() if maps else 0)
    text = text[:at] + map_line + text[at:]
    changed.append(f"map in listener {m.group(1).strip()}")

if changed:
    open(conf_path, "w").write(text)
    for c in changed:
        print(f"    added {c}")
else:
    print("    nothing to change")
PYEOF

# ─────────────────────────────────────────────────────────────────────────────
step "Restarting OpenLiteSpeed and checking the existing sites"
if ! systemctl restart lsws; then
  restore_lsws
  die "lsws failed to restart — config restored."
fi
sleep 3

if ! systemctl is-active --quiet lsws; then
  restore_lsws
  die "lsws is not active after restart — config restored."
fi

CANARY_CODE="$(curl -fsS -o /dev/null -w '%{http_code}' --max-time 15 "$CANARY" 2>/dev/null || echo 000)"
if [ "$CANARY_CODE" = "000" ]; then
  restore_lsws
  die "$CANARY stopped responding after the config change — config restored. \
Nothing else was altered; investigate before re-running."
fi
echo "  lsws active, $CANARY → HTTP $CANARY_CODE ✓"

# ─────────────────────────────────────────────────────────────────────────────
step "Firewall"
if systemctl is-active --quiet firewalld; then
  # 80/443 are already open — every other site on this box is reachable. Only
  # report, so a bootstrap never widens the firewall as a side effect.
  OPEN="$(firewall-cmd --list-services 2>/dev/null || true)"
  echo "  firewalld active; services: ${OPEN:-unknown}"
  case "$OPEN" in
    *http*) echo "  http/https already permitted ✓" ;;
    *) warn "http/https not listed. If the site is unreachable from outside, run:" ;
       warn "    firewall-cmd --permanent --add-service=http --add-service=https && firewall-cmd --reload" ;;
  esac
else
  echo "  firewalld inactive — nothing to do"
fi

# ─────────────────────────────────────────────────────────────────────────────
step "TLS certificate"
CERT_DIR="/etc/letsencrypt/live/$DOMAIN"
if [ -s "$CERT_DIR/fullchain.pem" ]; then
  echo "  certificate already present; acme.sh renews it automatically"
elif [ ! -x "$ACME_SH" ]; then
  warn "acme.sh not found at $ACME_SH — issue the certificate by hand."
elif [ -z "$RESOLVED" ] || { [ -n "$MYIP" ] && [ "$RESOLVED" != "$MYIP" ]; }; then
  warn "Skipping: $DOMAIN does not resolve to this server yet."
  warn "Add the A record, then re-run this script to finish TLS."
else
  mkdir -p "$CERT_DIR"
  if "$ACME_SH" --issue -d "$DOMAIN" -w "$ACME_WEBROOT" --server letsencrypt; then
    "$ACME_SH" --install-cert -d "$DOMAIN" \
      --key-file       "$CERT_DIR/privkey.pem" \
      --fullchain-file "$CERT_DIR/fullchain.pem" \
      --reloadcmd      "systemctl restart lsws"

    # vhssl goes on only once the cert exists — a vhssl block pointing at a
    # missing file breaks the whole vhost.
    if ! grep -q '^vhssl' "$VHOST_DIR/vhost.conf"; then
      cat >> "$VHOST_DIR/vhost.conf" <<VHSSLEOF

vhssl  {
  keyFile                 $CERT_DIR/privkey.pem
  certFile                $CERT_DIR/fullchain.pem
  certChain               1
  sslProtocol             24
  enableECDHE             1
  renegProtection         1
  sslSessionCache         1
  enableSpdy              15
  enableStapling          1
  ocspRespMaxAge          86400
}
VHSSLEOF
      chown lsadm:nobody "$VHOST_DIR/vhost.conf"
      systemctl restart lsws
      echo "  vhssl block added and lsws restarted"
    fi
  else
    warn "acme.sh failed — issue it by hand:"
    warn "    $ACME_SH --issue -d $DOMAIN -w $ACME_WEBROOT --server letsencrypt"
  fi
fi

# ─────────────────────────────────────────────────────────────────────────────
step "Done"
cat <<SUMMARY

  Application directory  $APP_DIR
  Service account        $APP_USER
  Deploy user            $DEPLOY_USER
  Environment file       $APP_DIR/shared/.env
  Vault (encrypted)      $APP_DIR/shared/data/vault.enc
  lsws vhost             $VHOST_DIR/vhost.conf
  lsws config backup     $BACKUP

  The service will not start until the first deploy puts code in
  $APP_DIR/current. That is expected.

  Next:
    1. Add these GitHub repository secrets
       (Settings → Secrets and variables → Actions):
         VPS_HOST      212.85.27.147
         VPS_USER      $DEPLOY_USER
         VPS_SSH_KEY   the PRIVATE key whose public half is in
                       ~$DEPLOY_USER/.ssh/authorized_keys
         VPS_SSH_PORT  22
         VPS_APP_DIR   $APP_DIR
    2. Push to main. The workflow builds, verifies and deploys.
    3. If VAULT_PASSPHRASE_HASH still says PASTE_THE_HASH_HERE, generate it now:
         cd $APP_DIR/current && node server/hash-passphrase.js 'your passphrase'
       paste it in, then: systemctl restart jevmed
    4. Open the key-management console URL printed above and add the API key.

SUMMARY
