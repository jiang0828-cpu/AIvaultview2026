import type { WorldReport } from '../src/worldSchema.js';

export const chipEvidenceSources: WorldReport['sources'] = [
  { id: 'BISRULE', publisher: '美国联邦公报／BIS', title: 'Revision to License Review Policy for Advanced Computing Commodities', published: '2026-01-15', period: '2026年1月15日起生效', url: 'https://www.govinfo.gov/content/pkg/FR-2026-01-15/pdf/2026-00789.pdf', scope: '最终规则的生效日期和附加条件；与1月13日新闻稿同一政策来源，不算第二项独立效果证据。' },
  { id: 'HOUSELETTER', publisher: '美国众议院外交事务委员会', title: '11月4日签署的联名简报请求函', published: '2026-11-05', period: '11月4日函件，11月5日官网发布', url: 'https://foreignaffairs.house.gov/news/press-releases/chairmen-mast-moolenaar-and-crawford-request-jensen-huang-brief-congress-on-link-to-chinese-intelligence-asset', scope: '直接确认国会监督动作：请求11月18日闭门简报或另约日期，11月11日前回复。函件基于报道，不能独立确认外部人员身份，也不证明出席。' },
  { id: 'PRICES', publisher: 'Yahoo Finance', title: 'NVDA Historical Data', published: '2026-11-10', period: '美国常规交易时段11月6日与11月9日收盘', url: 'https://finance.yahoo.com/quote/NVDA/history/', scope: '历史常规收盘价186.64美元、178.67美元；价格源属于行情记录，不独立证明新闻因果。供应商11月10日存在不一致，本次不采用其精确值。' },
  { id: 'PRICECHECK', publisher: 'Stock Analysis', title: 'NVIDIA Stock Price History', published: '2026-11-10', period: '11月9日常规收盘', url: 'https://stockanalysis.com/stocks/nvda/history/?period=daily', scope: '交叉核对11月9日178.67美元、下跌4.27%；两行情商可共享交易底层来源，不冒充独立市场实验。11月10日报价与另一供应商不一致，不纳入精确计算。' },
];

