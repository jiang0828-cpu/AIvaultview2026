import type { WorldReport } from '../src/worldSchema.js';

export const macroEvidenceSources: WorldReport['sources'] = [
  { id: 'HH26', publisher: '国家统计局', title: '2026年前三季度居民收入和消费支出情况', published: '2026-10-19', period: '2026年前三季度', url: 'https://www.stats.gov.cn/sj/zxfb/202610/t20261019_1965612.html', scope: '住户调查：居民实际收入增速4.4%、实际消费增速2.7%，城乡收支和名义中位数。与GDP不同总体；调查汇总不能代替同户因果识别。' },
  { id: 'GDP26', publisher: '国家统计局', title: '2026年三季度国内生产总值初步核算结果', published: '2026-10-20', period: '2026年前三季度', url: 'https://www.stats.gov.cn/sj/zxfbhjd/202610/t20261020_1965658.html', scope: '不变价增加值：信息软件业增长10.4%，建筑业下降4.1%。行业产出增速不代表岗位、工资或利润。与GDP发布会是同一核算来源。' },
  { id: 'PROFIT26', publisher: '国家统计局', title: '2026年1—9月份全国规模以上工业企业利润增长15.5%', published: '2026-10-27', period: '2026年1—9月及9月末', url: 'https://www.stats.gov.cn/sj/zxfb/202610/t20261027_1965697.html', scope: '规上工业企业：利润增长15.5%，利润率5.68%并提高0.44个百分点；回收期71.6天并增加1.3天。不能外推全部企业，存量与流量不能直接比较。' },
  { id: 'WB26', publisher: '世界银行', title: 'China Economic Update: Rebalancing Growth', published: '2026-07-07', period: '2026年7月版，数据截至6月30日', url: 'https://www.worldbank.org/en/news/press-release/2026/07/07/rebalancing-growth-china-economic-update', scope: '外部分析认为早年科技与出口强而消费偏弱，提出资产与不确定性机制；底层部分仍引用官方数据，不是第二份独立住户测量，不用于证明三季度因果。' },
];

