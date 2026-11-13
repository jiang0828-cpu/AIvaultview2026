# 市场调研四维子代理工作台: charter

Type: site · Started: 2026-11-11 · Folder: `E:\AI\Codex\AGIOS\07AI_VaultFolio_钥藏\research\market-workbench\run` · Budget, mode and progress: see STATE.md

## Goal
实施用户确认的“市场调研｜四维子代理工作台”计划：事业工作场景，通用模板、手动分派四任务、录入报告来源结论、四项完成后可追溯汇总与导出，保留历史版本与现有资料。

## What the user will do with it
Written at intake from PROMPTS.md, quoted, never paraphrased. Copy this section unchanged into every worker brief and every gate prompt; reviewers check it first.
- In the user's words: “项目用于把一次市场调研拆成四个独立研究任务，再由总控任务统一汇总”。
- They will: 创建调研、复制四个提示词手动分派、录入报告/来源/3—8条分类结论，全部提交后汇总、人工审核和导出。
- Wrong if: 没有执行外部代理却声称已自动研究；部分任务或过期结果仍冒充正式汇总；未授权修改或版本丢失。

## The user's problems (reproduce before marking fixed)
Every problem the user points out gets a row in their words, plus the steps that show it. Mark it fixed only with evidence from the same steps (a screenshot, clip or measurement); `marathon.py status` counts them and reviewers re-check each row. Before fixing one, look for the same kind of problem elsewhere.
| # | The user's words | How to reproduce | Status (open / fixed) | Evidence |
|---|---|---|---|---|
| U1 | 四个子代理任务，再由总控任务统一汇总 | 新建调研→四任务录入→提交→汇总→导出→重开任务检验汇总过期 | fixed | output/playwright/market/ 的两份实际下载及六视图截图；market-ops.full.md |

## Benchmark
Format: tool
沿用现有项目空间和权限习惯，工作台应提供清楚的任务状态、可编辑来源/结论表单、可追溯汇总与历史比较；首屏为可操作项目界面，不用营销介绍替代工具。
BENCHMARK: none 当前库没有同格式的多任务研究编排工具；采用既有任务/权限交互与上面的可用性标准，不把宏观阅读专题当作可交互研究工具的等价样板。

Adjusted bar (only when the benchmark is out of reach; also edit the FLOOR line below):
| Dimension key | 10 means | 8 means |
|---|---|---|

## Acceptance targets
Hard targets, each checked by a script or a count. Put ✅ in the Status cell only when the check passed on the current build; `marathon.py score` counts ✅ rows and requires all of them for TARGET MET.
| # | Criterion | Target | How measured | Status |
|---|---|---|---|---|
| G1 | 初始化与数据保护 | work项目、通用调研恰4任务、重复0 | 隔离测试/定向seed/原113条Content全列hash一致 | ✅ |
| G2 | 任务与权限 | 读/编辑/撤权/状态/校验/版本/冲突正确 | 后端66项测试含研究11项及授权回归 | ✅ |
| G3 | 汇总与导出 | 完整四任务门槛，分类来源对应，修改过期 | 真实浏览器审核与stale两次Markdown下载 | ✅ |
| G4 | 页面 | 六视图、复制编辑版本对比、三宽度无溢出 | 六视图×1440/390/320截图和完整UI流程 | ✅ |
| G5 | 工程 | tests/typecheck/lint/build通过 | release日志：66+47 tests及其余三命令exit0 | ✅ |
| G6 | 独立复核 | 固定SHA双FULL，0Critical/Major，双USEyes | Astra工程修复复核0critical/major；本任务Opus最小探测402，正式双FULL未完成 | blocked |

## Gate rubric
Machine-read by `marathon.py score`: keys must match the gate's SCORES line exactly; weights sum to 100. Optional lines: `FLOOR: key=7, …` (default 8 per key), `PASS_TOTAL: 85`, and `NA:` listing the only keys a reviewer may mark n/a (e.g. map_dataviz for a site without maps). Fix these before the first gate.
RUBRIC: share_ready=30, accuracy=10, coverage=10, visual_design=20, map_dataviz=5, phone=5, voice=5, speed=5, interaction=10
FLOOR: map_dataviz=7, phone=7, voice=7, speed=7, interaction=7
NA: map_dataviz

