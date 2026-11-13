import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm, appendFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export const bundleFiles = ['vaultview-upgrade.tar.gz', 'vaultview-content-update.tar.gz', 'upgrade.sh', 'SHA256SUMS', 'manifest.json'];

export async function verifyCandidate(directory, revision) {
  if (!/^[a-f0-9]{40}$/.test(revision || '')) throw new Error('An exact approved commit is required.');
  const manifest = JSON.parse(await readFile(join(directory, 'manifest.json'), 'utf8'));
  if (manifest.mode !== 'code-only' || manifest.revision !== revision)
    throw new Error('The release artifact does not match the approved code-only commit.');
  const lines = (await readFile(join(directory, 'SHA256SUMS'), 'utf8')).trim().split(/\r?\n/);
  const required = new Set(bundleFiles.slice(0, 3));
  for (const line of lines) {
    const match = line.match(/^([a-f0-9]{64}) {2}([A-Za-z0-9.-]+)$/);
    if (!match || !required.delete(match[2])) throw new Error('Unexpected or duplicate release checksum entry.');
    const digest = createHash('sha256').update(await readFile(join(directory, match[2]))).digest('hex');
    if (digest !== match[1]) throw new Error(`Release integrity check failed: ${match[2]}`);
  }
  if (required.size) throw new Error('Release checksum entries are incomplete.');
  return manifest;
}

async function main() {
  const directory = resolve(process.argv[2] || '.tmp/ci-candidate');
  const revision = process.env.GITHUB_SHA;
  await verifyCandidate(directory, revision);
  const host = process.env.VAULTVIEW_DEPLOY_HOST;
  const user = process.env.VAULTVIEW_DEPLOY_USER;
  const port = process.env.VAULTVIEW_DEPLOY_PORT || '22';
  const privateKey = process.env.VAULTVIEW_SSH_PRIVATE_KEY;
  const knownHosts = process.env.VAULTVIEW_SSH_KNOWN_HOSTS;
  if (!/^[A-Za-z0-9.-]+$/.test(host || '') || !/^[a-z_][a-z0-9_-]*$/.test(user || '')
      || !/^\d{1,5}$/.test(port) || Number(port) < 1 || Number(port) > 65535 || !privateKey || !knownHosts)
    throw new Error('Configure the deployment host, account, port, dedicated SSH key and trusted host keys first.');
  const run = process.env.GITHUB_RUN_ID;
  const attempt = process.env.GITHUB_RUN_ATTEMPT;
  if (!/^\d+$/.test(run || '') || !/^\d+$/.test(attempt || '')) throw new Error('Missing GitHub run identity.');
  const identity = `${revision}-${run}-${attempt}`;
  const temporary = await mkdtemp(join(tmpdir(), 'vaultview-ci-'));
  try {
    await writeFile(join(temporary, 'key'), privateKey.trim() + '\n', { mode: 0o600 });
    await writeFile(join(temporary, 'known_hosts'), knownHosts.trim() + '\n', { mode: 0o600 });
    const options = ['-T', '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', '-o', 'IdentitiesOnly=yes',
      '-o', 'ConnectTimeout=15', '-o', 'ServerAliveInterval=15', '-o', 'ServerAliveCountMax=3',
      '-o', `UserKnownHostsFile=${join(temporary, 'known_hosts')}`, '-i', join(temporary, 'key'), '-p', port];
    const ssh = (command, input) => {
      const result = execFileSync('ssh', [...options, `${user}@${host}`, command], {
        input, encoding: 'utf8', timeout: 180000, maxBuffer: 2 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true,
      });
      return JSON.parse(result.trim());
    };
    const archive = join(temporary, 'upload.tar.gz');
    execFileSync('tar', ['-czf', archive, '-C', directory, ...bundleFiles], { stdio: 'pipe', windowsHide: true });
    const started = ssh(`vaultview-install ${identity}`, await readFile(archive));
    if (started.state !== 'started') throw new Error('The server did not acknowledge this deployment.');
    console.log(`Deployment ${identity} started in the background; checking server status.`);
    const deadline = Date.now() + 35 * 60 * 1000;
    let complete = false;
    while (Date.now() < deadline) {
      await new Promise(resolveWait => setTimeout(resolveWait, 15000));
      let status;
      try { status = ssh(`vaultview-status ${identity}`); }
      catch { console.log('Status connection unavailable; the background deployment may still be running.'); continue; }
      if (status.state === 'running') continue;
      if (status.state !== 'completed' || status.exitCode !== 0)
        throw new Error(`Deployment did not succeed. Inspect /root/vaultview-ci/${identity}/upgrade.log on the server.`);
      complete = true;
      break;
    }
    if (!complete) throw new Error(`Deployment status is unknown. Inspect /root/vaultview-ci/${identity}; do not start another deployment blindly.`);
    const response = await fetch('https://vault.trialmatch.xin/api/health', { signal: AbortSignal.timeout(15000) });
    if (!response.ok || (await response.json()).status !== 'ok') throw new Error('Deployment completed, but the external health check failed. Inspect the server.');
    console.log(`Published ${revision}: https://vault.trialmatch.xin`);
    if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY,
      `## Published\n\nCommit: ${revision}\n\nhttps://vault.trialmatch.xin\n\nServer log: /root/vaultview-ci/${identity}/upgrade.log\n`);
  } finally { await rm(temporary, { recursive: true, force: true }); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // Child process errors can include SSH options; report controlled messages only.
  main().catch(error => { console.error(error.code || error.status ? 'SSH deployment command failed; inspect the GitHub setup and server access.' : error.message); process.exitCode = 1; });
}
