#!/usr/bin/env bash
# Install as /usr/local/sbin/vaultview-ci and use only with a restricted SSH key.
set -euo pipefail
umask 077
[[ $EUID -eq 0 ]] || exit 1

if [[ ${1:-} == --run ]]; then
  identity=${2:-}
  [[ $identity =~ ^[a-f0-9]{40}-[0-9]+-[0-9]+$ ]] || exit 1
  bundle=/root/vaultview-ci/$identity
  set +e
  bash "$bundle/upgrade.sh" > "$bundle/upgrade.log" 2>&1
  status=$?
  set -e
  printf '{"state":"completed","exitCode":%d}\n' "$status" > "$bundle/result.pending"
  mv -f "$bundle/result.pending" "$bundle/result.json"
  exit "$status"
fi

[[ ${SSH_ORIGINAL_COMMAND:-} =~ ^vaultview-(install|status)\ ([a-f0-9]{40}-[0-9]+-[0-9]+)$ ]] || { echo 'Unsupported deployment command.' >&2; exit 1; }
mode=${BASH_REMATCH[1]}
identity=${BASH_REMATCH[2]}
bundle=/root/vaultview-ci/$identity
if [[ $mode == status ]]; then
  if [[ -f $bundle/result.json ]]; then cat "$bundle/result.json"
  elif [[ -f $bundle/pid ]] && kill -0 "$(cat "$bundle/pid")" 2>/dev/null; then printf '{"state":"running"}\n'
  else printf '{"state":"absent"}\n'; fi
  exit 0
fi

[[ -L /opt/vaultview/current && -f /etc/vaultview/vaultview.env ]] || { echo 'Existing installation required.' >&2; exit 1; }
install -d -m 700 /root/vaultview-ci
mkdir -m 700 "$bundle"
head -c 536870913 > "$bundle/upload.tar.gz"
[[ $(stat -c %s "$bundle/upload.tar.gz") -le 536870912 ]] || { echo 'Deployment upload is too large.' >&2; exit 1; }
python3 - "$bundle" "$identity" <<'PY'
import json, pathlib, sys, tarfile
bundle = pathlib.Path(sys.argv[1])
allowed = {'vaultview-upgrade.tar.gz', 'vaultview-content-update.tar.gz', 'upgrade.sh', 'SHA256SUMS', 'manifest.json'}
with tarfile.open(bundle / 'upload.tar.gz', 'r:gz') as archive:
    entries = archive.getmembers()
    if len(entries) != len(allowed) or {entry.name for entry in entries} != allowed:
        raise SystemExit('Unexpected upload files')
    if not all(entry.isfile() and entry.size <= 536870912 for entry in entries) or sum(entry.size for entry in entries) > 536870912:
        raise SystemExit('Invalid upload entry')
    archive.extractall(bundle, filter='data')
manifest = json.loads((bundle / 'manifest.json').read_text())
if manifest.get('mode') != 'code-only' or manifest.get('revision') != sys.argv[2].split('-')[0]:
    raise SystemExit('The upload does not match the approved commit')
PY
cd "$bundle"
sha256sum --check SHA256SUMS >/dev/null
nohup /usr/local/sbin/vaultview-ci --run "$identity" </dev/null > "$bundle/launcher.log" 2>&1 &
printf '%s\n' "$!" > "$bundle/pid"
printf '{"state":"started"}\n'
