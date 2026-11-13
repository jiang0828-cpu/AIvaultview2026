# Progress reports

Every progress report sent to the user, newest last (`marathon.py report --mark --save`).

## 2026-11-11T22:30 · since 2026-11-11T22:30
# 碌碌无为001｜交付与验收记录

状态：可用版本已交付，内容、页面、工程与Astra独立FULL完成；Marathon正式双审G6因Claude渠道不可用保留未完成，没有宣称FINAL PASS。

入口：[灵活用工，普通人的权益如何保障？](http://10.5.2.31:5180/home?project=201&lifeView=issues&lifeIssue=205)。这是现有局域网开发预览，需使用已有授权账号访问；没有公开发布或改动服务端口。

当前固定候选：`67f6e0387fd86188d28cf16a015f48ee6d08677b`，父版本 `3f7cf16502d98e8eca0e4123f546153138d0a0da`。候选仅在 `output/reviews/livelihood-flexible-work-candidate` 的本地独立仓库提交，主工作树及其他任务改动未暂存、回滚或提交，没有推送远端。

## 已实现

- 四层内容：现状、问题、分析、方案，四篇正文合计5021字符，另有结构化权益对照和行动工作表。
- 5类关系、5项问题、3条机制与替代解释、6项分主体措施、4条具体处境路径、8项证据清单、3项后续观察。
- 12333与12348电话链接、两处官方网络入口、四类首次求助说明、辖区核对和正式收件证明要求。区分咨询、平台报案、普通工伤和试点职业伤害申请，明确职业病依法诊断、鉴定的起算要求。
- 四层及来源切换、关系对照、责任主体筛选、来源检索、深链接及刷新、完整Markdown报告下载，保留管理员修改的章节正文。
- 来源台账22条，成稿引用17条，资料截止2026-11-11。10份HTTP原文快照已保存，7条注明抓取限制；S20仅核验官方搜索可见段落，未保存完整通知。

没有开展访谈或代表性调查，不将官方个案推作行业发生率，也不编造因果效应、胜诉概率或理赔结果。具体平台、任务、当地渠道和法律适用仍须结合个人事实核对。

## 验证

| 检查 | 实测结果 |
| --- | --- |
| 主工作区命令 | `npm test`：54后端+43前端=97通过；typecheck、lint、build均exit0 |
| 固定候选独立检查 | r3为97测试、typecheck、build及源码lint均exit0，含完整/回退报告真实GFM表格渲染测试 |
| 浏览器 | 1440/390/320宽度，15阅读状态通过；26主流程布局+3期限补拍检查无横溢，控制台无错误 |
| 阅读交互 | 5关系、4场景、6主体、17来源、12处依据展开；刷新、返回、无效期次、未认证访问通过 |
| 实际下载 | r3为62266bytes，三个宽度下载SHA256一致；198个必需内容项完整，35行证据映射正确，无内部来源ID残留，真实ReactMarkdown/GFM渲染1table/2th/36tr |
| 注释及文风脚本 | 报告与实际下载notes均2.6/千字，建议cap10；脚本结果不是独立审核结论 |
| 数据 | r2事务只更新206–210的description，其余108行hash相同；r3全部113行前后hash相同，原107条baseline全部保留，重复seed新增0 |
| 清理 | 本次随机测试账号、日志、授权、会话、浏览器数据及browser锁已清理 |

候选的裸 `npm run lint` exit1：全目录ESLint扫入未跟踪的审计原始脚本片段。失败原日志保留，未改冻结证据来掩盖错误。精确源码检查命令 `npm run lint -- --ignore-pattern research/livelihood-flexible-work/run/audits/**` exit0，仅排除审计产物。主工作区裸lint原本exit0。Vite仍有既有的大包体积警告，不是构建失败。

证据：[r2 ops完整报告](../../.tmp/reports/flexible-work-ops-r2.full.md)、[r3 ops报告](../../.tmp/reports/flexible-work-ops-r3.full.md)、[完整浏览器结果](../../output/playwright/life001-r2/browser-result.json)、[当前下载检查](../../output/playwright/life001-r3/download-validation.json)、[当前完整性](../../output/playwright/life001-r3/integrity.json)。r3仅重跑刷新/下载三宽度；9个UI/CSS/data/navigation文件同hash，按范围复用r2完整15状态，不声称全部重跑。冻结r2包88文件，manifest SHA256 `3c928d8012d4fae381ead2300fd6c1584ff15ce761cc3e32c2531de12b8ecc7c`；前两轮冻结包保持不变。

当前r3冻结证据包68文件，入口为候选目录 `research/livelihood-flexible-work/run/audits/round-3/evidence/EVIDENCE.md`，manifest SHA256 `a4284ef572837bff52b93f38db0a6428f3ea0f73c8d255931d1044c2177f1b88`。28个主工作区与候选重点文件hash一致，17条成稿来源、10份原文快照和7项保存限制均已独立对照。

## 独立审核状态

首轮Astra FULL：75分、0Critical、2Major、USE no。[r2独立FULL审核](run/audits/round-2/astra.md)逐项确认下载注释、内部标签、实际办理入口、工伤起算及输入/回滚检查修复，85.5分、0Critical、0Major、USE yes。新Minor N3为导出证据表被空行拆散；r3已修并补真实GFM渲染测试。

[最终fresh Astra FULL审核](run/audits/round-3/astra.md)对当前SHA独立给出87.25分、0Critical、0Major、USE yes，重新确认M1/M2/N1/N2/N3消除；独立核验20项主张、12项前端测试、10组schema负例、source-only lint、真实GFM表格及35映射、68文件冻结包哈希。保留重复书目/结论和部分抽象长句等编辑建议。三个分数都是Astra单槽，不是两种模型合并评分。

Opus CLI实际模型 `claude-opus-5` 在29turn后HTTP402中断，未形成完整审计；Sonnet最小探测也402，既有订阅未认证。没有购买额度、切换付费服务或冒称5.5审核。见[不可用记录](run/audits/CLAUDE_UNAVAILABLE.md)。正式G6要求双FULL、双USE yes，仍未满足，不能宣称FINAL PASS。

## 使用前仍需人工核对

- 当地12333、12348的实际接听安排、所在地管辖与当前可用的正式提交窗口；本次只测href，没有拨打热线或提交真实申请。
- 个人实际管理、付款与参保事实，具体平台/业务/任务是否在试点范围，以及各项请求的起算、期限和材料要求。
- 法律援助的本地受理条件、补正和回执效力；免费咨询不等于所有案件均获免费代理。

## 剩余事项与建议

1. 保留当前已验收的局域网版本（推荐）：无需追加工程，可立即阅读和下载；G6标为未完成，不把可用交付写成正式双审通过。
2. 既有Claude渠道恢复后补原定双FULL：预计0.5—1.5小时审核和记录，不含外部账号恢复等待；对同一固定SHA复核，不重做已验收内容。若产品变动，按实际范围重新检查。没有授权购买额外服务。

本次从20:31至约22:30，历时约2小时，12小时默认预算未耗尽，停止原因是唯一未完成的第二审核渠道，不是预算。`marathon.py usage`已执行，但缺少lead Token基线和完整CLI计量，实际Token/费用未知，不能把零记录当成零消耗；未批准或开通新增付费工具。具体状态及恢复步骤见[STATE](run/STATE.md)和[CHARTER](run/CHARTER.md)。
