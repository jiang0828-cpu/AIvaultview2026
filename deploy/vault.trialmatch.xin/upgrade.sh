#!/usr/bin/env bash
# Upgrade an existing installation, preserving production accounts and private data.
set -euo pipefail
umask 027
[[ $EUID -eq 0 ]] || { echo 'Run as root.' >&2; exit 1; }
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
bundle=$PWD
sha256sum --check SHA256SUMS
exec 9>/var/lib/vaultview/deploy.lock
flock -n 9 || { echo 'Another deployment is running.' >&2; exit 1; }
previous=$(readlink -f /opt/vaultview/current)
[[ $previous == /opt/vaultview/releases/* ]] || exit 1
systemctl is-active --quiet vaultview
nginx -t
cmp -s /etc/nginx/sites-available/vault.trialmatch.xin "$previous/deploy/vault.trialmatch.xin/nginx-https.conf" || { echo 'Nginx site has local edits; inspect before upgrading.' >&2; exit 1; }
[[ $(df --output=avail -k /opt | tail -1) -ge 2097152 ]] || exit 1
[[ -z $(ss -lntH 'sport = :8001') ]] || systemctl is-active --quiet vaultview-compare
version=$(date -u +%Y%m%dT%H%M%SZ)
release=/opt/vaultview/releases/$version
backup=/var/backups/vaultview/upgrade-$version
install -d -m 755 "$release"
install -d -m 700 "$backup"
payload=$(mktemp -d /var/tmp/vaultview-upgrade.XXXXXXXX)
stopped=0
switched=0
success=0
had_compare=0
systemctl is-active --quiet vaultview-compare && had_compare=1
cleanup() {
  status=$?
  if [[ $success == 0 && $stopped == 1 ]]; then
    echo 'Upgrade failed; restoring the previous code and the pre-upgrade database.' >&2
    systemctl stop vaultview vaultview-compare || true
    if [[ $switched == 1 ]]; then
      ln -s "$previous" /opt/vaultview/rollback-next
      mv -Tf /opt/vaultview/rollback-next /opt/vaultview/current
    fi
    if [[ -f $backup/vaultview.db ]]; then
      install -m 640 -o vaultview -g vaultview "$backup/vaultview.db" /var/lib/vaultview/data/vaultview.db
      # No process has the database open; remove only stale SQLite sidecar files.
      rm -f /var/lib/vaultview/data/vaultview.db-wal /var/lib/vaultview/data/vaultview.db-shm /var/lib/vaultview/data/vaultview.db-journal
    fi
    if [[ -d $backup/media-overwritten ]]; then cp -a "$backup/media-overwritten/." /var/lib/vaultview/media/; fi
    if [[ -f $backup/nginx.conf ]]; then
      cp -p "$backup/nginx.conf" /etc/nginx/sites-available/vault.trialmatch.xin
      nginx -t && systemctl reload nginx || true
    fi
    systemctl start vaultview || true
    if [[ $had_compare == 1 ]]; then systemctl start vaultview-compare || true;
    else systemctl disable vaultview-compare || true; fi
  fi
  if [[ -d $payload && $payload == /var/tmp/vaultview-upgrade.* ]]; then rm -rf -- "$payload"; fi
  exit "$status"
}
trap cleanup EXIT
python3 - "$bundle" "$release" "$payload" <<'PY'
import pathlib,sys,tarfile
bundle,release,payload=map(pathlib.Path,sys.argv[1:])
for name,target in [('vaultview-upgrade.tar.gz',release),('vaultview-content-update.tar.gz',payload)]:
 with tarfile.open(bundle/name,'r:gz') as archive:
  for entry in archive.getmembers():
   p=pathlib.PurePosixPath(entry.name)
   if p.is_absolute() or '..' in p.parts or not (entry.isfile() or entry.isdir()):
    raise SystemExit('Unsafe archive entry')
  archive.extractall(target,filter='data')
PY
export PATH=/root/.nvm/versions/node/v22.23.2/bin:$PATH
cd "$release"
export DATABASE_URL=file:/var/lib/vaultview/data/vaultview.db
npm ci --omit=dev --workspace=backend --include-workspace-root=false --no-audit --no-fund
npm exec --yes --package=prisma@6.19.0 -- prisma generate --schema backend/prisma/schema.prisma
python3 -m venv "$release/python/.venv"
"$release/python/.venv/bin/python" -m pip install --disable-pip-version-check -r python/requirements.txt
ln -s /var/lib/vaultview/media "$release/backend/media"
chown -R root:root "$release"
find "$release" -type d -exec chmod a+rx {} +
find "$release" -type f -exec chmod a+r {} +
# Rehearse all migrations and the merge on a disposable, consistent database copy.
python3 - "$payload/preview.db" <<'PY'
import sqlite3,sys
with sqlite3.connect('file:/var/lib/vaultview/data/vaultview.db?mode=ro',uri=True) as source:
 with sqlite3.connect(sys.argv[1]) as target: source.backup(target)
PY
DATABASE_URL="file:$payload/preview.db" npm exec --yes --package=prisma@6.19.0 -- prisma migrate deploy --schema backend/prisma/schema.prisma
RELEASE_DATABASE_URL="file:$payload/preview.db" node scripts/apply-release-data.mjs "$payload" --check
cp "$payload/merge-preview.json" "$backup/merge-preview.json"

systemctl stop vaultview
if [[ $had_compare == 1 ]]; then systemctl stop vaultview-compare; fi
stopped=1
/usr/local/sbin/vaultview-backup
python3 - "$backup/vaultview.db" <<'PY'
import sqlite3,sys
with sqlite3.connect('file:/var/lib/vaultview/data/vaultview.db?mode=ro',uri=True) as source:
 with sqlite3.connect(sys.argv[1]) as target:
  source.backup(target)
  assert target.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
PY
cp -p /etc/vaultview/vaultview.env "$backup/vaultview.env"
cp -p /etc/nginx/sites-available/vault.trialmatch.xin "$backup/nginx.conf"
printf '%s\n' "$previous" > "$backup/previous-release.txt"
npm exec --yes --package=prisma@6.19.0 -- prisma migrate deploy --schema backend/prisma/schema.prisma
node scripts/apply-release-data.mjs "$payload"
cp "$payload/merge-result.json" "$backup/merge-result.json"
python3 - "$payload" "$backup" <<'PY'
import hashlib,json,pathlib,shutil,sys,os,pwd,grp
payload,backup=map(pathlib.Path,sys.argv[1:]);root=pathlib.Path('/var/lib/vaultview/media')
uid=pwd.getpwnam('vaultview').pw_uid;gid=grp.getgrnam('vaultview').gr_gid
stats={'copied':0,'preserved':0}
for entry in json.loads((payload/'media.json').read_text()):
 rel=pathlib.PurePosixPath(entry['path'])
 if rel.is_absolute() or '..' in rel.parts: raise SystemExit('Unsafe media path')
 source=payload/'media'/rel;target=root/rel
 if not target.resolve().is_relative_to(root.resolve()): raise SystemExit('Media path escaped its root')
 digest=lambda file:hashlib.sha256(file.read_bytes()).hexdigest()
 if digest(source)!=entry['hash']: raise SystemExit('Media integrity mismatch')
 if target.exists():
  current=digest(target)
  if current==entry['hash']: continue
  if current!=entry['baseline']:
   stats['preserved']+=1;continue
  saved=backup/'media-overwritten'/rel;saved.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(target,saved)
 target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(source,target);os.chown(target,uid,gid);os.chmod(target,0o640)
 for parent in target.parents:
  if parent==root: break
  os.chown(parent,uid,gid);os.chmod(parent,0o750)
 stats['copied']+=1
(backup/'media-result.json').write_text(json.dumps(stats))
print('Media merge: '+json.dumps(stats))
PY
install -d -m 750 -o vaultview -g vaultview /var/lib/vaultview/compare
install -m 644 deploy/vault.trialmatch.xin/vaultview-compare.service /etc/systemd/system/vaultview-compare.service
chown vaultview:vaultview /var/lib/vaultview/data/vaultview.db
ln -s "$release" /opt/vaultview/upgrade-next
mv -Tf /opt/vaultview/upgrade-next /opt/vaultview/current
switched=1
systemctl daemon-reload
systemctl enable --now vaultview-compare
systemctl start vaultview
ready=0
for attempt in $(seq 1 30); do
  if curl --fail --silent --max-time 2 http://127.0.0.1:3101/api/health >/dev/null && curl --fail --silent --max-time 2 http://127.0.0.1:8001/health >/dev/null; then ready=1; break; fi
  sleep 1
done
[[ $ready == 1 ]] || { echo 'A service failed its health check.' >&2; exit 1; }
install -m 644 deploy/vault.trialmatch.xin/nginx-https.conf /etc/nginx/sites-available/vault.trialmatch.xin
nginx -t
systemctl reload nginx
curl --fail --silent --show-error --max-time 10 --resolve vault.trialmatch.xin:443:127.0.0.1 https://vault.trialmatch.xin/api/health
install -m 750 deploy/vault.trialmatch.xin/backup.sh /usr/local/sbin/vaultview-backup
success=1
printf '\nUpgraded: %s\nBackup: %s\n' "$release" "$backup"
