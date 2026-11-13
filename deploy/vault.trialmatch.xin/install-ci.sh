#!/usr/bin/env bash
set -euo pipefail
umask 077
[[ $EUID -eq 0 ]] || { echo 'Run as root.' >&2; exit 1; }
public_key=${1:?Dedicated deployment public key required}
revision=${2:?Exact Git commit required}
expected_hash=${3:?Receiver SHA256 required}
[[ $public_key =~ ^ssh-ed25519\ [A-Za-z0-9+/=]+(\ [A-Za-z0-9@._-]+)?$ ]] || exit 1
[[ $revision =~ ^[a-f0-9]{40}$ && $expected_hash =~ ^[a-f0-9]{64}$ ]] || exit 1
[[ -L /opt/vaultview/current && -f /etc/vaultview/vaultview.env ]] || { echo 'Install VaultView first.' >&2; exit 1; }
temporary=$(mktemp)
trap 'rm -f -- "$temporary"' EXIT
curl --fail --silent --show-error --max-time 30 "https://raw.githubusercontent.com/jiang0828-cpu/AIvaultview2026/$revision/deploy/vault.trialmatch.xin/ci-receiver.sh" > "$temporary"
printf '%s  %s\n' "$expected_hash" "$temporary" | sha256sum --check >/dev/null
bash -n "$temporary"
install -m 750 -o root -g root "$temporary" /usr/local/sbin/vaultview-ci
install -d -m 700 /root/.ssh
touch /root/.ssh/authorized_keys
chmod 600 /root/.ssh/authorized_keys
key_body=$(printf '%s\n' "$public_key" | cut -d ' ' -f 2)
if ! grep -Fq -- "$key_body" /root/.ssh/authorized_keys; then
  cp -p /root/.ssh/authorized_keys "/root/.ssh/authorized_keys.before-vaultview-ci-$(date -u +%Y%m%dT%H%M%SZ)"
  printf '\ncommand="/usr/local/sbin/vaultview-ci",restrict %s\n' "$public_key" >> /root/.ssh/authorized_keys
fi
echo 'Restricted GitHub deployment key installed. Existing keys and service configuration were preserved.'
