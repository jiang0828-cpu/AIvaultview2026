# 碌碌无为001：灵活用工与普通人的权益: charter

Type: research · Started: 2026-11-11 · Folder: `E:\AI\Codex\AGIOS\07AI_VaultFolio_钥藏\research\livelihood-flexible-work\run` · Budget, mode and progress: see STATE.md

## Goal
“碌碌无为 001期 灵活用工，普通人的权益如何保障？从现状/问题/分析/方案，分析和拆解问题，利用 marason 技能进行优化完善，直至完成任务”。完成有证据、有边界、有可执行方案的首期专题，并接入现有项目和报告导出。

## What the user will do with it
Written at intake from PROMPTS.md, quoted, never paraphrased. Copy this section unchanged into every worker brief and every gate prompt; reviewers check it first.
- In the user's words: “灵活用工，普通人的权益如何保障？从现状/问题/分析/方案，分析和拆解问题”。
- They will: 在碌碌无为项目阅读首期、比较不同用工关系的权利、按场景查找证据和求助路径，并下载报告。
- Wrong if: 将灵活就业一律认定劳动关系或不认定劳动关系；将试点职业伤害保障等同所有人自动享有工伤/五险；承诺诉讼结果、遗漏时限例外、引用过时政策为现状；只有概念而没有行动。

## The user's problems (reproduce before marking fixed)
Every problem the user points out gets a row in their words, plus the steps that show it. Mark it fixed only with evidence from the same steps (a screenshot, clip or measurement); `marathon.py status` counts them and reviewers re-check each row. Before fixing one, look for the same kind of problem elsewhere.
| # | The user's words | How to reproduce | Status (open / fixed) | Evidence |
|---|---|---|---|---|
| U1 | 从现状/问题/分析/方案，分析和拆解问题 | 打开001期四层导航，阅读完整报告 | fixed | r2/browser-result.json四层及来源三宽度15/15切换；r3/download-validation.json下载198项齐全、GFM1table/36tr，UI/CSS/data身份对照支持复用r2 |

## Benchmark
Format: report
同类中文公共政策专题：从普通人的具体任务切入，基于法律原文、政策、官方案例给出关系分类与行动路径。清楚区分法律义务、政策指引、实践问题和编辑建议；图表不伪造调查，来源可核对，普通读者可以执行。
BENCHMARK: none 当前无完全同格式的本地栏目首期，采用上述可复核公共政策专题标准；技术沿用现项目，不复制宏观模板。

Adjusted bar (only when the benchmark is out of reach; also edit the FLOOR line below):
| Dimension key | 10 means | 8 means |
|---|---|---|

## Acceptance targets
Hard targets, each checked by a script or a count. Put ✅ in the Status cell only when the check passed on the current build; `marathon.py score` counts ✅ rows and requires all of them for TARGET MET.
| # | Criterion | Target | How measured | Status |
|---|---|---|---|---|
| G1 | 研究证据 | ≥12一手来源，有日期/支持范围；2026政策核验 | 台账22条，成稿17条；原文归档10，7条抓取限制如实记录，S20仅官方检索段落核验；原文抽查 | ✅ |
| G2 | 内容 | 现状/问题/分析/方案四篇详实正文，关系分类≥4，问题≥5 | 四篇5021字符，5关系/5问题；schema及导出验证 | ✅ |
| G3 | 行动 | ≥6分主体措施、≥4场景路径、证据清单/期限/辖区边界 | 6措施/4路径/8清单/3观察；2官方服务入口，4首次联系说明；核对法律及2025职伤办法13、15条 | ✅ |
| G4 | 页面 | 首期入口、四层切换、筛选、完整导出、刷新，1440/390/320不溢出 | r2三宽度15/15状态、29布局检查；r3三宽度刷新/下载62266bytes、198项无缺失/rawIDs空、真实GFM1table/2th/36tr；9个UI/CSS/data文件同hash支持复用r2 | ✅ |
| G5 | 工程及数据 | tests/typecheck/lint/build过；seed重复0，保留旧内容 | 主54后端+43前端=97通过，类型/裸lint/build通过；r2候选源码lint0但审计片段令裸lint1，准确披露；r3全部113行hash未变、107原baseline全同、seed0、QA身份会话日志清理0残留 | ✅ |
| G6 | 独立审核 | 固定SHA双FULL，0Critical/Major、双USEyes | 最终67f6e038的fresh Astra FULL87.25分、0Critical/0Major、USEyes，M1/M2/N1/N2/N3均确认修复；Opus402无完整报告，Sonnet及订阅替代不可用，正式双审仍缺第二槽 | – |

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
| R-1 | 创建碌碌无为001期灵活用工权益保障专题，四层拆解并完成测试与复核 | 2026-11-11 | open：内容/页面/97测试/工程检查/Astra FULL已完成；仅正式双审G6因Claude渠道不可用待补 |

## Rejected options and don'ts
-

## References and inputs
| Input | Use (build on / reference only / tooling only) |
|---|---|

## Tools & access
- Tools: 本地Node/npm/Prisma、官方原文浏览、Playwright CLI；仅定向seed，独立只读QA身份。
- Logins verified: 随机隔离visitor及201/175授权，2026-11-11；验证后清理，不公开凭据。
- Paid tools approved: none (subscription and free routes only)

## Assumptions (defaults taken without asking)
- 中国大陆范围，地方办理差异明确标注。未开展访谈/代表性调查，不编造效果数据。

## Parameter ledger (research and models)
| Parameter | Value | Date | Source |
|---|---|---|---|
