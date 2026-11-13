#!/usr/bin/env bash
# First installation only. Run from the uploaded package directory as root.
set -euo pipefail
umask 027

fail() { printf '%s\n' "$*" >&2; exit 1; }
[[ $EUID -eq 0 ]] || fail 'Run this installer as root.'
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
bundle_directory=$PWD
for tool in node npm nginx certbot python3 tar sha256sum systemctl ss curl openssl runuser flock; do
  command -v "$tool" >/dev/null || fail "Missing required tool: $tool"
done
[[ $(uname -m) == x86_64 ]] || fail 'This installer expects the inspected x86_64 server.'
[[ $(node -p 'process.versions.node.split(".")[0]') == 22 ]] || fail 'Use the existing Node 22 runtime.'
[[ ! -e /opt/vaultview/current && ! -L /opt/vaultview/current ]] || fail 'VaultView already has a release. Use an upgrade procedure instead.'
[[ ! -e /etc/systemd/system/vaultview.service ]] || fail 'An existing vaultview.service requires manual review.'
[[ ! -e /var/lib/vaultview/data/vaultview.db ]] || fail 'An existing database must not be overwritten.'
[[ ! -e /var/lib/vaultview/media ]] || fail 'An existing media directory requires manual review.'
[[ ! -e /etc/vaultview/vaultview.env ]] || fail 'Existing production configuration requires manual review.'
[[ -f /etc/nginx/sites-available/vault.trialmatch.xin ]] || fail 'Create the inspected HTTP bootstrap virtual host first.'
[[ $(readlink -f /etc/nginx/sites-enabled/vault.trialmatch.xin) == /etc/nginx/sites-available/vault.trialmatch.xin ]] || fail 'Unexpected Nginx site layout.'
[[ ! -e /etc/nginx/snippets/vaultview-proxy.conf ]] || fail 'An existing proxy snippet requires manual review.'
[[ ! -e /etc/letsencrypt/renewal-hooks/deploy/vaultview-nginx-reload ]] || fail 'An existing renewal hook requires manual review.'
[[ ! -e /usr/local/sbin/vaultview-backup && ! -e /etc/systemd/system/vaultview-backup.timer ]] || fail 'An existing backup installation requires manual review.'
[[ -f /etc/letsencrypt/live/vault.trialmatch.xin/fullchain.pem ]] || fail 'The HTTPS certificate is missing.'
openssl x509 -in /etc/letsencrypt/live/vault.trialmatch.xin/fullchain.pem -noout -checkend 86400 >/dev/null || fail 'Certificate expiry is too close.'
openssl x509 -in /etc/letsencrypt/live/vault.trialmatch.xin/fullchain.pem -noout -checkhost vault.trialmatch.xin >/dev/null || fail 'Certificate hostname mismatch.'
[[ -z $(ss -lntH 'sport = :3101') ]] || fail 'Port 3101 is already in use.'
nginx -t
sha256sum --check SHA256SUMS
[[ $(df --output=avail -k /opt | tail -1) -ge 2097152 ]] || fail 'Keep at least 2 GiB free before installation.'

release_version=$(date -u +%Y%m%dT%H%M%SZ)
release=/opt/vaultview/releases/$release_version
install -d -m 755 /opt/vaultview/releases /opt/vaultview/runtime
install -d -m 700 /var/backups/vaultview
backup=/var/backups/vaultview/$release_version
install -d -m 700 "$backup"
cp -p /etc/nginx/sites-available/vault.trialmatch.xin "$backup/nginx-http.conf"
install -d -m 755 "$release"
staging=$(mktemp -d /var/tmp/vaultview-install.XXXXXXXX)
cleanup() { if [[ -d $staging && $staging == /var/tmp/vaultview-install.* ]]; then rm -rf -- "$staging"; fi; }
trap cleanup EXIT

# Archives are produced locally from an allowlist. Reject paths and links outside that layout.
python3 - "$bundle_directory" "$release" "$staging" <<'PY'
import pathlib, sys, tarfile
bundle, release, staging = map(pathlib.Path, sys.argv[1:])
for name, destination in [('vaultview-release.tar.gz', release), ('vaultview-private-data.tar.gz', staging)]:
    with tarfile.open(bundle / name, 'r:gz') as archive:
        for member in archive.getmembers():
            path = pathlib.PurePosixPath(member.name)
            if path.is_absolute() or '..' in path.parts or member.issym() or member.islnk() or not (member.isfile() or member.isdir()):
                raise SystemExit('Unsafe archive entry; installation stopped.')
        archive.extractall(destination, filter='data')
PY
[[ -f $release/backend/dist/src/server.js && -f $release/frontend/dist/index.html ]] || fail 'Incomplete release archive.'
[[ -f $staging/data/vaultview.db && -d $staging/media ]] || fail 'Incomplete data archive.'
python3 - "$staging/data/vaultview.db" <<'PY'
import sqlite3, sys
with sqlite3.connect(sys.argv[1]) as db:
    assert db.execute('PRAGMA integrity_check').fetchone()[0] == 'ok', 'Database integrity check failed'
    assert db.execute('SELECT count(*) FROM User WHERE role=? AND enabled=1', ('admin',)).fetchone()[0] > 0, 'No enabled administrator'
