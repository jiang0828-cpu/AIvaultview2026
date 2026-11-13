#!/usr/bin/env bash
set -euo pipefail
umask 077
backup_root=/var/backups/vaultview/daily
install -d -m 700 "$backup_root"
exec 9>/var/backups/vaultview/backup.lock
flock -n 9 || exit 0
version=$(date -u +%Y%m%dT%H%M%SZ)
temporary=$(mktemp -d "$backup_root/.pending.XXXXXXXX")
cleanup() { if [[ -d $temporary && $temporary == /var/backups/vaultview/daily/.pending.* ]]; then rm -rf -- "$temporary"; fi; }
trap cleanup EXIT
python3 - /var/lib/vaultview/data/vaultview.db "$temporary/vaultview.db" <<'PY'
import sqlite3, sys
from pathlib import Path
with sqlite3.connect(Path(sys.argv[1]).as_uri() + '?mode=ro', uri=True) as source:
    with sqlite3.connect(sys.argv[2]) as target:
        source.backup(target)
        assert target.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
PY
if [[ -f /var/lib/vaultview/compare/compare.db ]]; then
  python3 - /var/lib/vaultview/compare/compare.db "$temporary/compare.db" <<'PY'
import sqlite3, sys
from pathlib import Path
with sqlite3.connect(Path(sys.argv[1]).as_uri() + '?mode=ro', uri=True) as source:
    with sqlite3.connect(sys.argv[2]) as target:
        source.backup(target)
        assert target.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
PY
fi
tar -czf "$temporary/media.tar.gz" -C /var/lib/vaultview media
mv -- "$temporary" "$backup_root/$version"
# Delete only completed daily backups older than the seven most recent copies.
python3 - "$backup_root" <<'PY'
from pathlib import Path
import re, shutil, sys
root = Path(sys.argv[1]).resolve()
copies = sorted((item for item in root.iterdir() if re.fullmatch(r'\d{8}T\d{6}Z', item.name)
                 and item.is_dir() and not item.is_symlink()), reverse=True)
for item in copies[7:]:
    if item.resolve().parent != root:
        raise SystemExit('Backup path escaped its root')
    shutil.rmtree(item)
PY
printf 'Backup completed: %s\n' "$backup_root/$version"
