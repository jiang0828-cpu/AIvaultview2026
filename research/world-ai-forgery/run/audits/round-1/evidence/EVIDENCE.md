# Evidence for round 1

Artifact: 074b6fe96d7f3928e6035735600b783a33564460
Changes: [CHANGED.md](CHANGED.md)
Status: FILLED / FROZEN by world003-ops, 2026-11-11 15:05 Asia/Shanghai. No review has used the archived initial-d42 template. This pack is for the artifact above only.

## Hard-check outputs and test counts

Candidate root: `E:/AI/Codex/AGIOS/07AI_VaultFolio_钥藏/output/reviews/world-ai-forgery-candidate`.

Windows PowerShell, Node v24.19.0, npm 11.17.0. All four checks were run in the candidate. Each exit code was captured in `$LASTEXITCODE` immediately after its npm command, independently of log-reading commands. See `check-results.json` and `logs/`.

| Command | Exit | Result | Frozen log |
|---|---:|---|---|
| npm test | 0 | Backend 45 pass; frontend 34 pass; failed/skipped/cancelled all 0 | logs/tests-final.log |
| npm run typecheck | 0 | Both workspaces compile without emitting | logs/typecheck-final.log |
| npm run lint | 0 | ESLint passes | logs/lint-final.log |
| npm run build | 0 | Frontend Vite and backend TypeScript build | logs/build-final.log |

The test rerun was necessary because the lead's first combined test/read command did not preserve npm's exit separately. No additional test rerun is being claimed. An earlier candidate lint failure concerned an evidence-only JavaScript function expression; it was renamed `verification/world003-browser-script.txt` before this SHA. The final lint passes. Build retains a non-failing Vite warning for existing chunks above 500 kB; no bundle-size improvement is claimed.

`integrity.json` verifies byte counts and SHA256 for all 13 source snapshots and compares 9 relevant product/test files between live main and candidate; all match. No secrets or database files are in the candidate. CHARTER is a permitted bookkeeping update, with G1-G5 checked and G6 still pending independent review.

## Screenshots/contact sheets

Frozen images and downloaded report: `screenshots/` (copied from the committed candidate `verification/screenshots/`). Browser script: candidate `verification/world003-browser-script.txt`. Full measured result: `logs/world003-browser.log`. Method: Playwright CLI named session, `run-code --filename` using the script, `page.setViewportSize`, full-page screenshots, DOM bounds checks, and locator screenshots for detail views.

| State | Viewport widths | Evidence |
|---|---|---|
| Overview | 1440 / 390 / 320, height 900 | overview-1440.png / overview-390.png / overview-320.png |
| Evidence | 1440 / 390 / 320, height 900 | evidence-1440.png / evidence-390.png / evidence-320.png |
| Responses | 1440 / 390 / 320, height 900 | responses-1440.png / responses-390.png / responses-320.png |
| Detail | Desktop and mobile | response-detail-desktop/mobile.png, calculations-detail-desktop/mobile.png, claim-detail-desktop.png, takeaways-detail-desktop.png |

For all 9 state/width combinations the document width equals the viewport and checked content descendants do not overflow. The navigation may scroll within its own container. Desktop measures form two columns, mobile one. The operator opened full desktop/mobile response screenshots and original-size response/calculation/takeaway details to inspect legibility and overlap; mobile full-page thumbnails alone were not used to assert small-text readability. Six article tabs, evidence anchors, refresh, edition switching and downloads were exercised. Page errors, logged-in HTTP errors and console errors/warnings were zero in the final run. An early harness assertion raced React edition rendering; the script now waits for the selected URL and response-tab removal before asserting, with no product change.

## Live URL checks

Live check window: 2026-11-11 approximately 14:49-14:55 Asia/Shanghai; final source-identity comparison and source-manifest integrity check: 15:04. Canonical local-network URL:

`http://10.5.2.31:5180/?project=175&issue=193&worldView=responses`

