# 精准医疗行业简报内容扩充与质量提升: charter

Type: research · Started: 2026-11-12 · Folder: `E:\AI\Codex\AGIOS\07AI_VaultFolio_钥藏\.marathon\precision-brief-expansion` · Budget, mode and progress: see STATE.md

## Goal
在不降低证据标准的前提下，扩充精准医疗行业简报的新闻覆盖、栏目密度和分析深度，使每个固定栏目在有可靠新增时达到可读的2–3条，并明确区分事实、关注点、业务点评和证据边界；用户原话：“整体日报新闻数量和内容还是较少，请进一步优化，利用 marason 技能进行优化完善”。

## What the user will do with it
Written at intake from PROMPTS.md, quoted, never paraphrased. Copy this section unchanged into every worker brief and every gate prompt; reviewers check it first.
- In the user's words: “整体日报新闻数量和内容还是较少，请进一步优化，利用 marason 技能进行优化完善”。
- They will: 打开局域网项目空间阅读日报，用于快速掌握精准医疗行业消息、关注点及对世和基因业务的启发。
- Wrong if: 仍只有少量消息；用搜索摘要或旧闻凑数；增加数量却没有真实来源、发布日期、事实边界和业务点评。

## The user's problems (reproduce before marking fixed)
Every problem the user points out gets a row in their words, plus the steps that show it. Mark it fixed only with evidence from the same steps (a screenshot, clip or measurement); `marathon.py status` counts them and reviewers re-check each row. Before fixing one, look for the same kind of problem elsewhere.
| # | The user's words | How to reproduce | Status (open / fixed) | Evidence |
|---|---|---|---|---|
| U1 | 整体日报新闻数量和内容还是较少 | 扩充前首期仅7条，五栏密度不均 | fixed | 发布版12条，五栏计数2/3/2/2/3；浏览器与下载回归通过 |

## Benchmark
Format: report
固定五栏、消息与业务点评分离的专业行业日报。以原文可复核、短文有数据与边界、摘要给出关注优先级、移动端及导出完整为质量基准，具体借鉴记录见research/benchmark/BORROW.md。

Adjusted bar (only when the benchmark is out of reach; also edit the FLOOR line below):
| Dimension key | 10 means | 8 means |
|---|---|---|

## Acceptance targets
Hard targets, each checked by a script or a count. Put ✅ in the Status cell only when the check passed on the current build; `marathon.py score` counts ✅ rows and requires all of them for TARGET MET.
| # | Criterion | Target | How measured | Status |
|---|---|---|---|---|
| G1 | 新闻覆盖密度 | 首期发布版总数至少12条；五栏每栏至少2条，除非研究日志明确证明该栏窗口内只有1条可靠新增 | 统计当前发布JSON，核对五栏计数和每条来源 | – |
| G2 | 证据完整性 | 每条有唯一HTTP(S)原文、发布机构、发布日期、访问时间，且无重复事件、未来日期和占位文本 | npm run precision:validate与来源抽查 | – |
| G3 | 内容深度 | 每条消息、关注点、业务点评合计不超过300字；每栏点评至少覆盖研发、临床、支付、商业化或运营中的一个具体影响 | 校验脚本和人工抽查10条 | – |
| G4 | 可读交付 | 项目当前日报、来源页、运行记录和Markdown/HTML下载均与新版本一致；桌面和320px移动端无横向溢出 | Playwright截图、下载内容和页面接口检查 | – |

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
| R-1 | 扩充整体日报新闻数量与内容，利用marathon优化完善 | 2026-11-12 | done；12条、五栏2/3/2/2/3，事实边界与点评已修订，等待最终独立gate |

## Rejected options and don'ts
-

## References and inputs
| Input | Use (build on / reference only / tooling only) |
|---|---|
| 当前已发布日报与PM-daily/briefs/2026-11-12.json | build on；仅作为结构和质量基线，所有事实重新核验 |
| PM-daily/AGENTS.md、sources.json、prompts/precision-brief.md | build on；扩展来源导航、子代理提示和质量门 |
| 官方监管、企业IR、论文和临床注册原文 | research；关键事实的一手证据 |

## Tools & access
- Tools: <from preflight>
- Logins verified: <list, date>
- Paid tools approved: none (subscription and free routes only)

## Assumptions (defaults taken without asking)
-

## Parameter ledger (research and models)
| Parameter | Value | Date | Source |
|---|---|---|---|
