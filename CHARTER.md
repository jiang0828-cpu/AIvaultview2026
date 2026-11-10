# 完善解构世界科技特长专业成长空间: charter

Type: site · Started: 2026-11-10 · Folder: `E:\AI\Codex\AGIOS\07AI_VaultFolio_钥藏` · Budget, mode and progress: see STATE.md

## Goal
按用户要求，用 marathon 先建立交付标准与提示词，再优化并完善“爱的城堡 / 解构世界”-科技特长（专业）板块及其四类资料，直到可在局域网交付，并以独立审核确认无 Critical/Major 问题。

## What the user will do with it
Written at intake from PROMPTS.md, quoted, never paraphrased. Copy this section unchanged into every worker brief and every gate prompt; reviewers check it first.
- In the user's words: “用 marathon skill，优化并完善结构世界板块，并完善各模块内容，直至可以交付，先生成标准和提示词，再执行，最后审核确认”
- They will: 在局域网打开“爱的城堡”，进入“解构世界”-科技特长（专业），使用成长计划、阶段方案、成果展示和专业成长记录来安排学习、记录实践、整理证据并展示作品。
- Wrong if: 四类资料只剩标题或空洞说明；用户无法在栏目之间切换、返回或刷新后保持位置；移动端溢出、访客获得编辑权限，或测试未覆盖核心流程。

## The user's problems (reproduce before marking fixed)
Every problem the user points out gets a row in their words, plus the steps that show it. Mark it fixed only with evidence from the same steps (a screenshot, clip or measurement); `marathon.py status` counts them and reviewers re-check each row. Before fixing one, look for the same kind of problem elsewhere.
| # | The user's words | How to reproduce | Status (open / fixed) | Evidence |
|---|---|---|---|---|
| U1 | 优化并完善“解构世界”板块及各模块内容，直到可以交付 | 登录后打开 /home?project=99&folder=104，查看四类资料、栏目切换、任务进度和详情 | fixed | `output/playwright/deconstruct-world-mobile-final.png`、`audits/round-1/lead-review.md` |
| U2 | 先生成标准和提示词，再执行，最后审核确认 | 查看 CHARTER.md、PROMPTS.md、research/BRIEF.md、审核报告和测试证据 | fixed | `research/DECONSTRUCT_WORLD_STANDARD.md`、`REPORTS.md` |

## Benchmark
Format: site
以可交付的中文知识工作台为标准：第一次打开就能看懂项目层级和下一步；内容模板可以直接填写；专业成长有可视化路径与反馈；桌面和手机均可用；管理员和访客权限清楚。参考 DOCX 提供内容结构基线，现有 VaultFolio 提供数据与视觉基线。

Adjusted bar (only when the benchmark is out of reach; also edit the FLOOR line below):
| Dimension key | 10 means | 8 means |
|---|---|---|

## Acceptance targets
Hard targets, each checked by a script or a count. Put ✅ in the Status cell only when the check passed on the current build; `marathon.py score` counts ✅ rows and requires all of them for TARGET MET.
| # | Criterion | Target | How measured | Status |
|---|---|---|---|---|
| G1 | DOCX 内容基线已提取 | 标题、表格、图片/附件意图和方法论均有记录 | research/BRIEF.md 有来源、提取方法和映射表 | ✅ |
| G2 | 内容结构 | 四类资料可访问；每类至少包含目标、行动/阶段、证据、复盘或下一步字段 | seed 检查 + API/前端测试 | ✅ |
| G3 | 项目导航 | 项目首页、三个子栏目、详情、返回和刷新路径均正确；无效 folder 不越界 | projectNavigation 测试 + 浏览器证据 | ✅ |
| G4 | 交互反馈 | Tab 切换、任务勾选、进度显示和 localStorage 恢复可用 | 前端测试 + 浏览器验证 | ✅ |
| G5 | 权限 | 未登录 401，访客不能 CRUD，管理员可编辑/新增/删除 | castle.test.ts | ✅ |
| G6 | 响应式 | 390px 和桌面无横向溢出、标题/表格不重叠 | Playwright 截图与 scrollWidth 检查 | ✅ |
| G7 | 工程质量 | test、typecheck、lint、build 全部通过 | npm 命令输出 | ✅ |
| G8 | 可交付审核 | 独立审核无 Critical/Major，两个 reviewer 均 USE: yes | audits/、REPORTS.md | ✅ |

## Gate rubric
Machine-read by `marathon.py score`: keys must match the gate's SCORES line exactly; weights sum to 100. Optional lines: `FLOOR: key=7, …` (default 8 per key), `PASS_TOTAL: 85`, and `NA:` listing the only keys a reviewer may mark n/a (e.g. map_dataviz for a site without maps). Fix these before the first gate.
RUBRIC: accuracy=20, coverage=20, visual_design=20, phone=15, speed=10, interaction=15, maintainability=10
NA: map_dataviz
FLOOR: accuracy=8, coverage=8, visual_design=8, phone=8, speed=7, interaction=8, maintainability=7
PASS_TOTAL: 85

## User calibration
The user's own 0-100 scores outrank the reviewers (references/review-principles.md). One line per score; the last counts. `marathon.py score` turns a reviewer pass into USER CHECK while the latest is below the pass total.
<!-- USER_SCORE: 62 sha=abc1234 date=2026-11-04 -->
| Date | Artifact | Score | Reasons (verbatim) | Status per reason |
|---|---|---|---|---|

## Intake (ask batch, defaults, answers; must-decide never defaults)
| # | Question | Default offered | Answer |
|---|---|---|---|
| 1 | 是否沿用当前数据库、Content 树和现有局域网入口 | 沿用，不改 schema | 已采用 |
| 2 | 是否允许补充通用方法、检查清单和空白模板字段 | 允许，但不虚构个人事实 | 已采用 |

## Ledger: requirements (R) and questions (Q) from PROMPTS.md
Every user message is checked against this table. Q items are answered directly; R items are built.
| id | Requirement or question | Date | Status (open / done / answered / rejected: why) |
|---|---|---|---|
| R-1 | 使用 marathon 流程完成优化、内容补全和审核 | 2026-11-10 | done |
| R-2 | 参考 DOCX 作为内容基线 | 2026-11-10 | done |
| R-3 | 先标准和提示词，再执行，最后审核 | 2026-11-10 | done |

## Rejected options and don'ts
- 不新增数据库 schema，不重建现有登录、权限、项目导航。
- 不覆盖已有用户编辑，不把模板中的空白字段伪装成真实案例。
- 不引入 Docker、Redis、OSS、FFmpeg 或外部付费服务。

## References and inputs
| Input | Use (build on / reference only / tooling only) |
|---|---|
| C:\Users\admin\Desktop\“解构世界”-科技特长（专业）.docx | reference only：提取结构、字段和内容意图，映射到现有模板 |
| backend/prisma/castle.ts | build on：现有“爱的城堡”幂等 seed |
| frontend/src/App.tsx、components.tsx、styles.css | build on：现有项目入口与交互 |

## Tools & access
- Tools: Python、Git、Node、npx、Chrome、Pillow；Playwright Python 缺失，使用现有浏览器验证。
- Logins verified: <list, date>
- Paid tools approved: none (subscription and free routes only)

## Assumptions (defaults taken without asking)
- 继续使用当前局域网服务地址，内容以中文为主。
- “解构世界”是专业成长工作台，不扩展为个人账户体系或文件上传系统。
- 参考 DOCX 可能包含模板/说明而非事实数据，正文只吸收结构与方法。

## Parameter ledger (research and models)
| Parameter | Value | Date | Source |
|---|---|---|---|
