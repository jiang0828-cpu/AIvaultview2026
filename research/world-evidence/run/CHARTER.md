# 观天下前两期证据复核: charter

Type: research · Started: 2026-11-11 · Folder: `E:\AI\Codex\AGIOS\07AI_VaultFolio_钥藏\research\world-evidence\run` · Budget, mode and progress: see STATE.md

## Goal
用户要求“基于这个科学逻辑，基于这个基础的数据论证……论证要严格，符合逻辑……基于各种事实加以这个支持，最后才是这种推演”。在现有局域网项目中完成两期内容与证据呈现升级。

## What the user will do with it
Written at intake from PROMPTS.md, quoted, never paraphrased. Copy this section unchanged into every worker brief and every gate prompt; reviewers check it first.
- In the user's words: “对前两期进行优化，利用 marathon skill，优化并完善”。
- They will: 在观天下前两期阅读数据、事实、论证和条件推演，追溯原始来源并下载完整报告。
- Wrong if: 公式不可复算；把引述相同材料当作独立确认；由消费弱推出信心弱再用信心弱解释消费弱；推演伪装成已知事实；破坏人工编辑。

## The user's problems (reproduce before marking fixed)
Every problem the user points out gets a row in their words, plus the steps that show it. Mark it fixed only with evidence from the same steps (a screenshot, clip or measurement); `marathon.py status` counts them and reviewers re-check each row. Before fixing one, look for the same kind of problem elsewhere.
| # | The user's words | How to reproduce | Status (open / fixed) | Evidence |
|---|---|---|---|---|
| U1 | 数据论证要严格，最后才是推演 | 查看两期证据页和导出 | fixed | audits/verification.md；output/playwright/world-evidence-176.md及185.md，完整证据先于情景；两期整页截图与5项复算 |

## Benchmark
Format: report
可复核中文研究报告：统计期、单位、总体范围明确；每个核心结论列证据、推理、替代解释和证伪条件。不同媒体引同一统计不冒充独立测量。

Adjusted bar (only when the benchmark is out of reach; also edit the FLOOR line below):
| Dimension key | 10 means | 8 means |
|---|---|---|

## Acceptance targets
Hard targets, each checked by a script or a count. Put ✅ in the Status cell only when the check passed on the current build; `marathon.py score` counts ✅ rows and requires all of them for TARGET MET.
| # | Criterion | Target | How measured | Status |
|---|---|---|---|---|
| G1 | 两期台账 | 各≥8条含口径、原始来源组 | 12/15条，schema测试 | ✅ |
| G2 | 复算 | 各≥2项从台账计算 | 2/3项；1.7、92.52、105.85、−4.27复算 | ✅ |
| G3 | 推理 | 各≥4个结论有反证、验证条件 | 每期5项，结构校验 | ✅ |
| G4 | 事实更正 | 国会函、生效、FBI日期正确 | 官方函/最终规则/报道事件日期 | ✅ |
| G5 | 浏览与导出 | 两期证据视图及导出可用 | 桌面/390/320截图与真实下载 | ✅ |
| G6 | 编辑保护 | 定向升级保留人工编辑并报告冲突 | DB回归测试，线上重复0变更 | ✅ |
| G7 | 工程 | tests/typecheck/lint/build | 30+32tests通过，三检查通过 | ✅ |
| G8 | 独立评审 | 无Critical/Major且两位USE yes | audits/opus-final.md、astra-final.md；固定c0c2172，两位PASS、USEyes，科学附加floor满足 | ✅ |

## Gate rubric
Machine-read by `marathon.py score`: keys must match the gate's SCORES line exactly; weights sum to 100. Optional lines: `FLOOR: key=7, …` (default 8 per key), `PASS_TOTAL: 85`, and `NA:` listing the only keys a reviewer may mark n/a (e.g. map_dataviz for a site without maps). Fix these before the first gate.
RUBRIC: share_ready=25, correctness=10, answers_questions=20, decision_value=15, depth=15, presentation=15
FLOOR: share_ready=8, correctness=9, answers_questions=8, decision_value=8, depth=8, presentation=8
NA: 

配置更正（2026-11-11，首个machine-scored轮次前）：采用skill默认report profile六项，消除此前Format=report但自定义keys不一致。另保留原科学审核的correctness/logic/coverage/presentation/maintainability评分作为附加门槛：correctness、logic≥9，其余≥8；无Critical/Major、两位USEyes。不能靠读者体验分抵消科学逻辑不合格。产品候选SHA不变，原审查内容和报告保留。

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
| R-1 | 数据→事实→论证→情景，准确可追溯 | 2026-11-11 | ✅ done：27条记录、5项复算、10条论证；audits/verification.md |
| R-2 | 完善两期内容、保留历史截止和人工编辑 | 2026-11-11 | ✅ done：保留asOf；精确旧版本升级、备份、冲突及幂等测试通过 |
| R-3 | marathon执行、测试、独立审核 | 2026-11-11 | ✅ done：62tests、typecheck/lint/build、精确候选双独立审计及最终门禁通过 |

## Rejected options and don'ts
-

## References and inputs
| Input | Use (build on / reference only / tooling only) |
|---|---|

## Tools & access
- Tools: Node/npm/Git/Python及现有Playwright CLI可用；磁盘23GB，不创建大体积素材。
- Logins verified: 沿用当前项目本地登录验证授权，不输出凭据。
- Paid tools approved: none (subscription and free routes only)

## Assumptions (defaults taken without asking)
- balanced最多4并发，研究两条线、前端一条线、主代理集成；现有订阅，无新增付费。12小时上限，不人为用满。
- 单独保存本轮台账，不覆盖根目录其他项目已完成的marathon记录。两期数据截止维持11月10日/11日，复核日期11月11日。

## Parameter ledger (research and models)
| Parameter | Value | Date | Source |
|---|---|---|---|
