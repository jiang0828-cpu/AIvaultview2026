# Changes for round 1

Artifact: 074b6fe96d7f3928e6035735600b783a33564460
Baseline: project start (empty tree; includes the initial file inventory)

## git diff --stat

```text
.env.example                                       |    10 +
 .gitignore                                         |    21 +
 CHARTER.md                                         |    93 +
 DECISIONS.md                                       |     9 +
 PROMPTS.md                                         |    29 +
 README.md                                          |   170 +
 REPORTS.md                                         |    44 +
 STATE.md                                           |    59 +
 audits/round-1/evidence/CHANGED.md                 |   211 +
 audits/round-1/evidence/EVIDENCE.md                |    51 +
 audits/round-1/independent-review.md               |    16 +
 audits/round-1/lead-review.md                      |    41 +
 audits/round-1/opus-prompt.md                      |     2 +
 audits/round-1/prompt.md                           |    35 +
 audits/workers.csv                                 |     4 +
 backend/media/cases/ai/course-intro.mp4            |   Bin 0 -> 945892 bytes
 backend/media/cases/ai/course-roadmap.png          |   Bin 0 -> 190627 bytes
 backend/media/cases/ai/slide-1.png                 |   Bin 0 -> 61325 bytes
 backend/media/cases/ai/slide-10.png                |   Bin 0 -> 61802 bytes
 backend/media/cases/ai/slide-11.png                |   Bin 0 -> 60807 bytes
 backend/media/cases/ai/slide-12.png                |   Bin 0 -> 64717 bytes
 backend/media/cases/ai/slide-2.png                 |   Bin 0 -> 63670 bytes
 backend/media/cases/ai/slide-3.png                 |   Bin 0 -> 67428 bytes
 backend/media/cases/ai/slide-4.png                 |   Bin 0 -> 67530 bytes
 backend/media/cases/ai/slide-5.png                 |   Bin 0 -> 61033 bytes
 backend/media/cases/ai/slide-6.png                 |   Bin 0 -> 62965 bytes
 backend/media/cases/ai/slide-7.png                 |   Bin 0 -> 60798 bytes
 backend/media/cases/ai/slide-8.png                 |   Bin 0 -> 61470 bytes
 backend/media/cases/ai/slide-9.png                 |   Bin 0 -> 62376 bytes
 backend/media/projects/literature/README.md        |     7 +
 backend/media/projects/literature/library.jpg      |   Bin 0 -> 497146 bytes
 .../projects/literature/product-technical.docx     |   Bin 0 -> 51142 bytes
 .../projects/literature/project-description.docx   |   Bin 0 -> 44165 bytes
 ...206\263\347\255\226\346\221\230\350\246\201.md" |    69 +
 ...260\203\347\240\224\346\212\245\345\221\212.md" |  1312 ++
 ...1\251\344\270\273\345\217\260\350\264\246.xlsx" |   Bin 0 -> 78674 bytes
 ...243\200\346\237\245\350\256\260\345\275\225.md" |    78 +
 backend/media/projects/mrna/research-data.json     |  8506 +++++++++++
 backend/media/projects/world/earth-night.jpg       |   Bin 0 -> 82373 bytes
 backend/package.json                               |    39 +
 backend/prisma/cases.ts                            |  2024 +++
 backend/prisma/castle.ts                           |   315 +
 backend/prisma/growth-curriculum.ts                |   535 +
 backend/prisma/init-castle.ts                      |    10 +
 backend/prisma/init-literature.ts                  |    10 +
 backend/prisma/init-mrna.ts                        |    43 +
 backend/prisma/init-world-evidence.ts              |    18 +
 backend/prisma/init-world.ts                       |     7 +
 backend/prisma/init-writers.ts                     |    13 +
 backend/prisma/literature-sources.ts               |    15 +
 backend/prisma/literature.ts                       |   159 +
 backend/prisma/migrate.mjs                         |    30 +
 .../migrations/202611090001_init/migration.sql     |    11 +
 .../202611090002_scene_topics/migration.sql        |     3 +
 .../202611100001_rename_projects/migration.sql     |    17 +
 .../202611100002_ai_formats/migration.sql          |    17 +
 .../202611100003_video_duration/migration.sql      |     5 +
 .../202611100004_ai_deck_detail/migration.sql      |     5 +
 .../202611100005_ai_mindmap/migration.sql          |    13 +
 .../202611100006_brand_vaultview/migration.sql     |    10 +
 .../202611100007_literary_writers/migration.sql    |     9 +
 .../202611110001_brand_guanlan/migration.sql       |    10 +
 .../migration.sql                                  |     9 +
 .../migration.sql                                  |    32 +
 .../migration.sql                                  |     5 +
 backend/prisma/migrations/migration_lock.toml      |     1 +
 backend/prisma/mrna-generated.ts                   |    28 +
 backend/prisma/mrna-ownership.ts                   |    15 +
 backend/prisma/schema.prisma                       |    85 +
 backend/prisma/seed-castle.ts                      |   242 +
 backend/prisma/seed-literature.ts                  |    23 +
 backend/prisma/seed-world.ts                       |    39 +
 backend/prisma/seed-writers.ts                     |    21 +
 backend/prisma/seed.ts                             |   243 +
 backend/prisma/upgrade-world-evidence.ts           |    49 +
 backend/prisma/world-002-data.ts                   |    90 +
 backend/prisma/world-002.ts                        |    93 +
 backend/prisma/world-003-data.ts                   |   118 +
 backend/prisma/world-003.ts                        |   111 +
 backend/prisma/world-data.ts                       |    62 +
 backend/prisma/world-evidence-001.ts               |    38 +
 backend/prisma/world-evidence-002.ts               |    42 +
 backend/prisma/world.ts                            |   129 +
 backend/prisma/writers/british-early.ts            |    81 +
 backend/prisma/writers/british-modern.ts           |    92 +
 backend/prisma/writers/china-classical.ts          |   114 +
 backend/prisma/writers/china-late.ts               |   114 +
 backend/prisma/writers/china-modern.ts             |   114 +
 backend/prisma/writers/french-early.ts             |    70 +
 backend/prisma/writers/french-modern.ts            |    70 +
 backend/prisma/writers/german.ts                   |    92 +
 backend/prisma/writers/greek.ts                    |   114 +
 backend/prisma/writers/index.ts                    |    17 +
 backend/prisma/writers/italian.ts                  |    81 +
 backend/prisma/writers/japanese.ts                 |    92 +
 backend/prisma/writers/russian.ts                  |   114 +
 backend/prisma/writers/schema.ts                   |    30 +
 backend/src/app.ts                                 |   424 +
 backend/src/auth.ts                                |   198 +
 backend/src/config.ts                              |    27 +
 backend/src/http.ts                                |    12 +
 backend/src/permissions.ts                         |   166 +
 backend/src/projectTags.ts                         |     6 +
 backend/src/server.ts                              |    18 +
 backend/src/worldSchema.ts                         |   113 +
 backend/test/api.test.ts                           |   407 +
 backend/test/auth-access.test.ts                   |   270 +
 backend/test/brand.test.ts                         |    27 +
 backend/test/castle.test.ts                        |   209 +
 backend/test/helpers.ts                            |    17 +
 backend/test/literature.test.ts                    |    67 +
 backend/test/mrna.test.ts                          |    18 +
 backend/test/world.test.ts                         |   193 +
 backend/test/writers.test.ts                       |    81 +
 backend/tsconfig.json                              |     1 +
 docs/jianghu-style.md                              |    27 +
 eslint.config.mjs                                  |    25 +
 frontend/index.html                                |     2 +
 frontend/package.json                              |    29 +
 frontend/public/favicon.svg                        |     1 +
 frontend/public/images/jianghu-landscape.webp      |   Bin 0 -> 293522 bytes
 frontend/src/Accounts.tsx                          |   172 +
 frontend/src/App.tsx                               |  1953 +++
 frontend/src/LiteratureSpace.tsx                   |   122 +
 frontend/src/LiteratureWriters.tsx                 |    72 +
 frontend/src/MrnaDrugFoundations.tsx               |    74 +
 frontend/src/MrnaResearchSpace.tsx                 |   151 +
 frontend/src/ProjectCycleTag.tsx                   |    50 +
 frontend/src/WorldSpace.tsx                        |   139 +
 frontend/src/accounts.css                          |    43 +
 frontend/src/api.ts                                |    30 +
 frontend/src/components.tsx                        |  1173 ++
 frontend/src/jianghu-details.css                   |   325 +
 frontend/src/jianghu.css                           |   259 +
 frontend/src/literature.css                        |   183 +
 frontend/src/main.tsx                              |    16 +
 frontend/src/mrna-foundations.css                  |    71 +
 frontend/src/mrna-research.css                     |   160 +
 frontend/src/mrnaFoundationContent.ts              |    70 +
 frontend/src/projectFilters.ts                     |   117 +
 frontend/src/projectNavigation.ts                  |    47 +
 frontend/src/styles.css                            |  3506 +++++
 frontend/src/types.ts                              |    53 +
 frontend/src/world.css                             |   292 +
 frontend/src/worldModel.ts                         |    82 +
 frontend/src/writers.ts                            |    25 +
 frontend/test/mrnaResearch.test.ts                 |    70 +
 frontend/test/projectFilters.test.ts               |   106 +
 frontend/test/projectNavigation.test.ts            |   124 +
 frontend/test/world.test.ts                        |   109 +
 frontend/test/writers.test.ts                      |    24 +
 frontend/tsconfig.json                             |     1 +
 frontend/vite.config.ts                            |    17 +
 package-lock.json                                  |  8269 +++++++++++
 package.json                                       |    42 +
 research/BRIEF.md                                  |    82 +
 research/DECONSTRUCT_WORLD_STANDARD.md             |    58 +
 research/mrna-v2/CHARTER.md                        |    23 +
 research/mrna-v2/PROMPTS.md                        |     5 +
 research/mrna-v2/QA.md                             |    34 +
 research/mrna-v2/STANDARD.md                       |    37 +
 research/mrna-v2/STATE.md                          |    35 +
 research/mrna-v2/analysis.mjs                      |    70 +
 research/mrna-v2/audit-evidence.md                 |   109 +
 research/mrna-v2/audit-product.md                  |    83 +
 research/mrna-v2/coverage-notes.json               |   223 +
 research/mrna-v2/findings.json                     |  1909 +++
 research/mrna-v2/registry-extra.json               |  1688 +++
 research/mrna-v2/registry.json                     |  6117 ++++++++
 research/world-ai-forgery/BRIEF.md                 |    28 +
 research/world-ai-forgery/notes.md                 |    63 +
 research/world-ai-forgery/report.md                |   926 ++
 research/world-ai-forgery/run/.gitignore           |    11 +
 research/world-ai-forgery/run/CHARTER.md           |   102 +
 research/world-ai-forgery/run/PROMPTS.md           |    13 +
 research/world-ai-forgery/run/STATE.md             |    42 +
 research/world-ai-forgery/run/audits/workers.csv   |     3 +
 research/world-ai-forgery/source-manifest.json     |   188 +
 research/world-ai-forgery/sources/C2PA25.html      | 14075 +++++++++++++++++++
 research/world-ai-forgery/sources/CAC22.html       |   177 +
 research/world-ai-forgery/sources/CAC25.html       |   193 +
 research/world-ai-forgery/sources/DIFFUSION20.html |   216 +
 research/world-ai-forgery/sources/EU24-extract.txt |    11 +
 research/world-ai-forgery/sources/FBI24.html       |   114 +
 research/world-ai-forgery/sources/FTC24.pdf        |   Bin 0 -> 4409356 bytes
 research/world-ai-forgery/sources/FTC25.html       |  3705 +++++
 research/world-ai-forgery/sources/FTCVOICE.html    |  2648 ++++
 research/world-ai-forgery/sources/NASA12.html      |  1933 +++
 research/world-ai-forgery/sources/NIST24.html      |   969 ++
 research/world-ai-forgery/sources/SYNTHID.html     |   134 +
 .../world-ai-forgery/sources/TRANSFORMER17.html    |   640 +
 research/world-ai-forgery/verification.md          |    43 +
 research/world-evidence/BRIEF.md                   |    18 +
 research/world-evidence/archive-sources.mts        |    26 +
 research/world-evidence/baseline-evidence-v2.json  |   189 +
 research/world-evidence/baseline-evidence-v3.json  |   189 +
 research/world-evidence/baseline-evidence-v4.json  |   189 +
 research/world-evidence/baseline-v1.json           |   189 +
 research/world-evidence/capture-baseline.mts       |     8 +
 research/world-evidence/finalize-evidence.mts      |    21 +
 research/world-evidence/notes/issue-001.md         |    57 +
 research/world-evidence/notes/issue-002.md         |    62 +
 research/world-evidence/run/.gitignore             |    11 +
 research/world-evidence/run/CHARTER.md             |   106 +
 research/world-evidence/run/PROMPTS.md             |     6 +
 research/world-evidence/run/REPORTS.md             |    11 +
 research/world-evidence/run/STATE.md               |    45 +
 research/world-evidence/run/SUMMARY.md             |    30 +
 research/world-evidence/run/audits/astra-final.md  |   122 +
 research/world-evidence/run/audits/astra.md        |    94 +
 research/world-evidence/run/audits/final-prompt.md |    20 +
 research/world-evidence/run/audits/gate-prompt.md  |    24 +
 .../run/audits/opus-final-original.md              |   122 +
 research/world-evidence/run/audits/opus-final.md   |   109 +
 research/world-evidence/run/audits/opus.md         |    74 +
 .../run/audits/profile-correction.md               |    13 +
 .../run/audits/round-2/evidence/CHANGED.md         |   369 +
 .../run/audits/round-2/evidence/EVIDENCE.md        |    25 +
 research/world-evidence/run/audits/scores.csv      |     3 +
 research/world-evidence/run/audits/verification.md |    31 +
 research/world-evidence/run/audits/workers.csv     |     8 +
 research/world-evidence/snapshot-candidate.mts     |    30 +
 research/world-evidence/source-manifest.json       |    74 +
 scripts/assets.mjs                                 |   176 +
 scripts/auth-browser-fixtures.mjs                  |    44 +
 scripts/build_mrna_v2.mjs                          |    76 +
 scripts/build_mrna_v2_workbook.mjs                 |    66 +
 scripts/build_mrna_workbook.mjs                    |   182 +
 scripts/fetch_mrna_latest.mjs                      |    13 +
 scripts/fetch_mrna_registry.mjs                    |    34 +
 scripts/fix_mrna_audit_data.mjs                    |     8 +
 scripts/import-literature-documents.ps1            |    52 +
 scripts/setup.mjs                                  |    38 +
 scripts/verify-auth-browser.mjs                    |   213 +
 .../screenshots/calculations-detail-desktop.png    |   Bin 0 -> 30252 bytes
 .../screenshots/calculations-detail-mobile.png     |   Bin 0 -> 30763 bytes
 verification/screenshots/claim-detail-desktop.png  |   Bin 0 -> 30943 bytes
 verification/screenshots/evidence-1440.png         |   Bin 0 -> 721585 bytes
 verification/screenshots/evidence-320.png          |   Bin 0 -> 501073 bytes
 verification/screenshots/evidence-390.png          |   Bin 0 -> 512878 bytes
 verification/screenshots/overview-1440.png         |   Bin 0 -> 451387 bytes
 verification/screenshots/overview-320.png          |   Bin 0 -> 392075 bytes
 verification/screenshots/overview-390.png          |   Bin 0 -> 403385 bytes
 verification/screenshots/report-003.md             |   926 ++
 .../screenshots/response-detail-desktop.png        |   Bin 0 -> 45929 bytes
 .../screenshots/response-detail-mobile.png         |   Bin 0 -> 45867 bytes
 verification/screenshots/responses-1440.png        |   Bin 0 -> 588941 bytes
 verification/screenshots/responses-320.png         |   Bin 0 -> 407501 bytes
 verification/screenshots/responses-390.png         |   Bin 0 -> 416778 bytes
 .../screenshots/takeaways-detail-desktop.png       |   Bin 0 -> 29522 bytes
 verification/world003-archive.log                  |     1 +
 verification/world003-browser-script.txt           |    91 +
 verification/world003-browser.log                  |   104 +
 verification/world003-build.log                    |    27 +
 verification/world003-lint.log                     |     4 +
 verification/world003-tests.log                    |   107 +
 verification/world003-typecheck.log                |    12 +
 257 files changed, 78196 insertions(+)
```

