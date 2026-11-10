# Changes for round 1

Artifact: b6ecf403d6bc712443799bc7fe1c7a28973d9c6b
Baseline: project start (empty tree; includes the initial file inventory)

## git diff --stat

```text
.env.example                                       |   10 +
 .gitignore                                         |   21 +
 CHARTER.md                                         |   93 +
 PROMPTS.md                                         |   29 +
 README.md                                          |  112 +
 STATE.md                                           |   58 +
 backend/media/cases/ai/course-intro.mp4            |  Bin 0 -> 947587 bytes
 backend/media/cases/ai/course-roadmap.png          |  Bin 0 -> 190569 bytes
 backend/media/cases/ai/slide-1.png                 |  Bin 0 -> 61357 bytes
 backend/media/cases/ai/slide-10.png                |  Bin 0 -> 61837 bytes
 backend/media/cases/ai/slide-11.png                |  Bin 0 -> 60853 bytes
 backend/media/cases/ai/slide-12.png                |  Bin 0 -> 64743 bytes
 backend/media/cases/ai/slide-2.png                 |  Bin 0 -> 63713 bytes
 backend/media/cases/ai/slide-3.png                 |  Bin 0 -> 67431 bytes
 backend/media/cases/ai/slide-4.png                 |  Bin 0 -> 67535 bytes
 backend/media/cases/ai/slide-5.png                 |  Bin 0 -> 61081 bytes
 backend/media/cases/ai/slide-6.png                 |  Bin 0 -> 62985 bytes
 backend/media/cases/ai/slide-7.png                 |  Bin 0 -> 60804 bytes
 backend/media/cases/ai/slide-8.png                 |  Bin 0 -> 61465 bytes
 backend/media/cases/ai/slide-9.png                 |  Bin 0 -> 62394 bytes
 backend/media/projects/literature/README.md        |    7 +
 backend/media/projects/literature/library.jpg      |  Bin 0 -> 497146 bytes
 .../projects/literature/product-technical.docx     |  Bin 0 -> 51142 bytes
 .../projects/literature/project-description.docx   |  Bin 0 -> 44165 bytes
 backend/package.json                               |    6 +
 backend/prisma/cases.ts                            | 2014 +++++
 backend/prisma/castle.ts                           |  380 +
 backend/prisma/init-castle.ts                      |   10 +
 backend/prisma/init-literature.ts                  |   10 +
 backend/prisma/init-writers.ts                     |   13 +
 backend/prisma/literature-sources.ts               |   15 +
 backend/prisma/literature.ts                       |  159 +
 backend/prisma/migrate.mjs                         |   30 +
 .../migrations/202611090001_init/migration.sql     |   11 +
 .../202611090002_scene_topics/migration.sql        |    3 +
 .../202611100001_rename_projects/migration.sql     |   17 +
 .../202611100002_ai_formats/migration.sql          |   17 +
 .../202611100003_video_duration/migration.sql      |    5 +
 .../202611100004_ai_deck_detail/migration.sql      |    5 +
 .../202611100005_ai_mindmap/migration.sql          |   13 +
 .../202611100006_brand_vaultview/migration.sql     |   10 +
 .../202611100007_literary_writers/migration.sql    |    9 +
 backend/prisma/migrations/migration_lock.toml      |    1 +
 backend/prisma/schema.prisma                       |   51 +
 backend/prisma/seed-castle.ts                      |  142 +
 backend/prisma/seed-literature.ts                  |   20 +
 backend/prisma/seed-writers.ts                     |   21 +
 backend/prisma/seed.ts                             |  237 +
 backend/prisma/writers/british-early.ts            |   81 +
 backend/prisma/writers/british-modern.ts           |   92 +
 backend/prisma/writers/china-classical.ts          |  114 +
 backend/prisma/writers/china-late.ts               |  114 +
 backend/prisma/writers/china-modern.ts             |  114 +
 backend/prisma/writers/french-early.ts             |   70 +
 backend/prisma/writers/french-modern.ts            |   70 +
 backend/prisma/writers/german.ts                   |   92 +
 backend/prisma/writers/greek.ts                    |  114 +
 backend/prisma/writers/index.ts                    |   17 +
 backend/prisma/writers/italian.ts                  |   81 +
 backend/prisma/writers/japanese.ts                 |   92 +
 backend/prisma/writers/russian.ts                  |  114 +
 backend/prisma/writers/schema.ts                   |   30 +
 backend/src/app.ts                                 |  520 ++
 backend/src/config.ts                              |   32 +
 backend/src/server.ts                              |   15 +
 backend/test/api.test.ts                           |  361 +
 backend/test/castle.test.ts                        |  198 +
 backend/test/literature.test.ts                    |   63 +
 backend/test/writers.test.ts                       |   79 +
 backend/tsconfig.json                              |    1 +
 eslint.config.mjs                                  |   24 +
 frontend/index.html                                |    2 +
 frontend/package.json                              |    6 +
 frontend/src/App.tsx                               | 1874 +++++
 frontend/src/LiteratureSpace.tsx                   |  122 +
 frontend/src/LiteratureWriters.tsx                 |   72 +
 frontend/src/api.ts                                |   30 +
 frontend/src/components.tsx                        | 1169 +++
 frontend/src/literature.css                        |  183 +
 frontend/src/main.tsx                              |   14 +
 frontend/src/projectFilters.ts                     |  117 +
 frontend/src/projectNavigation.ts                  |   34 +
 frontend/src/styles.css                            | 3404 ++++++++
 frontend/src/types.ts                              |   44 +
 frontend/src/writers.ts                            |   25 +
 frontend/test/projectFilters.test.ts               |  106 +
 frontend/test/projectNavigation.test.ts            |   93 +
 frontend/test/writers.test.ts                      |   24 +
 frontend/tsconfig.json                             |    1 +
 frontend/vite.config.ts                            |   17 +
 package-lock.json                                  | 8266 ++++++++++++++++++++
 package.json                                       |   38 +
 research/BRIEF.md                                  |   82 +
 research/DECONSTRUCT_WORLD_STANDARD.md             |   58 +
 scripts/assets.mjs                                 |  176 +
 scripts/build_mrna_workbook.mjs                    |  182 +
 scripts/import-literature-documents.ps1            |   52 +
 scripts/setup.mjs                                  |   42 +
 98 files changed, 22250 insertions(+)
```

