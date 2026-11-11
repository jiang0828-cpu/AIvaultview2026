# 观天下证据升级：独立最终审计

审核日期：2026-11-11。审核对象是 `output/reviews/world-evidence-candidate` 的固定提交 `dfebbb6b16d36369fd10d464a0cc64e8d50f9278`。先冷读两份导出，再检查原始资料、代码、截图与测试；未使用其他评审意见作为判断依据，未检查主工作区无关改动，未打开浏览器 UI、读取凭据或修改产品。开始时候选工作树干净；过程中出现的未跟踪审计目录不属于被评产品。

## 读者裁决

**PASS；可以作为明确截止日期的证据型解读使用。** 两期核心数值、算式和关键程序时间线经独立复核成立。正文允许读者区分“已经测到什么”“只能支持什么”和“还须怎样检验”，没有用消费增速反推信心再循环解释消费，也没有把媒体指称经国会、董事会与诉状传播算成三次身份认证。

通过不意味着已经解释了全国居民的主观感受或量化了事件影响。第一期主要建立产出、收入、消费和周转的描述性事实；缺乏同户面板、直接预期及照护负担调查。第二期主要建立财务基准与公开程序事实；缺乏信息流转、审批干预、事件归因和客户迁移证据。正文大体正确地降低了结论强度，避免用这些缺口制造确定性。

## 发现

Critical：0。Major：0。以下均为非阻塞 Minor 或明确的验证缺口。

1. **派生值仍显示为“公布值”。** `backend/prisma/world-002-data.ts:47` 将数据中心占比92.5%标成 `kind: 'observed'`，而 `frontend/src/WorldSpace.tsx:16` 及 `frontend/src/worldModel.ts:3` 将其显示为“公布值”。旁注虽明确“由财报原始金额计算”，证据页也给出92.52%的算式，但这与 `WorldSpace.tsx:53` “避免把推导值伪装成公布值”的说明不一致。建议显示“计算值”或让该指标明确覆盖标签；不是数值错误。

2. **利润总量与企业分布的措辞须收窄。** `backend/prisma/world-evidence-001.ts:19` 及第一期国内形势段落将15.5%的利润总量增长称为“企业普遍恶化”叙述的反例。总量增长可以否定同口径总利润下降，却不能单独否定大多数企业恶化：少数大企业上涨足以盖过多数企业下降。建议改为“限制把规上工业整体写成利润下降的叙述；企业分布仍需另查”。同一结论已标“仅支持有限判断”，正文又提醒行业结构和范围，因此未构成主结论的Major推理失效。

3. **关键边界说明的小字对比度不足。** 已看两期计算卡片及结论卡片截图。布局无可见截字，移动计算卡片能换行；但 `frontend/src/world.css:69` 的计算输入与限制使用10px、`#8a978d`，背景是 `#f8fbf8`（第64行），按相对亮度公式算得对比度2.92:1；方法区小字 `#89988c` 对 `#eef4ef` 为2.71:1。它们承载分母、口径和“不能归因”等核心信息，不应过分淡化。建议正文至少12—14px并加深颜色。截图可辨认不等于适合所有手机读者。

4. **备份不是实际写入集合的同一快照。** `backend/prisma/init-world-evidence.ts:10` 先preview，第16行保存preview，再于第18行重新调用apply；这是两个事务。若期间另一管理员把某条冲突稿还原成baseline，第二次扫描会将它纳入写入，但首份备份没有该条；若首次preview无变更，还可能发生第二次apply有变更而没有备份。当前每次apply仍重新检查精确原文，因此不是发现了普通人工改稿被覆盖，也不是日常单人运行必现。建议让应用消费已备份的计划并校验before，或在同一写入计划上制作备份；补备份失败、集合变化与恢复测试。

5. **视觉验证范围小于“整页移动端通过”。** 固定候选的 `verification/world-evidence-176-mobile-320.png` 和 `...185-mobile-320.png` 只有计算卡片区域，图像宽280px；没有提供整个320px视口、长来源组、导航和结论卡片的移动截图。CSS第242—243行存在单列适配；不能从这两张裁剪图独立认定整页无横向溢出。父代理表示另做过320/390宽的DOM宽度断言，我没有将未读取的补充证据冒充本次实测。

## 最弱的五处文字

这些是实际可改之处，不以机械风格命中数代替编辑判断。

