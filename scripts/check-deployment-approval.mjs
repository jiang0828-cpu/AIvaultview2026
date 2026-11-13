import { pathToFileURL } from 'node:url';

export function requireReviewers(environment) {
  const rule = environment.protection_rules?.find(rule => rule.type === 'required_reviewers');
  if (!rule?.reviewers?.length) throw new Error('Production must have required reviewers configured before deployment.');
  if (environment.can_admins_bypass !== false) throw new Error('Disable production environment approval bypass before deployment.');
}

async function main() {
  const repository = process.env.GITHUB_REPOSITORY;
  const token = process.env.GITHUB_TOKEN;
  if (!token || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository || ''))
    throw new Error('Missing GitHub deployment context.');
  const response = await fetch(`https://api.github.com/repos/${repository}/environments/production`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`Cannot verify production approval rules (HTTP ${response.status}).`);
  requireReviewers(await response.json());
  console.log('Production requires human approval and disallows bypass.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
