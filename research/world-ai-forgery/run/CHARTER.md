# 观天下第三期：AI造假与应对措施: charter

Type: research · Started: 2026-11-11 · Folder: `E:\AI\Codex\AGIOS\07AI_VaultFolio_钥藏\research\world-ai-forgery\run` · Budget, mode and progress: see STATE.md

## Goal
把用户给出的“AI造假”长文改造成证据型第三期：校正技术与因果上的绝对化表达，收集一手来源，按数据/事实→论证/反证→条件推演组织内容，并新增独立、可执行、可验收的“应对措施”层。

## What the user will do with it
Written at intake from PROMPTS.md, quoted, never paraphrased. Copy this section unchanged into every worker brief and every gate prompt; reviewers check it first.
- In the user's words: “观天下 第三期：利用`  marathon  ` skill , 优化并完善，总结证据和要点”；后续补充：“增加一层 应对措施”。
- They will: 在局域网观天下项目中阅读第三期的证据、要点和应对措施，并下载完整报告。
- Wrong if: 把生成能力写成诈骗发生率；把来源凭证或水印写成事件真实性证明；只有口号没有责任主体、步骤、局限和验收指标。

## The user's problems (reproduce before marking fixed)
Every problem the user points out gets a row in their words, plus the steps that show it. Mark it fixed only with evidence from the same steps (a screenshot, clip or measurement); `marathon.py status` counts them and reviewers re-check each row. Before fixing one, look for the same kind of problem elsewhere.
| # | The user's words | How to reproduce | Status (open / fixed) | Evidence |
|---|---|---|---|---|
| U1 | 数据、事实、论证和推演要分层 | 阅读第三期证据页与导出 | fixed | ../verification.md：12记录、2复算、6结论、完整报告下载比对 |
| U2 | 增加一层应对措施 | 点击“应对措施”页并检查主体、步骤、局限、指标 | fixed | ../verification.md：6组字段逐项检查，1440/390/320截图及刷新通过 |

## Benchmark
Format: report
可复核的中文研究报告：核心事实有期间、口径和原始来源；数字能复算；机制判断给出反证；应对措施可被负责人执行和审计，明确技术与法规的边界。

Adjusted bar (only when the benchmark is out of reach; also edit the FLOOR line below):
| Dimension key | 10 means | 8 means |
|---|---|---|

## Acceptance targets
Hard targets, each checked by a script or a count. Put ✅ in the Status cell only when the check passed on the current build; `marathon.py score` counts ✅ rows and requires all of them for TARGET MET.
| # | Criterion | Target | How measured | Status |
|---|---|---|---|---|
| G1 | 一手来源 | ≥10条，跨技术、法规、风险与治理 | 13来源，12原文归档+1欧盟条文提取；source-manifest.json | ✅ |
| G2 | 证据台账 | ≥12条记录、≥2项复算、≥5条结论 | 12记录、2复算、6结论；schema与focused14tests | ✅ |
| G3 | 应对层 | 6组措施，均含主体、步骤、局限、指标和来源 | responses结构、6组逐项导出比对、9布局检查 | ✅ |
| G4 | 交付 | 第003期可从期次选择、证据/应对/导出可用 | 实库193、6专题、期次切换、刷新和下载通过 | ✅ |
| G5 | 工程 | tests/typecheck/lint/build | 全量79tests、typecheck/lint/build通过；candidate独立复跑 | ✅ |
| G6 | 独立评审 | 0 Critical/Major，双USE yes | 074b6fe：Opus5与Astra各0Critical/0Major、USEyes | ✅ |

## Gate rubric
Machine-read by `marathon.py score`: keys must match the gate's SCORES line exactly; weights sum to 100. Optional lines: `FLOOR: key=7, …` (default 8 per key), `PASS_TOTAL: 85`, and `NA:` listing the only keys a reviewer may mark n/a (e.g. map_dataviz for a site without maps). Fix these before the first gate.
RUBRIC: share_ready=25, correctness=10, answers_questions=20, decision_value=15, depth=15, presentation=15
FLOOR: presentation=7
NA: 

## Scoring card (copy into every worker brief; from templates/scoring/report.json)
你的作品会这样被打分：及格 85 分；任何一项低于它满分的规定比例都不能通过。
最看重：
1. 愿意拿给同事看（25 分，底线 80%）：评审以同事身份读完：用户会不会直接转给同事，不用改
2. 回答了问题（20 分，底线 80%）：用户问的每个问题都有直接答案
3. 有看法（15 分，底线 80%）：给出明确看法和理由；概率、到期日只在年终报告这类场合用
会被扣分（该项最多拿到的比例；同一项只按最低的一条封顶，不累加；“愿意拿给…”不受封顶）：
- 注释过多 → 版面 最多 60%：正文每千字超过 7 处“来源 / 截至 / [S12]”；来源放抽屉、脚注或方法页
- 判断格式本身 → 有看法 最多 60%：概率表、到期日、复核日、“倾向发生 / 不发生”、“判断按……写”；年终报告这类需要时除外
- 首屏计数句或讲文档自己的话 → 版面 最多 60%：如“12 条判断：6 条倾向发生，4 条……”“本页口径”
- 去 AI 味脚本给出的上限 → 版面 最多 ai_tells.py 建议的分：de-ai scripts/ai_tells.py 的建议（含同一句式重复 3 次以上）；评审证明是误报才可不封顶
- 缺了同事一定会问的重要内容 → 回答了问题 最多 70%：评审要说出具体缺什么；不按固定板块清单查
- 只列证据，没有自己的建议 → 有看法 最多 50%：每一节要落到“我建议……因为……”；免责只说一次（2026-11-05）
- 用户上次提的理由还没解决 → 对应项 最多 70%：对应的评分项（不含 share_ready）
评审流程：
- 评审先冷读：只看用户的原话，以同事身份打开作品，先给 share_ready（愿意拿给同事）打分，再看其他材料
- 评审引用 5 句最像机器写的话
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
| R-1 | 用一手资料纠正AI造假原稿并总结证据和要点 | 2026-11-11 | open |
| R-2 | 新增可执行的应对措施层 | 2026-11-11 | open |
| R-3 | 沿用观天下证据页、期次切换、Markdown导出和局域网验证 | 2026-11-11 | open |

## Rejected options and don'ts
-

## References and inputs
| Input | Use (build on / reference only / tooling only) |
|---|---|

## Tools & access
- Tools: <from preflight>
- Logins verified: <list, date>
- Paid tools approved: none (subscription and free routes only)

## Assumptions (defaults taken without asking)
-

## Parameter ledger (research and models)
| Parameter | Value | Date | Source |
|---|---|---|---|