| 原句与位置 | 问题与建议 |
| --- | --- |
| “不会因此推断会。” — `backend/prisma/world-002.ts:18` | 否定套否定且缺主语。改成“不能据此认为，没有风波就不会有管制。” |
| “外部分析认为早年科技与出口强而消费偏弱” — `world-evidence-001.ts:7` | 世界银行讨论early 2026，“早年”误导时间范围。改“2026年初高科技投资和出口较强、消费偏弱”。 |
| “公司集中于数据中心，但不是集中于该事件” — `world-evidence-002.ts:38` | 业务分类与事件不是可比较维度。改“数据中心占比高，不能据此计算事件损失”。 |
| “是‘企业普遍恶化’叙述的反例” — `world-evidence-001.ts:19` | 总量不足以排除多数企业恶化；按Minor 2收窄。 |
| “增长仍在，体感为何分化？” — `world-data.ts:5` | 标题预设已经测得主观体感分化；正文实际上只测得部分客观分组差异。建议题目改“增长仍在，家庭收支为何不同步？”，或在题下更明确说明体感是待检验问题。 |

风格日志没有被静默豁免：001日志报告“不等于”11次、“下一轮／下一步”7次，002为15次和8次。重复的“下一步观察”是六维审计的稳定栏目标题；“未扣除市场及公司其他消息；不称异常收益、不等于本案损失”是必要口径限定；“政策目标不等于实施结果”阻止目标和效果混淆。这些属于任务要求下的合理结构，不能机械判为低质量。仍有真重复：001每章尾部同一句概念示例声明共六次，全报告导出中可合并一次；多处“数据与事实”先给较长论证段后又重复 `lens.fact`，可缩短。方法前置在本次证据审计中有用，但导出的整体阅读负担仍偏高。

## 新鲜原始资料核验

以下由本评审在审核时重新访问；同源多项计为多个被核对的主张，不冒充独立测量。核心核验超过10项。