## Changed files (git diff --name-status)

```text
A	.env.example
A	.gitignore
A	CHARTER.md
A	DECISIONS.md
A	PROMPTS.md
A	README.md
A	REPORTS.md
A	STATE.md
A	audits/round-1/evidence/CHANGED.md
A	audits/round-1/evidence/EVIDENCE.md
A	audits/round-1/independent-review.md
A	audits/round-1/lead-review.md
A	audits/round-1/opus-prompt.md
A	audits/round-1/prompt.md
A	audits/workers.csv
A	backend/media/cases/ai/course-intro.mp4
A	backend/media/cases/ai/course-roadmap.png
A	backend/media/cases/ai/slide-1.png
A	backend/media/cases/ai/slide-10.png
A	backend/media/cases/ai/slide-11.png
A	backend/media/cases/ai/slide-12.png
A	backend/media/cases/ai/slide-2.png
A	backend/media/cases/ai/slide-3.png
A	backend/media/cases/ai/slide-4.png
A	backend/media/cases/ai/slide-5.png
A	backend/media/cases/ai/slide-6.png
A	backend/media/cases/ai/slide-7.png
A	backend/media/cases/ai/slide-8.png
A	backend/media/cases/ai/slide-9.png
A	backend/media/projects/literature/README.md
A	backend/media/projects/literature/library.jpg
A	backend/media/projects/literature/product-technical.docx
A	backend/media/projects/literature/project-description.docx
A	"backend/media/projects/mrna/00_\347\256\241\347\220\206\345\261\202\345\206\263\347\255\226\346\221\230\350\246\201.md"
A	"backend/media/projects/mrna/01_\345\256\214\346\225\264\350\260\203\347\240\224\346\212\245\345\221\212.md"
A	"backend/media/projects/mrna/02_mRNA\350\202\277\347\230\244\350\215\257\347\211\251\344\270\273\345\217\260\350\264\246.xlsx"
A	"backend/media/projects/mrna/03_\346\243\200\347\264\242\344\270\216\350\264\250\351\207\217\346\243\200\346\237\245\350\256\260\345\275\225.md"
A	backend/media/projects/mrna/research-data.json
A	backend/media/projects/world/earth-night.jpg
A	backend/package.json
A	backend/prisma/cases.ts
A	backend/prisma/castle.ts
A	backend/prisma/growth-curriculum.ts
A	backend/prisma/init-castle.ts
A	backend/prisma/init-literature.ts
A	backend/prisma/init-mrna.ts
A	backend/prisma/init-world-evidence.ts
A	backend/prisma/init-world.ts
A	backend/prisma/init-writers.ts
A	backend/prisma/literature-sources.ts
A	backend/prisma/literature.ts
A	backend/prisma/migrate.mjs
A	backend/prisma/migrations/202611090001_init/migration.sql
A	backend/prisma/migrations/202611090002_scene_topics/migration.sql
A	backend/prisma/migrations/202611100001_rename_projects/migration.sql
A	backend/prisma/migrations/202611100002_ai_formats/migration.sql
A	backend/prisma/migrations/202611100003_video_duration/migration.sql
A	backend/prisma/migrations/202611100004_ai_deck_detail/migration.sql
A	backend/prisma/migrations/202611100005_ai_mindmap/migration.sql
A	backend/prisma/migrations/202611100006_brand_vaultview/migration.sql
A	backend/prisma/migrations/202611100007_literary_writers/migration.sql
A	backend/prisma/migrations/202611110001_brand_guanlan/migration.sql
A	backend/prisma/migrations/202611110002_preserve_english_brand/migration.sql
A	backend/prisma/migrations/20261111060000_users_project_access/migration.sql
A	backend/prisma/migrations/20261111061000_explicit_resources/migration.sql
A	backend/prisma/migrations/migration_lock.toml
A	backend/prisma/mrna-generated.ts
A	backend/prisma/mrna-ownership.ts
A	backend/prisma/schema.prisma
A	backend/prisma/seed-castle.ts
A	backend/prisma/seed-literature.ts
A	backend/prisma/seed-world.ts
A	backend/prisma/seed-writers.ts
A	backend/prisma/seed.ts
A	backend/prisma/upgrade-world-evidence.ts
A	backend/prisma/world-002-data.ts
A	backend/prisma/world-002.ts
A	backend/prisma/world-003-data.ts
A	backend/prisma/world-003.ts
A	backend/prisma/world-data.ts
A	backend/prisma/world-evidence-001.ts
A	backend/prisma/world-evidence-002.ts
A	backend/prisma/world.ts
A	backend/prisma/writers/british-early.ts
A	backend/prisma/writers/british-modern.ts
A	backend/prisma/writers/china-classical.ts
A	backend/prisma/writers/china-late.ts
A	backend/prisma/writers/china-modern.ts
A	backend/prisma/writers/french-early.ts
A	backend/prisma/writers/french-modern.ts
A	backend/prisma/writers/german.ts
A	backend/prisma/writers/greek.ts
A	backend/prisma/writers/index.ts
A	backend/prisma/writers/italian.ts
A	backend/prisma/writers/japanese.ts
A	backend/prisma/writers/russian.ts
A	backend/prisma/writers/schema.ts
A	backend/src/app.ts
A	backend/src/auth.ts
A	backend/src/config.ts
A	backend/src/http.ts
A	backend/src/permissions.ts
A	backend/src/projectTags.ts
A	backend/src/server.ts
A	backend/src/worldSchema.ts
A	backend/test/api.test.ts
A	backend/test/auth-access.test.ts
A	backend/test/brand.test.ts
A	backend/test/castle.test.ts
A	backend/test/helpers.ts
A	backend/test/literature.test.ts
A	backend/test/mrna.test.ts
A	backend/test/world.test.ts
A	backend/test/writers.test.ts
A	backend/tsconfig.json
A	docs/jianghu-style.md
A	eslint.config.mjs
A	frontend/index.html
A	frontend/package.json
A	frontend/public/favicon.svg
A	frontend/public/images/jianghu-landscape.webp
A	frontend/src/Accounts.tsx
A	frontend/src/App.tsx
A	frontend/src/LiteratureSpace.tsx
A	frontend/src/LiteratureWriters.tsx
A	frontend/src/MrnaDrugFoundations.tsx
A	frontend/src/MrnaResearchSpace.tsx
A	frontend/src/ProjectCycleTag.tsx
A	frontend/src/WorldSpace.tsx
A	frontend/src/accounts.css
A	frontend/src/api.ts
A	frontend/src/components.tsx
A	frontend/src/jianghu-details.css
A	frontend/src/jianghu.css
A	frontend/src/literature.css
A	frontend/src/main.tsx
A	frontend/src/mrna-foundations.css
A	frontend/src/mrna-research.css
A	frontend/src/mrnaFoundationContent.ts
A	frontend/src/projectFilters.ts
A	frontend/src/projectNavigation.ts
A	frontend/src/styles.css
A	frontend/src/types.ts
A	frontend/src/world.css
A	frontend/src/worldModel.ts
A	frontend/src/writers.ts
A	frontend/test/mrnaResearch.test.ts
A	frontend/test/projectFilters.test.ts
A	frontend/test/projectNavigation.test.ts
A	frontend/test/world.test.ts
A	frontend/test/writers.test.ts
A	frontend/tsconfig.json
A	frontend/vite.config.ts
A	package-lock.json
A	package.json
A	research/BRIEF.md
A	research/DECONSTRUCT_WORLD_STANDARD.md
A	research/mrna-v2/CHARTER.md
A	research/mrna-v2/PROMPTS.md
A	research/mrna-v2/QA.md
A	research/mrna-v2/STANDARD.md
A	research/mrna-v2/STATE.md
A	research/mrna-v2/analysis.mjs
A	research/mrna-v2/audit-evidence.md
A	research/mrna-v2/audit-product.md
A	research/mrna-v2/coverage-notes.json
A	research/mrna-v2/findings.json
A	research/mrna-v2/registry-extra.json
A	research/mrna-v2/registry.json
A	research/world-ai-forgery/BRIEF.md
A	research/world-ai-forgery/notes.md
A	research/world-ai-forgery/report.md
A	research/world-ai-forgery/run/.gitignore
A	research/world-ai-forgery/run/CHARTER.md
A	research/world-ai-forgery/run/PROMPTS.md
A	research/world-ai-forgery/run/STATE.md
A	research/world-ai-forgery/run/audits/workers.csv
A	research/world-ai-forgery/source-manifest.json
A	research/world-ai-forgery/sources/C2PA25.html
A	research/world-ai-forgery/sources/CAC22.html
A	research/world-ai-forgery/sources/CAC25.html
A	research/world-ai-forgery/sources/DIFFUSION20.html
A	research/world-ai-forgery/sources/EU24-extract.txt
A	research/world-ai-forgery/sources/FBI24.html
A	research/world-ai-forgery/sources/FTC24.pdf
A	research/world-ai-forgery/sources/FTC25.html
A	research/world-ai-forgery/sources/FTCVOICE.html
A	research/world-ai-forgery/sources/NASA12.html
A	research/world-ai-forgery/sources/NIST24.html
A	research/world-ai-forgery/sources/SYNTHID.html
A	research/world-ai-forgery/sources/TRANSFORMER17.html
A	research/world-ai-forgery/verification.md
A	research/world-evidence/BRIEF.md
A	research/world-evidence/archive-sources.mts
A	research/world-evidence/baseline-evidence-v2.json
A	research/world-evidence/baseline-evidence-v3.json
A	research/world-evidence/baseline-evidence-v4.json
A	research/world-evidence/baseline-v1.json
A	research/world-evidence/capture-baseline.mts
A	research/world-evidence/finalize-evidence.mts
A	research/world-evidence/notes/issue-001.md
A	research/world-evidence/notes/issue-002.md
A	research/world-evidence/run/.gitignore
A	research/world-evidence/run/CHARTER.md
A	research/world-evidence/run/PROMPTS.md
A	research/world-evidence/run/REPORTS.md
A	research/world-evidence/run/STATE.md
A	research/world-evidence/run/SUMMARY.md
A	research/world-evidence/run/audits/astra-final.md
A	research/world-evidence/run/audits/astra.md
A	research/world-evidence/run/audits/final-prompt.md
A	research/world-evidence/run/audits/gate-prompt.md
A	research/world-evidence/run/audits/opus-final-original.md
A	research/world-evidence/run/audits/opus-final.md
A	research/world-evidence/run/audits/opus.md
A	research/world-evidence/run/audits/profile-correction.md
A	research/world-evidence/run/audits/round-2/evidence/CHANGED.md
A	research/world-evidence/run/audits/round-2/evidence/EVIDENCE.md
A	research/world-evidence/run/audits/scores.csv
A	research/world-evidence/run/audits/verification.md
A	research/world-evidence/run/audits/workers.csv
A	research/world-evidence/snapshot-candidate.mts
A	research/world-evidence/source-manifest.json
A	scripts/assets.mjs
A	scripts/auth-browser-fixtures.mjs
A	scripts/build_mrna_v2.mjs
A	scripts/build_mrna_v2_workbook.mjs
A	scripts/build_mrna_workbook.mjs
A	scripts/fetch_mrna_latest.mjs
A	scripts/fetch_mrna_registry.mjs
A	scripts/fix_mrna_audit_data.mjs
A	scripts/import-literature-documents.ps1
A	scripts/setup.mjs
A	scripts/verify-auth-browser.mjs
A	verification/screenshots/calculations-detail-desktop.png
A	verification/screenshots/calculations-detail-mobile.png
A	verification/screenshots/claim-detail-desktop.png
A	verification/screenshots/evidence-1440.png
A	verification/screenshots/evidence-320.png
A	verification/screenshots/evidence-390.png
A	verification/screenshots/overview-1440.png
A	verification/screenshots/overview-320.png
A	verification/screenshots/overview-390.png
A	verification/screenshots/report-003.md
A	verification/screenshots/response-detail-desktop.png
A	verification/screenshots/response-detail-mobile.png
A	verification/screenshots/responses-1440.png
A	verification/screenshots/responses-320.png
A	verification/screenshots/responses-390.png
A	verification/screenshots/takeaways-detail-desktop.png
A	verification/world003-archive.log
A	verification/world003-browser-script.txt
A	verification/world003-browser.log
A	verification/world003-build.log
A	verification/world003-lint.log
A	verification/world003-tests.log
A	verification/world003-typecheck.log
```