PY

node_binary=$(command -v node)
install -m 755 "$node_binary" /opt/vaultview/runtime/node
export PATH="$(dirname -- "$node_binary"):$PATH"
cd "$release"
# Linux dependencies and Prisma engine must be installed here, never copied from Windows.
export DATABASE_URL=file:/var/lib/vaultview/data/vaultview.db
npm ci --omit=dev --workspace=backend --include-workspace-root=false --no-audit --no-fund
npm exec --yes --package=prisma@6.19.0 -- prisma generate --schema backend/prisma/schema.prisma

if ! id vaultview >/dev/null 2>&1; then
  useradd --system --home-dir /var/lib/vaultview --shell /usr/sbin/nologin vaultview
fi
install -d -m 750 -o vaultview -g vaultview /var/lib/vaultview/data
install -m 640 -o vaultview -g vaultview "$staging/data/vaultview.db" /var/lib/vaultview/data/vaultview.db
mv -- "$staging/media" /var/lib/vaultview/media
chown -R vaultview:vaultview /var/lib/vaultview/media
find /var/lib/vaultview/media -type d -exec chmod 750 {} +
find /var/lib/vaultview/media -type f -exec chmod 640 {} +
[[ ! -e $release/backend/media ]] || fail 'Release archive unexpectedly contains a media directory.'
ln -s /var/lib/vaultview/media "$release/backend/media"
cp -p /var/lib/vaultview/data/vaultview.db "$backup/pre-migration.db"
npm exec --yes --package=prisma@6.19.0 -- prisma migrate deploy --schema backend/prisma/schema.prisma

install -d -m 750 -o root -g vaultview /etc/vaultview
production_secret=$(openssl rand -hex 48)
{
  printf '%s\n' 'NODE_ENV=production' 'TRUST_PROXY=loopback' 'PORT=3101' \
    'FRONTEND_ORIGIN=https://vault.trialmatch.xin' \
    'DATABASE_URL=file:/var/lib/vaultview/data/vaultview.db'
  printf 'JWT_SECRET=%s\n' "$production_secret"
} > /etc/vaultview/vaultview.env
unset production_secret
chown root:vaultview /etc/vaultview/vaultview.env
chmod 640 /etc/vaultview/vaultview.env
chown -R root:root "$release"
find "$release" -type d -exec chmod a+rx {} +
find "$release" -type f -exec chmod a+r {} +
chown vaultview:vaultview /var/lib/vaultview/data/vaultview.db
chmod 640 /var/lib/vaultview/data/vaultview.db
ln -s "$release" /opt/vaultview/current

install -m 644 deploy/vault.trialmatch.xin/vaultview.service /etc/systemd/system/vaultview.service
systemctl daemon-reload
systemctl enable --now vaultview
ready=0
for attempt in $(seq 1 30); do
  if curl --fail --silent --max-time 2 http://127.0.0.1:3101/api/health >/dev/null; then ready=1; break; fi
  sleep 1
done
[[ $ready == 1 ]] || fail 'API did not start. Check: journalctl -u vaultview -n 50 --no-pager'

install -m 644 deploy/vault.trialmatch.xin/vaultview-proxy.conf /etc/nginx/snippets/vaultview-proxy.conf
install -m 644 deploy/vault.trialmatch.xin/nginx-https.conf /etc/nginx/sites-available/vault.trialmatch.xin
if ! nginx -t; then
  cp -p "$backup/nginx-http.conf" /etc/nginx/sites-available/vault.trialmatch.xin
  fail 'New Nginx configuration failed validation. The HTTP bootstrap configuration was restored.'
fi
if ! systemctl reload nginx; then
  cp -p "$backup/nginx-http.conf" /etc/nginx/sites-available/vault.trialmatch.xin
  fail 'Nginx reload failed. The previous configuration was restored; inspect before retrying.'
fi

install -d -m 755 /etc/letsencrypt/renewal-hooks/deploy
cat > /etc/letsencrypt/renewal-hooks/deploy/vaultview-nginx-reload <<'HOOK'
#!/bin/sh
set -e
/usr/sbin/nginx -t
/usr/bin/systemctl reload nginx
HOOK
chmod 755 /etc/letsencrypt/renewal-hooks/deploy/vaultview-nginx-reload
install -m 750 deploy/vault.trialmatch.xin/backup.sh /usr/local/sbin/vaultview-backup
install -m 644 deploy/vault.trialmatch.xin/vaultview-backup.service /etc/systemd/system/vaultview-backup.service
install -m 644 deploy/vault.trialmatch.xin/vaultview-backup.timer /etc/systemd/system/vaultview-backup.timer
systemctl daemon-reload
systemctl start vaultview-backup.service
systemctl enable --now vaultview-backup.timer
curl --fail --silent --show-error --max-time 10 --resolve vault.trialmatch.xin:443:127.0.0.1 \
  https://vault.trialmatch.xin/api/health
printf '\nInstalled: https://vault.trialmatch.xin\n'
printf 'Use the migrated administrator username and password. No credentials were printed.\n'
printf 'Pre-migration database and previous Nginx site: %s\n' "$backup"