export const chipEvidence: NonNullable<WorldReport['evidenceReview']> = {
  revisedOn: '2026-11-11', scope: '资料截止北京时间2026-11-11。政策、公司披露、国会监督、诉讼和市场表现按原始作用分别使用；11月10日行情供应商差异未消解，暂不计算两日累计损失。',
  method: '先把“个人行为、外部身份、信息泄露、决策干预、政治设局”拆成五个待证命题。媒体指称→国会函或董事会调查→诉状转引仍可能是同一条来源链。事件后价格变化只测关联，缺少可信反事实不估计事件损失。',
  records: [
    { id: 'rev-now', title: '总营收（精确表值）', kind: 'data', value: 96221, unit: '百万美元', period: 'FY2027 Q2，截至2026-07-26', basis: 'SEC 10-Q市场平台收入表；季度结束和申报均早于公开风波。', origin: '英伟达FY2027 Q2财务申报', sourceIds: ['10Q'] },
    { id: 'rev-old', title: '上年同期总营收', kind: 'data', value: 46743, unit: '百万美元', period: 'FY2026 Q2，截至2025-07-27', basis: '同一申报中的可比季度，非相邻季度；不是事件后的财务结果。', origin: '英伟达FY2027 Q2财务申报', sourceIds: ['10Q'] },
    { id: 'dc-now', title: '数据中心营收（精确表值）', kind: 'data', value: 89023, unit: '百万美元', period: 'FY2027 Q2，截至2026-07-26', basis: '含数据中心两类业务，不等于中国市场、个别客户或最终部署地收入。', origin: '英伟达FY2027 Q2财务申报', sourceIds: ['10Q'] },
    { id: 'charge', title: 'H200相关库存与采购义务费用', kind: 'data', value: 400, unit: '百万美元', period: 'FY2027上半年', basis: '公司披露约4亿美元。早于事件，不是已证实由私人关系导致的损失。', origin: '英伟达FY2027 Q2财务申报', sourceIds: ['10Q'] },
    { id: 'h200', title: '获许可计划的出货收入占比', kind: 'statement', period: 'FY2027 Q2', basis: '公司称该计划出货收入低于数据中心收入1%；不是中国全部收入占比，也不是获批数量交付比例。', origin: '英伟达FY2027 Q2财务申报', sourceIds: ['10Q'] },
    { id: 'price-before', title: '周末消息前常规收盘', kind: 'data', value: 186.64, unit: '美元/股', period: '美国当地2026-11-06', basis: '历史常规收盘价，非盘中、盘后或调整后收益；周末前已有10月报道，非首次曝光前基准。', origin: 'NVDA交易行情底层记录', sourceIds: ['PRICES'] },
    { id: 'price-after', title: '周末道歉后首个交易日常规收盘', kind: 'data', value: 178.67, unit: '美元/股', period: '美国当地2026-11-09', basis: '两行情页面核对一致；不能由价格本身识别披露、诉讼与其他因素的贡献。', origin: 'NVDA交易行情底层记录', sourceIds: ['PRICES', 'PRICECHECK'] },
    { id: 'admission', title: '本人承认婚内不忠', kind: 'fact', period: '2026-11-08', basis: '公司公开信直接确认承认内容；没有点名对象，没有承认泄密或干预许可。', origin: '黄仁勋个人公开承认', sourceIds: ['LETTER'] },
    { id: 'inquiry', title: '独立调查和外聘律师', kind: 'fact', period: '2026-11-08、11-10', basis: '董事会和独立董事原文确认调查程序推进；公司判断不是执法结论。', origin: '英伟达董事会公告', sourceIds: ['BOARD', 'COUNSEL'] },
    { id: 'policy', title: 'H200规则早于事件公开', kind: 'fact', period: '2026-01-13公告、01-15生效', basis: 'BIS新闻稿与最终规则是同一政策。逐案审查不等于许可自动发放或实际交付。', origin: 'BIS规则制定', sourceIds: ['BIS', 'BISRULE'] },
    { id: 'oversight', title: '国会监督动作早于11月8日', kind: 'fact', period: '2026-11-04签函、11-05公布', basis: '官网请求11月18日或另约日期简报；其身份描述来源是报道，不能作为独立身份认证。', origin: '国会程序（身份指称仍引媒体）', sourceIds: ['HOUSELETTER'] },
    { id: 'identity', title: '外部人员情报身份指称', kind: 'allegation', period: '10月29日以来报道', basis: '媒体转述美方人员判断；公开可审阅的底层材料尚不充分。中方否认，不以双方说法数量作定论。', origin: '媒体对美方情报判断的转述', sourceIds: ['AP', 'MFA'] },
    { id: 'lawsuit', title: '股东证券诉状中的误导主张', kind: 'allegation', period: '2026-11-09提交', basis: '直接确认起诉内容和提交；引用报道提出重大性与损失主张，不是法院认定。', origin: '诉状（有关身份的材料仍引媒体）', sourceIds: ['COURT'] },
    { id: 'fbi', title: '特朗普关于FBI的公开说法', kind: 'statement', period: '美国当地2026-11-09表态、11-10报道', basis: '美联社记录总统说法；未见FBI/DOJ公开调查范围或结论，不据此判定犯罪或调查对象。', origin: '总统表态／媒体转录', sourceIds: ['AP10'] },
    { id: 'platform', title: 'Vera Rubin系统平台发布', kind: 'fact', period: '2026-01-05', basis: '厂商公开CPU、GPU、互连与网络协同路线；只证明发布及设计定位，不证明性能、批量交付或客户迁移。', origin: '英伟达产品发布', sourceIds: ['RUBIN'] },
  ],
  calculations: [
    { id: 'dc-share', title: '数据中心营收占比', operation: 'share', left: 'dc-now', right: 'rev-now', unit: '%', decimals: 2, note: '89023÷96221×100=92.52%。分子是分母子集，不把两者相加；衡量业务集中度，不衡量中国敞口。' },
    { id: 'growth', title: '风波前总营收同比增速', operation: 'growth', left: 'rev-now', right: 'rev-old', unit: '%', decimals: 2, note: '(96221÷46743−1)×100=105.85%。同一公司可比季度，只是事前经营基准。' },
    { id: 'return', title: '周末前后单日价格变化', operation: 'growth', left: 'price-after', right: 'price-before', unit: '%', decimals: 2, note: '(178.67÷186.64−1)×100=−4.27%。未扣除市场及公司其他消息；不称异常收益、不等于本案损失。11月10日跨供应商不一致，排除其精确计算。' },
  ],
  claims: [
    { id: 'known', title: '个人承认和调查是已知事项', level: 'supported', conclusion: '可确认本人承认婚内不忠，以及公司开展独立调查。', reasoning: '公开信与公司行动各有直接原文，能确认它们发生；不能由调查存在倒推出被调查的指称为真。', counter: '公司调查与聘律师是治理行动，不能独立证实交往对象的身份或任何秘密受损。', verify: '后续只有明确的调查发现、访问和传递记录或法院认定，才可能提高后续命题的证据强度。', recordIds: ['admission', 'inquiry'], calculationIds: [] },
    { id: 'politics', title: '政治关注增加，不足以证明政治设局', level: 'insufficient', conclusion: '国会监督和媒体关注可确认，“被有组织设计为牺牲品”尚缺直接证据。', reasoning: '国会函、董事会和诉状可能都回应同一报道；它们独立决定采取行动，不等于独立确认情报身份。用调查等后续反应证明原指称，会形成循环论证。', counter: '正常监督、真实合规疑虑和政治借势均能产生相同外观；政策早已存在也不排除后来受到干预，需另证。', verify: '查明可认证的协调指令、决策和信息记录，并与相似案例处理作可比对照；单凭曝光时点不够。', recordIds: ['policy', 'oversight', 'identity', 'inquiry', 'lawsuit', 'fbi'], calculationIds: [] },
    { id: 'exposure', title: '公司集中于数据中心，但不是集中于该事件', level: 'bounded', conclusion: '数据中心占比约92.52%，说明系统级AI业务重要，不提供事件财务损失数额。', reasoning: '分子分母来自同一SEC表，计算可复现；公司称许可计划出货低于该业务收入1%，不能偷换成全部中国业务或转单机会。', counter: '低收入占比也不能排除长期市场机会成本；高总量增长亦不能证明后续没有治理风险。', verify: '分开核对下一期指引、许可项目收入、履约和未来客户需求，再估计增量影响。', recordIds: ['rev-now', 'rev-old', 'dc-now', 'charge', 'h200'], calculationIds: ['dc-share', 'growth'] },
    { id: 'market', title: '市场下跌可量化，原因仍需识别', level: 'bounded', conclusion: '周末前后收盘变化约−4.27%；该计算只描述时间相邻的价格变化。', reasoning: '价格页与诉状之外的行情核对可确认报价，但两家供应商可能共享交易记录，不能把数量当作两个独立因果证据。首次媒体曝光在更早时间，窗口不覆盖完整事件。', counter: '市场、行业资金流、产品消息和政策预期也会影响价格；11月10日供应商报价存在差异，不能选取有利值算累计损失。', verify: '取得统一行情、预先定义事件窗口和估计窗口，用行业/市场模型及安慰剂检验后仍只能谨慎解释异常部分。', recordIds: ['price-before', 'price-after', 'lawsuit'], calculationIds: ['return'] },
    { id: 'technology', title: '治理冲击向技术竞争传导仍是条件命题', level: 'conditional', conclusion: '只有供货、团队执行或客户部署改变，才能讨论本案对技术生态的实际增量影响。', reasoning: '平台发布说明系统复杂性，财务基准说明事前业务规模；二者均不能直接测量事件后的开发、产能和迁移。', counter: '团队、软件与客户既有投入可缓冲单人风险；相反，长期规则不确定性也可独立驱动替代。', verify: '跟踪量产与交付、支持连续性、代表性负载的独立总成本及客户实际迁移，区分一般政策和本案影响。', recordIds: ['platform', 'policy', 'inquiry', 'dc-now'], calculationIds: [] },
  ],
};