## Changed files (git diff --name-status)

```text
A	.env.example
A	.gitignore
A	CHARTER.md
A	PROMPTS.md
A	README.md
A	STATE.md
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
A	backend/package.json
A	backend/prisma/cases.ts
A	backend/prisma/castle.ts
A	backend/prisma/init-castle.ts
A	backend/prisma/init-literature.ts
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
A	backend/prisma/migrations/migration_lock.toml
A	backend/prisma/schema.prisma
A	backend/prisma/seed-castle.ts
A	backend/prisma/seed-literature.ts
A	backend/prisma/seed-writers.ts
A	backend/prisma/seed.ts
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
A	backend/src/config.ts
A	backend/src/server.ts
A	backend/test/api.test.ts
A	backend/test/castle.test.ts
A	backend/test/literature.test.ts
A	backend/test/writers.test.ts
A	backend/tsconfig.json
A	eslint.config.mjs
A	frontend/index.html
A	frontend/package.json
A	frontend/src/App.tsx
A	frontend/src/LiteratureSpace.tsx
A	frontend/src/LiteratureWriters.tsx
A	frontend/src/api.ts
A	frontend/src/components.tsx
A	frontend/src/literature.css
A	frontend/src/main.tsx
A	frontend/src/projectFilters.ts
A	frontend/src/projectNavigation.ts
A	frontend/src/styles.css
A	frontend/src/types.ts
A	frontend/src/writers.ts
A	frontend/test/projectFilters.test.ts
A	frontend/test/projectNavigation.test.ts
A	frontend/test/writers.test.ts
A	frontend/tsconfig.json
A	frontend/vite.config.ts
A	package-lock.json
A	package.json
A	research/BRIEF.md
A	research/DECONSTRUCT_WORLD_STANDARD.md
A	scripts/assets.mjs
A	scripts/build_mrna_workbook.mjs
A	scripts/import-literature-documents.ps1
A	scripts/setup.mjs
```