export const macroEvidence: NonNullable<WorldReport['evidenceReview']> = {
  revisedOn: '2026-11-11', scope: '保持本期资料截止2026-11-10。使用同一年前三季度收支数据及规上工业1—9月资料；不把全国平均数当作每户经历。',
  method: '先比较同口径数据，再找不同资料的交叉支持和反例，最后提出机制。没有同户面板、可识别的政策冲击和直接主观感受调查时，不估计因果强度。“消费较慢→信心弱→消费较慢”不能形成独立证据链。',
  records: [
    { id: 'gdp', title: '实际GDP同比增长', kind: 'data', value: 4.6, unit: '%', period: '2026年前三季度', basis: '不变价国内增加值初步核算；非家庭收入、非全年预测。', origin: '国家统计局GDP核算', sourceIds: ['NBS26', 'GDP26'] },
    { id: 'income', title: '居民人均可支配收入实际增速', kind: 'data', value: 4.4, unit: '%', period: '2026年前三季度', basis: '全国住户抽样加权汇总、扣除价格影响；不是同一户收入变化分布。', origin: '国家统计局住户收支调查', sourceIds: ['HH26'] },
    { id: 'consumption', title: '居民人均消费支出实际增速', kind: 'data', value: 2.7, unit: '%', period: '2026年前三季度', basis: '全国住户调查实际同比；与收入同期，但增速差不等于边际消费倾向或储蓄率。', origin: '国家统计局住户收支调查', sourceIds: ['HH26'] },
    { id: 'urban', title: '城镇居民收入实际增速', kind: 'data', value: 3.6, unit: '%', period: '2026年前三季度', basis: '按常住地分类的人均可支配收入，人口构成可变化。', origin: '国家统计局住户收支调查', sourceIds: ['HH26'] },
    { id: 'rural', title: '农村居民收入实际增速', kind: 'data', value: 5.6, unit: '%', period: '2026年前三季度', basis: '与城镇同表同期间；增速快不表示绝对收入更高。', origin: '国家统计局住户收支调查', sourceIds: ['HH26'] },
    { id: 'profit', title: '规上工业利润同比增长', kind: 'data', value: 15.5, unit: '%', period: '2026年1—9月', basis: '按可比口径的利润总额，反驳规上工业利润总量下降；不能说明多数企业改善，也不代表小微或服务业。', origin: '国家统计局规上工业财务统计', sourceIds: ['PROFIT26'] },
    { id: 'margin', title: '规上工业营业收入利润率', kind: 'data', value: 5.68, unit: '%', period: '2026年1—9月', basis: '利润与营业收入比率；同比提高0.44个百分点，不能由价格篮子直接推算。', origin: '国家统计局规上工业财务统计', sourceIds: ['PROFIT26'] },
    { id: 'days', title: '应收账款平均回收期', kind: 'data', value: 71.6, unit: '天', period: '2026年9月末', basis: '规上工业企业公开指标，较上年同期增加1.3天；非全部企业逐笔实收账期。', origin: '国家统计局规上工业财务统计', sourceIds: ['PROFIT26'] },
    { id: 'unemployment', title: '城镇调查失业率平均值', kind: 'data', value: 5.2, unit: '%', period: '2026年前三季度', basis: '同比持平。总量均值不能证明青年、行业或个体就业不变，也不支持全面失业恶化。', origin: '国家统计局劳动力调查', sourceIds: ['NBS26'] },
    { id: 'wb', title: '外部机构的结构性解释', kind: 'statement', period: '2026年7月版，非前三季度测量', basis: '世界银行认为消费弱于科技和出口，提出房地产与收入不确定性机制；独立分析但复用部分官方底层数据。', origin: '世界银行研究分析（部分底层数据为国家统计局）', sourceIds: ['WB26'] },
    { id: 'policy', title: '扩大内需政策方向', kind: 'fact', period: '2026年度部署', basis: '可验证政策文件的存在和目标；没有效果评估就不能判断转化率。', origin: '政府工作报告', sourceIds: ['GOV26'] },
    { id: 'ai', title: '职业任务暴露研究', kind: 'statement', period: 'ILO 2025研究', basis: '职业任务的模型估计，全球约四分之一；非2026中国失业率、采用率或裁员概率。', origin: 'ILO任务暴露模型', sourceIds: ['ILO25'] },
  ],
  calculations: [
    { id: 'gap', title: '收入与消费实际增速差', operation: 'difference', left: 'income', right: 'consumption', unit: '个百分点', decimals: 1, note: '同期住户数据4.4−2.7=1.7。只说明收入与消费增速不同步，无法从差值求边际消费倾向或判定信心下降。' },
    { id: 'rural-gap', title: '城乡收入实际增速差', operation: 'difference', left: 'rural', right: 'urban', unit: '个百分点', decimals: 1, note: '5.6−3.6=2.0。人口构成可变，不能解读为某户迁移导致收入提高2个百分点。' },
  ],
  claims: [
    { id: 'not-sync', title: '增长不自动等比例变成消费', level: 'supported', conclusion: '前三季度实际GDP、实际居民收入和消费均增长；消费增速低于收入。', reasoning: '国民核算与住户调查分别测量总体产出和家庭收支。后两项同表同期的差值可复算；GDP只作背景，不能直接与收入增长相减来求分配效果。', counter: '消费仍正增长，不能把较慢增长说成消费下降；价格调整、样本构成和支出时点也会影响结果。', verify: '后续按同口径跟踪收支，并寻找同户面板与收入分组结果，才判断哪类家庭的行为改变。', recordIds: ['gdp', 'income', 'consumption'], calculationIds: ['gap'] },
    { id: 'heterogeneity', title: '分组差异有直接数据，但不能替个人发言', level: 'bounded', conclusion: '城乡收入实际增速不同，足以支持分组观察，不足以判断每个人的体感方向。', reasoning: '住户表内同期间的农村和城镇增速差为2个百分点，表明统一全国增速会丢失群体信息；没有直接主观评价就不估计体感比例。', counter: '不同基数和人口迁移也可导致增速差；农村增长更快不等于其收入绝对值更高。', verify: '取得固定群体的收入、支出、就业与直接感受调查，确认分组差异是否持续。', recordIds: ['urban', 'rural', 'income'], calculationIds: ['rural-gap'] },
    { id: 'profits', title: '利润改善与回款变慢可以同时出现', level: 'bounded', conclusion: '规上工业利润和利润率改善，但平均回收期增加，不能只选一类信号。', reasoning: '同一财务统计内同时保留盈利反证与周转信息，支持多指标审视；利润是期间流量，回收期是财务周转指标，不能据此求损失金额。', counter: '行业结构、账期策略和客户组合均可改变回收期；不证明所有企业现金流都变差。', verify: '联查行业利润、应收账款和经营现金流，比较同类企业且控制季节和统计范围变化。', recordIds: ['profit', 'margin', 'days'], calculationIds: [] },
    { id: 'confidence', title: '“信心弱”目前不是已验证的原因', level: 'insufficient', conclusion: '不能仅凭消费慢于收入，就确认是预防性储蓄、照护负担或资产下跌导致。', reasoning: '住户汇总不是同户行为记录。世界银行有机制分析，但时段较早且部分数据同源；缺少直接预期调查及可识别的外生变化。', counter: '支出时间、家庭构成和相对价格都能产生类似汇总变化；城镇调查失业均值同比持平也限制了全面恶化叙述。', verify: '补充独立主观调查、同户收入波动与负担、资产和支出信息；若预期稳定且消费变化由时点解释，应下调信心假说。', recordIds: ['consumption', 'income', 'unemployment', 'wb'], calculationIds: ['gap'] },
    { id: 'policy-test', title: '政策和技术的生活收益仍须条件验证', level: 'conditional', conclusion: '只有订单、岗位质量和可支配收入等中间环节改善，才增强政策或技术收益扩散的解释。', reasoning: '政策目标与技术可用性是机制起点，不能用其存在证明终点已经发生。以企业执行、家庭响应和替代解释逐步检查。', counter: '任务暴露可能带来岗位重组，也可能扩张新需求；宏观就业均值未恶化不代表转换成本不存在。', verify: '按政策实施前后及可比群体观察就业和收入，并以任务质量、返工时间和实际薪资检验技术效果。', recordIds: ['policy', 'ai', 'unemployment'], calculationIds: [] },
  ],
};
