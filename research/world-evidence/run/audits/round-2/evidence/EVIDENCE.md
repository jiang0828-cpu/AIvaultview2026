# Evidence for round 2

Artifact: c0c2172644229d81b982847e17a776420720d85a
Changes: [CHANGED.md](CHANGED.md)
Status: FILLED — verified against final candidate; bookkeeping only.

## Hard-check outputs and test counts

Windows, Node24.19.0. `npm test`: exit0, backend30/frontend32 passed, failed0, skipped0. `npm run typecheck`, `npm run lint`, `npm run build`: exit0. Logs in candidate `verification/world-evidence-{tests-final,typecheck,lint,build}.log`. Vite existing chunk-size warning remains. Source identical to the tested worktree's WORLD files; no product changes since final checks.

## Screenshots/contact sheets

`verification/world-evidence-{176,185}-full-{1440,390,320}.png` covers both full evidence pages at three viewport widths, height900. `verification/*-claims.png` and `*-calculations.png` are detailed desktop captures. `verification/browser-check.js` uses Playwright, tests each evidence element's boundaries, refreshes, follows record anchors and downloads Markdown. It ran successfully (`verification/world-evidence-browser-final.log`). Human visual inspection: no overlap/clipping in detailed claims/calculations or full320. Fresh Astra may independently assess pictures; Opus's PNG tool limitations must be disclosed.

## Live URL checks

2026-11-11 09:40 Asia/Shanghai: authenticated LAN URLs `http://10.5.2.31:5174/?project=175&issue=176&worldView=evidence` and `http://10.5.2.31:5174/?project=175&issue=185&worldView=evidence` render evidence12/15, calculations2/3, claims5/5. UI refresh,期次select, sourcehref, anchor and actual downloads pass. Console error0; own browser closed and lock released. Temporary credentials deleted. Dev server reads source from main worktree; this separate clean candidate freezes reviewed WORLD source and the exact exported data, not a public deployment. No remote hosting or external publishing requested. Project database migration repeat preview `changed:[],conflicts:[]`, prior apply backed up exact transaction changes.

## Known open defects carried from the last round

First full independent pair at dfebbb6 recorded noCritical/noMajor and USEyes (audits/astra.md and opus.md); not previously machine-scored. Minor fixes batched before this round: calculated tag, backup callback transaction/rollbacktest, aggregate-profit caveat, darker12px body, fullpage mobile evidence, IMF original citation, market chart title, identity allegation removed from supported known claim, two syntax/logic sentences. There are no carried Critical/Major findings. Final fresh reviews pending at pack creation; only final reports may establish pass.

## Review inputs

Candidate root `output/reviews/world-evidence-candidate`, HEAD above, includes CHARTER/PROMPTS, source manifest, source-group ledger and both complete exports. Highest keys correctness30/logic25; full rubric and floors in CHARTER. External originals frozen as9 SHA256 records in research/world-evidence/source-manifest.json; fresh primary-source spot checks required. Review prompts at original run audits/final-prompt.md and candidate audits/gate-prompt.md. Final reviewers must cold-read before looking at previous opinions. No API keys/database/media uploads included.