| 主张 | 原始资料及结果 | 边界 |
| --- | --- | --- |
| 前三季度GDP实际增长4.6%；三季依次5.0%、4.3%、4.5% | [国家统计局发布](https://www.stats.gov.cn/sj/zxfb/202610/t20261019_1965618.html) 与 [GDP表](https://www.stats.gov.cn/sj/zxfb/202610/t20261020_1965658.html)：相符。 | 同一核算来源；GDP26原路径直接访问超时，使用同站zxfb原文核对。 |
| 全国居民收入实际4.4%、消费实际2.7% | [住户收支原表](https://www.stats.gov.cn/sj/zxfb/202610/t20261019_1965612.html)：相符；名义值分别5.3%、3.6%，候选没有混用。 | 同一抽样调查，不是独立的两份证据或同户行为面板。 |
| 城镇3.6%、农村5.6%，实际收入增速差2个百分点 | [同一住户原表](https://www.stats.gov.cn/sj/zxfb/202610/t20261019_1965612.html)：相符。 | 原文亦提醒人口构成变化；候选保留了这一限制。 |
| 城镇调查失业率前三季度平均5.2%、同比持平 | [国家统计局原发布](https://www.stats.gov.cn/sj/zxfb/202610/t20261019_1965618.html)：表中同比0.0个百分点。 | 不测个人就业感受；不能排除劳动参与率及群体构成变化。 |
| 规上工业利润15.5%，利润率5.68%、提高0.44个百分点 | [工业利润发布](https://www.stats.gov.cn/sj/zxfb/202610/t20261027_1965697.html)：相符。 | 单一官方财务统计，非全部企业；总量不是企业分布。 |
| 回收期71.6天、增加1.3天 | [同一工业发布](https://www.stats.gov.cn/sj/zxfb/202610/t20261027_1965697.html)：相符，期间为9月末。 | 周转统计不是每笔实际收款账期。 |
| WTO货物预测1.9→3.9，服务4.8→3.3 | [WTO 10月8日原文](https://www.wto.org/english/news_e/news26_e/stat_08oct26_510_e.htm)：相符。 | 同一机构不同预测版本，不是已实现增速。 |
| IMF全球2026/2027增长预测3.1%/3.4% | [IMF原文](https://www.imf.org/en/blogs/articles/2026/10/12/global-economic-resilience-is-under-strain-demanding-decisive-policy-action)：相符；正文日期10月13日。 | 是预测，URL含10月12日不能替换正文日期。 |
| 世界银行讨论高科技、出口、房地产调整与消费约束 | [世界银行7月7日原稿](https://www.worldbank.org/en/news/press-release/2026/07/07/rebalancing-growth-china-economic-update)：主要方向相符。 | 只独立核对新闻稿；未完整审计其报告底层数据，“截至6月30日”及收入不确定性具体页码未独立核实。 |
| ILO全球约四分之一职业暴露 | [ILO 2025 brief](https://www.ilo.org/publications/generative-ai-and-jobs-2025-update)：相符。 | 模型暴露不是失业、采用或中国当期实测。 |
| 营收96221、同比基数46743、数据中心89023百万美元 | [SEC 10-Q](https://www.sec.gov/Archives/edgar/data/1045810/000104581026000075/nvda-20260726.htm)：利润表与市场平台表核对一致。 | FY2027 Q2截至7月26日，对比FY2026 Q2截至7月27日；非事件后结果。 |
| H200上半年费用约4亿美元、许可计划出货收入低于数据中心1% | [同一10-Q](https://www.sec.gov/Archives/edgar/data/1045810/000104581026000075/nvda-20260726.htm)：相符。 | 公司披露；不是全部中国收入占比，也不是获批数量的交付比例。 |
| 11月8日本人承认婚内不忠并配合调查 | [公司公开信](https://nvidianews.nvidia.com/news/a-message-to-our-company)：相符。 | 没有指名对象，没有承认泄密。 |
| 11月8日独立董事委员会调查；11月10日外聘律师 | [董事会原文](https://nvidianews.nvidia.com/news/statement-from-nvidia-board-of-directors)、[独立董事原文](https://nvidianews.nvidia.com/news/statement-from-the-independent-members-of-the-nvidia-board)：相符。 | 调查存在不证明新闻指称；早期信任表态不等于结案。 |
| 国会函11月4日签署、5日公布，请求18日简报／11日前回复 | [官网发布](https://foreignaffairs.house.gov/news/press-releases/chairmen-mast-moolenaar-and-crawford-request-jensen-huang-brief-congress-on-link-to-chinese-intelligence-asset) 及其 [原函PDF](https://foreignaffairs.house.gov/sites/evo-subsites/republicans-foreignaffairs.house.gov/files/evo-media-document/11.4.26nvidialetter.pdf)：相符。 | 函明确依赖公开报道，不构成独立身份确认，也不证明出席。 |
| BIS 1月13日公告、1月15日生效，H200等有条件逐案审查 | [BIS新闻稿](https://www.bis.gov/press-release/department-commerce-revises-license-review-policy-semiconductors-exported-china)、[联邦公报规则PDF](https://www.govinfo.gov/content/pkg/FR-2026-01-15/pdf/2026-00789.pdf)：相符，规则第2页列明生效日。 | 同一政策两种文件；未就个别许可作法律效力判断。 |
| 11月9日证券诉状提交及误导主张 | [诉状原文件的媒体托管副本](https://www.courthousenews.com/wp-content/uploads/2026/11/kistemacher-vs-nvidia-complaint.pdf)：案号5:26-cv-13448、提交日期、新闻转引和主张相符。 | 读取的是原文件副本，未登录法院案卷验证后续状态；不是裁判。 |
| 11月9日中方否认间谍指称 | [外交部原文](https://www.mfa.gov.cn/fyrbt_673021/202611/t20261109_12056081.shtml)：搜索索引返回对应问答，与候选一致。 | 直接open正文检索未返回目标段落，后由官方域名搜索结果核对；只能确认表态。 |
| 财报电话会11月17日14:00 PT，季度10月25日结束 | [公司IR公告](https://investor.nvidia.com/news/press-release-details/2026/NVIDIA-Sets-Conference-Call-for-Third-Quarter-Financial-Results/default.aspx)：相符，换算北京时间18日06:00正确。 | 未来议程不等于已举行；不能把结束于10月25日的季度归因于29日后报道。 |
| Rubin 1月5日发布多组件平台 | [厂商发布](https://nvidianews.nvidia.com/news/rubin-platform-ai-supercomputer)：日期、CPU/GPU/互连/网络构成相符。 | 核对发布和定位，不把宣传性能当独立测试。 |
| 11月6日186.64、9日178.67美元，变化−4.27% | [Stock Analysis行情页](https://stockanalysis.com/stocks/nvda/history/?period=daily)：两条收盘记录和变化相符。 | Yahoo本次429，未独立重现“两商一致”；行情商不是交易所原始带，不计入上述原始统计／文件核验数量，也不产生独立因果识别。 |

AP10链接在本次工具中不可访问，故“特朗普11月9日说FBI调查”的原始录音或一手记录未独立核实；候选将它标成媒体转录的公开表态而非FBI结论，证据等级合理。未独立取得匿名备忘录、信息访问材料或调查结论，不能把这些说法提高到“已核实事实”。本次未重新核查政府工作报告、NASA背景图和UN人口报告的全部内容。以上限制不应被“来源数量很多”掩盖。

## 计算、来源独立性和实证覆盖

独立执行候选计算函数得到：001为1.7、2.0个百分点；002为92.52%、105.85%、−4.27%，与手工算式和导出一致。分子分母的单位与期间明确；财务业务构成不相加；住户增速差没有变成储蓄率；价格变化没有改称异常收益或诉讼损失。候选产品与导出明确排除11月10日报价及两日累计损失；早期研究笔记不作为产品当前结论。

来源组用于诚实标注依赖，而非把“不同机构”自动当成独立验证。世界银行复用官方数据、GDP发布会和核算表同源、BIS新闻稿和规则同源、媒体—国会—诉状同链、行情商可能共享交易记录，都被明确写出。官方统计单一原始测量并不因缺少虚构的第二测量而扣分。

可提高覆盖的方向仍很具体：第一期可加入现有官方行业利润分布、收入中位数和分组消费事实，以支持“分化”而不仅是声明不能推断；主观预期、照护负担、资产负债和AI真实采用仍需新资料。第二期缺少市场／行业对照、预先定义的事件窗口、客户行为及审批记录，所以当前可以严谨描述，不能估计事件增量。现有推演已注明条件，未要求把这些尚不可得材料伪造为完成的实证研究。

## 工程与验证

检查了 `worldSchema.ts`、两期world/evidence数据、正文生成、`WorldSpace.tsx`、`worldModel.ts`、CSS、升级函数与CLI及两侧world测试。

- `evidenceReview`可选，旧版报告兼容；引用存在性、ID唯一性、有限数值、数字记录类型、同单位计算、计算输入归属和零分母拒绝逻辑成立。schema验证不了真实世界的因果或数值语义，这仍是编辑审核职责。
- 升级函数按系统项目、期次、标题、类型及精确baseline描述匹配；修改过的description保留为conflict，写入仅description，标签和排序未重建；事务内所有候选先检查后应用，重复运行无变更。缺失／歧义节点使事务报错，而非盲目修复；这是保守行为。没有新增路由或扩大权限。
- 本评审重跑 `node --import tsx --test frontend/test/world.test.ts`：5/5通过。另执行10个内存schema断言：两期有效、旧版无review有效，以及缺来源、缺输入、零分母、Infinity、单位错、缺记录引用、缺计算引用均拒绝；全部通过，并复算五项结果。禁用了tsx缓存，未写测试文件或连接应用数据库。
- 已读固定候选日志：后端30/30、前端30/30、typecheck、lint、build成功；build有既有大chunk警告。后端集成测试本次未重跑，因为它需要临时数据库写入且本评审只获准写审计文件；不把日志检查冒充新执行。
- 现有测试验证普通description冲突、元数据保留和重复升级；尚未覆盖CLI备份失败／恢复、preview与apply间变化、移动端全页DOM行为、所有新schema拒绝分支。手工计算和结构断言不能替代内容事实审核。
- 已视觉检查四张固定截图（两期claims、两期mobile-320），两期公式与结论未见裁切、数字错误或重叠；小字与覆盖边界见Minor 3、5。未新增UI运行，也未宣称完整浏览器可访问性认证。

加权分为87.85/100；correctness和logic均达到9，其余达到8，无Critical/Major。剩余问题降低呈现与维护分数，不改变本次“可作为受限证据解读使用”的结论。

REVIEWER: gpt-6-astra (requested configuration confirmed by parent; not independently introspected)
ARTIFACT: dfebbb6b16d36369fd10d464a0cc64e8d50f9278
SCORES: correctness=9.3, logic=9.1, coverage=8.3, presentation=8.0, maintainability=8.5
VERDICT: PASS
USE: yes