## Scoring card (copy into every worker brief; from templates/scoring/tool.json)
你的作品会这样被打分：及格 85 分；任何一项低于它满分的规定比例都不能通过。
最看重：
1. 愿意拿给同事用（30 分，底线 80%）：评审以同事身份用一遍：用户会不会把链接发给同事
2. 视觉（20 分，底线 80%）：设计评分卡达标
3. 准确（10 分，底线 80%）：抽查记录与一手来源一致
会被扣分（该项最多拿到的比例；同一项只按最低的一条封顶，不累加；“愿意拿给…”不受封顶）：
- 注释过多 → 文字 最多 60%：正文每千字超过 7 处“来源 / 截至 / [S12]”；来源放抽屉、脚注或方法页
- 判断格式本身 → 文字 最多 60%：概率表、到期日、复核日、“倾向发生 / 不发生”、“判断按……写”；年终报告这类需要时除外
- 首屏计数句或讲文档自己的话 → 文字 最多 60%：如“12 条判断：6 条倾向发生，4 条……”“本页口径”
- 去 AI 味脚本给出的上限 → 文字 最多 ai_tells.py 建议的分：de-ai scripts/ai_tells.py 的建议（含同一句式重复 3 次以上）；评审证明是误报才可不封顶
- 缺了同事一定会问的重要内容 → 覆盖 最多 70%：评审要说出具体缺什么；不按固定板块清单查
- 用户上次提的理由还没解决 → 对应项 最多 70%：对应的评分项（不含 share_ready）
评审流程：
- 评审先冷读：只看用户的原话，以同事身份打开作品，先给 share_ready（愿意拿给同事）打分，再看其他材料
- 执行者交付前、评审打分时都跑 de-ai scripts/ai_tells.py（旁白加 --spoken），引用结果
- 做到 15–20% 时把预览发给用户看方向（不问分数，默认继续）
- 用户的分数低于及格线时，评审通过也不上线：继续干活，发预览只问能不能上线

## User calibration
The user's own 0-100 scores outrank the reviewers (references/review-principles.md). One line per score; the last counts. `marathon.py score` turns a reviewer pass into USER CHECK while the latest is below the pass total.
<!-- USER_SCORE: 62 sha=abc1234 date=2026-11-04 -->
| Date | Artifact | Score | Reasons (verbatim) | Status per reason |
|---|---|---|---|---|

## Intake (ask batch, defaults, answers; must-decide never defaults)
| # | Question | Default offered | Answer |
|---|---|---|---|

## Ledger: requirements (R) and questions (Q) from PROMPTS.md
Every user message is checked against this table. Q items are answered directly; R items are built.
| id | Requirement or question | Date | Status (open / done / answered / rejected: why) |
|---|---|---|---|
| R-1 | 实施用户确认的市场调研四维子代理工作台计划 | 2026-11-11 | done；工程和浏览器验证通过，G6双模型认证限制单列 |

## Rejected options and don'ts
-

## References and inputs
| Input | Use (build on / reference only / tooling only) |
|---|---|

## Tools & access
- Tools: Node/npm/Prisma SQLite、现有Express/React、Playwright、本地Marathon；使用独立临时测试身份，禁止输出凭证。
- Logins verified: 浏览器阶段由ops隔离账号核验并finally清理。
- Paid tools approved: none (subscription and free routes only)

## Assumptions (defaults taken without asking)
- 已确认事业工作、通用模板、手动分派、报告+来源+结论、四项完成汇总。每个项目支持多次调研建档，临床任务对非医疗对象调整为真实用户需求。
- 不调用真实代理/模型API；汇总为来源关联的材料归并，重要建议由人工总控填写与审核。
- 不新增付费工具，沿用5180/3101局域网服务；只做新表迁移和定向初始化，不执行全库seed。

## Parameter ledger (research and models)
| Parameter | Value | Date | Source |
|---|---|---|---|
