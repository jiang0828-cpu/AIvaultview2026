# Node and Python Review

Date: 2026-11-12
Scope: compare proxy, project seed, current Python matching/import ownership behavior.

## Findings

### Major: live searches duplicate imports
`python/price_compare/main.py` reads scoped `ImportRecord` once before the eBay branch and again under `if request.mode == "live"`. Every manual quote is appended twice to live results and can appear twice in the comparison table and ranking. Remove one block, retaining one scoped read.

### Major: import edit request shape mismatch
Node `PUT /api/compare/imports/:id` currently forwards a raw object, while Python `PUT /imports/{import_id}` validates `ImportRequest` and expects `{format: "manual", data: offer}`. An edit from the UI therefore receives 422. The proxy should wrap raw normalized offers or the frontend should send the envelope.

### Minor: acceptable conditions are parsed but unused
`SearchRequest.acceptable_conditions` is accepted but matching never consults it. Either expose this as intentionally informational or define a near-match policy; it must not silently imply filtering.

### Minor: Python run mode display is substring based
`GET /runs` detects demo mode by checking if the serialized request contains the substring `demo`, which can misclassify a query or field containing that text. Read the parsed JSON `mode` field.

## Node validation

- `npm run typecheck -w backend`: pass.
- `npx eslint backend/src/compare.ts backend/prisma/compare.ts backend/prisma/init-compare.ts backend/test/compare.test.ts`: pass.
- `npx tsx --test backend/test/compare.test.ts`: pass (8 tests including numeric/string favorite IDs, auth/project scope and generic upstream failures).
- Full backend suite: 82 tests pass before the additional favorite test; targeted suite now passes 8 tests.

No secrets or tokens were printed.