The current authorized frontend origin is 5180. Legacy 5174 serves GETs but is not accepted for write-request Origin; configuration was preserved. The app is private and uses a local development server, so there is no separately deployed Git release ID or public HTTPS deployment to verify. Instead, the nine product/test file hashes in `integrity.json` match the candidate to the checked live main; the live data document194 was parsed and checked against the finalized report.

Database: first seed added issue193 and seven child nodes. A hash-guarded transaction refreshed only the eight newly owned nodes after source corrections; the 95 pre-existing Content records have identical hashes for every non-time field. Final repeat seed created0. Live report charts are `[27,38]` and `[90,501]`; its fourth metric is `22 %`; all six response metrics have explicit denominators. See `logs/world003-live-confirm.log`, `logs/world003-db-audit-final.log`, `logs/world003-seed-final.log`, and `inputs/verification.md`.

Live UI counts: 3 takeaways, 12 evidence records, 2 calculations, 6 claims, 6 responses, and 6 complete article views. Prior editions176/185 remain usable and do not show an empty response tab. Download `screenshots/report-003.md` is67,243bytes and contains every field from all6 measures,3 takeaways,13 source URLs, with responses before scenarios (`logs/world003-export-check.log`). The isolated visitor had only the project grant; it and its logs/sessions were removed. Refresh then reached a real login form. Own browser/session closed and lock released; existing servers remained running. Expected logged-out `/auth/me`401 is distinct from the zero-error authenticated interaction run.

## Known open defects carried from the last round

No earlier scored round for this third-issue run, and no prior independent reviewer findings to carry. This is not a claim that fresh review will find none. The previous two-issue run is separate and cannot satisfy this round. G6 remains pending. The known non-failing bundle-size warning and EUR-Lex archive limitation below remain disclosed. The prematurely seeded first draft was corrected through the guarded refresh and final live verification; it is not the current data.

## Review inputs

Shared committed candidate: root above, HEAD074b6fe96d7f3928e6035735600b783a33564460. Reviewers must not edit product files, commit or review the changing main. CHARTER/PROMPTS and benchmark/scoring card are copied into `inputs/`; the benchmark is CHARTER's report standard. Main and candidate CHARTER have the same permitted bookkeeping update. Highest-weight keys: share_ready25, answers_questions20; remaining correctness10, decision_value15, depth15, presentation15. Default floor8 except presentation7. No current or previous Astra findings exist when this initial pack is frozen; the two reviewers work independently against this identical pack.

Read `inputs/BRIEF.md`, `inputs/report.md`, `inputs/notes.md`, `inputs/verification.md`, candidate data/chapters/schema/UI/export/tests, and the original user prompt archive in `inputs/PROMPTS.md`. Detailed initial inventory is in CHANGED.md. Because this candidate is a standalone review repository, its empty-tree baseline includes the existing application's full context; the task-specific changes are the two003data/chapters files, seed integration, optional responses/takeaways/date-precision schema and render/export behavior, associated tests, and this issue's research/verification. No claim is made that unrelated application functionality was newly built for this issue.

External inputs are frozen at candidate `research/world-ai-forgery/source-manifest.json` and `research/world-ai-forgery/sources/`. The manifest copy is `inputs/source-manifest.json`; all file lengths and hashes were checked in `integrity.json`.12 official source files were saved. EU24 is a clearly labelled web-extracted excerpt of the2026-07-27 consolidated text, not a full original: direct HTTP fetch returned202 with an empty body. Its exact quotation and limited scope are preserved in `sources/EU24-extract.txt` and the manifest. Reviewers should independently open the official EUR-Lex link to confirm Art50 and111(4). NASA is visual attribution only. Source existence is not treated as correctness: reviewers must check claims, periods, categories and limits.

No monetary deployment, notification or publishing was performed. Screenshots and facts describe this local-network build; Safari/HTTPS and a public production host are outside this local MVP operation and were not checked.
