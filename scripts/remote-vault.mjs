import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

// Use the existing SSH identity without logging its path or private contents.
const config = await readFile(join(process.env.USERPROFILE || process.env.HOME, '.ssh/config'), 'utf8');
const blocks = [];
let block;
for (const line of config.split(/\r?\n/)) {
  const match = line.trim().match(/^(\S+)\s+(.+)$/);
  if (!match || match[1].startsWith('#')) continue;
  if (match[1].toLowerCase() === 'host') { block = { host: match[2].trim() }; blocks.push(block); }
  else if (block) block[match[1].toLowerCase()] = match[2].trim();
}
const matches = blocks.filter(item => item.hostname === '47.114.47.164');
if (matches.length !== 1) throw new Error('Expected one configured deployment host');
const host = matches[0].host.split(/\s+/).find(value => !/[*?!]/.test(value));
if (!host) throw new Error('No concrete SSH host alias found');
const options = ['-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', '-o', 'ConnectTimeout=15'];
const [mode, ...args] = process.argv.slice(2);
let result;
if (mode === 'exec') result = spawnSync('ssh', [...options, '-o', 'ServerAliveInterval=15', host, ...args], { stdio: 'inherit', windowsHide: true });
else if (mode === 'upload') {
  const [target, ...files] = args;
  if (!/^\/root\/vaultview-[A-Za-z0-9/_-]+\/$/.test(target)) throw new Error('Unexpected upload directory');
  result = spawnSync('scp', [...options, ...files, `${host}:${target}`], { stdio: 'inherit', windowsHide: true });
} else if (mode === 'download-fixture') {
  result = spawnSync('scp', [...options, `${host}:/root/vaultview-upload/browser-fixture.json`,
    'output/playwright/production-fixture.json'], { stdio: 'inherit', windowsHide: true });
} else throw new Error('Use exec <command>, upload <remote-directory/> <files...> or download-fixture');
process.exitCode = result.status ?? 1;
