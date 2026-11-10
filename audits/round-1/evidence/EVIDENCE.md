# Historical evidence for round 1 attempt

> This file records the first gate attempt and is retained for audit history. The final candidate and current acceptance evidence are in `audits/round-1/lead-review.md`, `audits/round-1/independent-review.md`, and `REPORTS.md`.

Artifact: b6ecf403d6bc712443799bc7fe1c7a28973d9c6b
Changes: [CHANGED.md](CHANGED.md)
Status: FILLED by lead ops; candidate remains b6ecf403d6bc712443799bc7fe1c7a28973d9c6b.

## Hard-check outputs and test counts

Environment: Windows PowerShell, Node/npm from workspace, SQLite dev database, LAN services on 10.5.2.31.

- npm test: exit 0; backend 21 passed, frontend 18 passed, 0 failed, 0 skipped.
- npm run typecheck: exit 0; frontend and backend TypeScript checks passed.
- npm run lint: exit 0; ESLint passed with no errors.
- npm run build: exit 0; Vite production build and backend tsc passed. Vite emitted only the existing chunk-size advisory.
- npm run db:seed:castle: exit 0; Castle space ready, idempotent upgrade applied to legacy default templates.
- Targeted castle test: exit 0; five sections, four professional templates, edit preservation, auth and CRUD passed.

## Screenshots/contact sheets

Screenshots:

- output/playwright/jiegou-mobile-final.png: 390x844 viewport, “解构世界” project overview and workspace.
- output/playwright/jiegou-mobile-dashboard.png: 390x844 viewport scrolled to the professional growth workspace; five-stage path and four tabs visible.
- output/playwright/jiegou-mobile.png: earlier mobile capture retained for comparison.
- Browser live check at desktop viewport: 1920px viewport, document scrollWidth 1905px, four tabs and five-stage path present.
- Browser live check at 390px viewport: document/body scrollWidth 375px, four tabs present, no horizontal overflow.

## Live URL checks

Live checks on 2026-11-10:

- http://10.5.2.31:5174/home?project=99&folder=104 returned HTTP 200 and rendered the target project.
- http://10.5.2.31:5174/api/contents returned HTTP 401 without a session, confirming the protected API path.
- Authenticated browser session opened project 99, folder 104; refreshed state preserved folder and checklist progress.

## Known open defects carried from the last round

No earlier scored round. No known critical or major defect carried into round 1. A transient Vite HMR error from an intermediate prop update was fixed by defaulting the dashboard module list to an empty array; a fresh browser session showed zero console errors.

## Review inputs

Shared inputs:

- Candidate SHA: b6ecf403d6bc712443799bc7fe1c7a28973d9c6b.
- CHARTER.md and PROMPTS.md at the project root.
- research/BRIEF.md and research/DECONSTRUCT_WORLD_STANDARD.md.
- Reference DOCX structure extracted into the brief; no external network source was used for content claims.
- Highest-weight keys: accuracy, coverage, visual_design, phone, interaction, maintainability.
- Fresh desktop/mobile screenshots and command evidence above.
