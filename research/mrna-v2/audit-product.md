# mRNA v2 独立产品与工程审核

审核日期：2026-11-10。候选 SHA：`b4fd03d0644e29b4549999a53cf4444df70693b9`。

本报告为独立原生代理审核，不冒充 Claude 或不可用的第二模型后端。范围为产品、数据呈现、生成链路、模板保留和下载鉴权；不代替原始临床事实的逐来源审核。依据 CHARTER、STANDARD、QA；读取候选 UI/CSS/App、研究生成器、迁移脚本、测试和工作簿，并查看既有桌面截图。未占用共享浏览器会话。审核后出现的未提交修订不计为本候选已通过。

## Critical

未发现。

## Major

### M1. 终点文本丢失治疗臂、终点分母与非百分比单位

定位：`scripts/build_mrna_v2.mjs:20` 的 `endpointText`，下游 `frontend/src/MrnaResearchSpace.tsx:84` 的结果展示与 Markdown 报告。

候选格式器只保留 `%` 单位，不输出 `arm` 和 `n`。可直接复核 `E-BNT111-PH2`：原始 endpoints 含组合/BNT111单药/cemiplimab单药及各自 n=94/46/44，生成的结果却为三个没有组名的 ORR：18.1%、17.4%、13.6%；PFS=3.1 和 OS=20.7 均丢失“月”。Excel Endpoints 页保留这些字段，但页面和报告的主要结果文本没有保留，导致三组数字不能可靠归属，违反 STANDARD 的逐数字口径要求。

修订要求：结果文本保留治疗臂、各终点 n、完整单位、对照与 CI；对 BNT111 三组以及按月/按人计量建立有意义的回归断言。不能只在 raw JSON 中保留字段而让用户的主要展示缺失。

### M2. 图表数据独立写死，后续更新会产生静默漂移

定位：`scripts/build_mrna_v2.mjs:33`、`:43`，及 `scripts/build_mrna_v2_workbook.mjs:35` 的 Summary 判断。

森林图 HR/CI、安全率、样本量和随访全部直接写在 chart 对象中；`v940SourceIds` 通过搜索整条 evidence 的 1137 字符串选取，未按分析 ID/终点 ID 绑定。现值与候选 evidence 一致，但编辑 findings 的 V940 endpoint/safety 后重新运行生成器，图表仍会显示旧值。工作簿 Summary 也另写 HR 文本。现有测试仅检查预设值和 CI 大小，没有验证派生一致性。用户需要持续更新最新研究，故此缺陷影响本轮同源交付承诺。

修订要求：按稳定分析 ID、终点和安全性字段派生图表及 Summary；对缺失字段明确报错/不绘图，绝不能替换成 0。加入修改输入后派生结果随之变化以及图表与 evidence 同值的测试。

### M3. 模板只对正文做 hash，却覆盖用户修改的其他字段

定位：`backend/prisma/init-mrna.ts:31`、`:33`、`:35`。

`safe` 仅验证 `description`，但随后更新 `type`、`scene`、`topics`、`sortOrder` 等字段。复现条件：已生成文档的正文不变，管理员仅改标签或排序，然后再次执行 mRNA seed；正文 hash 仍匹配，用户标签/排序会被模板写回。首次没有 baseline 时，正文只要包含 ownership marker 也会获得更新权限；marker 不证明其后用户没有改正文。现有测试未覆盖 mRNA 迁移及仅元数据编辑。

修订要求：对所有将被写入的受管字段做完整 ownership fingerprint；旧 baseline 迁移仅在完整元数据匹配已知模板时放行，不能凭 marker 或历史前缀放行。测试未改模板可更新、正文编辑保留、仅标签/排序/类型修改保留及重复运行。

## Minor

1. `frontend/src/mrna-research.css:143` 将来源 ID 列固定为 38px 且禁止收缩，`REG-NCT...` 等长 ID 没有断行规则，会伸入后方来源正文。应设置可读列宽并允许断行，同时约束正文 `min-width: 0`，复核移动端来源页。
2. `E-ITI5000-2026` 无公开结果时，生成的 `endpoint`/`result` 都为空字符串；`EvidenceItem` 直接渲染为空白。应明确显示“尚无公开结果/未披露”，并测试零 endpoints 场景。
3. 管线“重置筛选”只清 query/route/country/status，不清 scope，且单独启用 scope 时不显示重置按钮。应统一清空全部筛选；筛选后已选中的旧试验详情也应避免留在不包含该行的结果下造成混淆。
4. `output/playwright/mrna-desktop-final.png` 显示 103 来源，候选 JSON/Excel 为 102，说明截图早于来源去重修正。最终候选应重取截图，不能用旧截图作最终数据一致性证据。
5. 工作簿 Trials 日期单元格重新导入为字符串，虽然设置了日期格式但不是 Excel 原生日期。当前 ISO 日期可排序，影响较小；若要支持真正日期筛选/计算，应转换完整日期，保留月粒度和未披露原文。

## 已验证与限制

- 独立运行 `npm test`：backend 22/22、frontend 23/23，全部通过；现有测试不足以发现上述三个 Major。
- 使用 bundled Python/openpyxl 只读导入：11 个 sheet；Summary 30/65/16/102；Trials/Evidence/Sources/BD 的全量 ID 和顺序逐项匹配 JSON；38 个数值终点在工作簿中仍为数值；错误单元格 0。
- 注册台账范围分为核心扩展 57、相邻技术 5、相邻排除 3，合计 65；计数明确含相邻，未将入组数直接当疗效分析分母。药物归一计数剔除 ctDNA 观察记录后的 30，不能解读为全球管线数。
- 无结果与 null 入组数没有被画成 0；缺失结果文案问题见 Minor 2。负向 CRC/BNT113 保留；原始 endpoints 及 Excel 还保留了临床展示未输出的字段。
- 下载走 `/media` 统一 authorize，具有 `private, no-store`；独立重跑的 API 测试证实 JSON/Excel 匿名 401、已登录访客 200。未读取或输出凭据。
- 页面可切换概览、证据、管线、技术BD与来源。现有截图第一屏图表确有数据；本次未新建浏览器会话，不将既有截图等同于本代理交互实测。
- 本轮未独立重跑 typecheck/lint/build，QA 记录三者通过。修订后应重新跑相应检查、工作簿比对和桌面/移动端截图。

原候选不宜直接交付：必须先解决三个 Major 并复核新 SHA。产品可用性及工程可靠性尚不满足 STANDARD 的“每项至少 8/10、无 Major”要求。

USE: no
