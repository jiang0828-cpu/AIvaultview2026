import type { ResearchConclusion, ResearchSource } from '../src/researchSchema.js';

export const cdxStudyTitle = '001｜肿瘤伴随诊断市场进入';
export const cdxAsOf = '2026-11-12';
export const cdxObject = '中国肿瘤伴随诊断（CDx）市场进入，海外注册与临床证据对照；限定选药及有明确治疗动作的监测用途，不将早筛或一般肿瘤谱分析等同于CDx。';
export const cdxGoal = '判断进入条件、筛选BD合作路径，形成四维发现对照、一致结论、冲突与待澄清问题、机会风险优先级及后续尽调清单。企业现有资质、预算、癌种和目标省份尚未指定，因此输出有条件建议，不作投资回报承诺。';

function source(id: string, title: string, publisher: string, published: string, url: string, supports: string): ResearchSource {
  return { id, title, publisher, published, url, supports, verified: false };
}
function conclusion(text: string, type: ResearchConclusion['type'], ...sourceIds: string[]): ResearchConclusion {
  return { text, type, sourceIds };
}

export const cdxTasks = [
  {
    kind: 'macro' as const, title: '宏观政策、医保支付与产业资本', assignedTo: 'macro_researcher',
    sources: [
      source('M1', '病理检查诊断价格立项精细化', '国家医疗保障局', '2025-12-19', 'https://www.nhsa.gov.cn/art/2025/12/19/art_14_19086.html', '病理类立项设立原位核酸杂交、核酸测序等价格项目；支持依法依规收费，不能据此认定地方报销。'),
      source('M2', '收官之作！检验类立项指南正式发布', '国家医疗保障局', '2026-08-14', 'https://www.nhsa.gov.cn/art/2026/8/14/art_14_21764.html', '指南覆盖分子诊断等板块，662个主项目；联检收费规则不能直接换算某一CDx产品实际价格。文中约1300亿元为整体IVD，非CDx市场。'),
      source('M3', '国家医保服务项目目录第一批制定方案', '国家医疗保障局', '2026-09-16', 'https://www.nhsa.gov.cn/art/2026/9/16/art_14_22149.html', '区分服务价格项目规范和医保支付目录制定；不是全部检测项目已经统一纳入支付。'),
      source('M4', 'Burning Rock Reports Second Quarter 2026 Financial Results', 'Burning Rock Biotech', '2026-09-10', 'https://ir.brbiotech.com/news-releases/news-release-details/burning-rock-reports-second-quarter-2026-financial-results', '2026Q2收入1.347亿元，同比下降9.3%；院内收入增长7.4%，药企研发服务收入下降31.8%；净亏损1840万元。公司披露，不代表行业整体。'),
      source('M5', 'National Coverage Determination 90.2: Next Generation Sequencing', '美国CMS', '2020-01-27', 'https://www.cms.gov/medicare-coverage-database/view/ncd.aspx?NCDId=372&bc=AAAAEAAAAAAA', '现行版本生效日期；全国覆盖与地方承保权限有具体患者、检测、适应证及实验室条件，非所有NGS检测普遍报销。'),
    ],
    conclusions: [
      conclusion('事实层：国家病理和检验价格立项已推进；判断层：需要核验目标省份落地；不能继续使用“全国没有相关立项”的笼统判断。', 'multiple_sources', 'M1', 'M2'),
      conclusion('判断层：注册、收费、医保支付、采购和回款是不同环节。取得价格项目不能证明某检测已获得支付或采购。', 'inference', 'M1', 'M3'),
      conclusion('事实层：燃石2026Q2院内业务与药企研发服务收入变动方向不同；不确定性：单家公司数据不足以判断行业融资周期或纯CDx份额。', 'single_source', 'M4'),
      conclusion('判断层：美国CMS支付规则可作条件化支付的对照，不能直接迁移为中国支付预期。', 'inference', 'M5'),
    ],
    limitations: '没有完成中国CDx专项融资数据库统计、目标省份结算核验或医院采购访谈。公司财务为公司披露且覆盖多种业务，不能当作CDx专项市场或全行业统计。价格立项发布日期不等于地方执行日期。',
    openQuestions: '目标省份是否执行对应项目？哪些用途可支付、有哪些限制？医院采购主体、账期、坏账和外送结算如何？拟合作方现金、受限资金、客户集中度及融资条件是什么？',
    report: `# 宏观政策、医保支付与产业资本

## 事实
国家医保局2025年发布病理类价格立项指南，包含病理样本原位核酸杂交、核酸测序等项目；2026年发布检验类指南，覆盖分子诊断等板块。[M1](https://www.nhsa.gov.cn/art/2025/12/19/art_14_19086.html) [M2](https://www.nhsa.gov.cn/art/2026/8/14/art_14_21764.html)

价格规范与医保支付目录是两个问题。2026年9月文件是医保服务项目目录第一批制定方案，不应解读为全国肿瘤检测支付已经统一，也不能因部分检测尚未单列就断言全部不能报销。[M3](https://www.nhsa.gov.cn/art/2026/9/16/art_14_22149.html)

燃石2026Q2收入1.347亿元，同比下降9.3%；院内业务增长7.4%，药企研发服务下降31.8%；净亏损1840万元。期末现金、现金等价物及受限现金合计4.191亿元，这一合计不能全部视为可自由支配现金。[M4](https://ir.brbiotech.com/news-releases/news-release-details/burning-rock-reports-second-quarter-2026-financial-results)

## 判断
政策环境有利于形成规范服务，但企业收入仍须逐关验证：产品及用途注册、地方收费依据、支付限制、医院准入、采购合同、实际结算。DRG/DIP背景下，应向医院说明检测如何改变治疗路径，而不是仅说明其技术先进。

资本环境不宜仅用融资新闻数量判断。应核查交易完成情况、估值条件、现金消耗、应收账款及客户集中度；药企研发订单受项目阶段影响，临床渠道则涉及医院采用和实际回款。两类业务应分别建模。

美国CMS NCD90.2也有检测、患者、癌种、实验室及CDx用途等条件，并存在地方承保裁量，不能当作所有NGS检测普遍报销的依据。[M5](https://www.cms.gov/medicare-coverage-database/view/ncd.aspx?NCDId=372&bc=AAAAEAAAAAAA)

## 不确定性
本轮不能提供可靠的中国CDx专项融资总量、统一医保支付价或全国平均净价。检验指南中的整体IVD规模不应用作CDx规模。招标预算、试剂采购价、患者收费和实际医保支付也不能混用。

## 对BD的影响
先选目标省份与医院，取得可核验的结算路径；药企项目争取按验证、桥接、注册和检测交付拆分里程碑。尚未确认付款方的机会保留为候选，不计入确定性收入。`,
  },
  {
    kind: 'product_tech' as const, title: '技术成熟度与未来突破方向', assignedTo: 'tech_researcher',
    sources: [
      source('T1', 'Recommendations for the use of NGS for patients with advanced cancer in 2024', 'ESMO Precision Medicine Working Group / Annals of Oncology', '2024-05-27', 'https://pubmed.ncbi.nlm.nih.gov/38834388/', '多种晚期肿瘤推荐NGS；泛瘤种检测需考虑匹配治疗可及性，不支持笼统否定多基因检测。'),
      source('T2', 'ESMO recommendations on the use of circulating tumour DNA assays', 'ESMO / Annals of Oncology', '2022-07-06', 'https://pubmed.ncbi.nlm.nih.gov/35809752/', 'ctDNA假阴性及部分融合、拷贝数改变局限；无信息结果后考虑组织反射检测。早期指南对MRD效用的判断需结合后续特定用途证据更新。'),
      source('T3', 'FDA approves atezolizumab for adjuvant treatment of MIBC in patients with molecular residual disease', '美国FDA', '2026-05-15', 'https://www.fda.gov/drugs/cancer-approvals/fda-approves-atezolizumab-adjuvant-treatment-muscle-invasive-bladder-cancer-patients-molecular', '阿替利珠单抗及Signatera CDx特定膀胱癌术后MRD用途；IMvigor011随机250例，DFS HR0.64、OS HR0.59，不外推其他癌种。'),
      source('T4', 'FDA grants accelerated approval to camizestrant with a CDK4/6 inhibitor', '美国FDA', '2026-09-04', 'https://www.fda.gov/drugs/cancer-approvals/fda-grants-accelerated-approval-camizestrant-cdk46-inhibitor-esr1-mutated-hr-positive-her2-negative', '特定ESR1动态ctDNA选择治疗用途及Guardant360 CDx；SERENA-6 PFS16.0对9.2个月，OS未成熟，属加速批准。'),
      source('T5', 'Circulating tumor DNA-guided adjuvant therapy in locally advanced colon cancer: DYNAMIC-III', 'Tie等 / Nature Medicine', '2025-10-20', 'https://pubmed.ncbi.nlm.nih.gov/41115959/', 'MRD预后价值不等于任意强化或降阶治疗均改善结局，需按试验策略解读。'),
      source('T6', 'FDA approves trastuzumab deruxtecan for HR-positive, HER2-low or HER2-ultralow breast cancer', '美国FDA', '2025-01-27', 'https://www.fda.gov/drugs/cancer-approvals/fda-approves-fam-trastuzumab-deruxtecan-nxki-unresectable-or-metastatic-hr-positive-her2-low-or-her2', 'HER2低/超低表达按特定IHC用途评价，不等同于HER2突变检测。'),
    ],
    conclusions: [
      conclusion('判断层：成熟度应按用途评价；分析有效性、临床有效性和临床效用必须分开，更多基因不等于更多获益。', 'inference', 'T1', 'T2'),
      conclusion('事实层：部分血浆选药用途已成熟；判断层：阴性或无信息结果应有组织反射路径。', 'single_source', 'T2'),
      conclusion('事实层：2026年Signatera CDx获FDA特定MIBC术后用途批准；不确定性：不得外推中国批准、其他癌种或任意停换药策略。', 'single_source', 'T3'),
      conclusion('事实层：camizestrant特定ESR1动态监测用途取得FDA加速批准；判断层：值得跟踪，但OS及确证证据仍需跟进。', 'single_source', 'T4'),
      conclusion('判断层：MRD需要癌种和干预特异的证据，预后分层不能替代治疗效用；不同试验不能概念化合并。', 'multiple_sources', 'T3', 'T5'),
      conclusion('事实层：HER2低/超低表达存在IHC相关治疗用途；判断层：ADC机会不能全部映射为NGS靶点。', 'single_source', 'T6'),
    ],
    limitations: '本轮未开展实验室性能验证。中国具体DNA/RNA产品、MRD及动态监测用途的现行证照须逐项核验；美国批准不能替代中国批准。未来三年方向属于推演，不是获批预测。',
    openQuestions: '候选产品在中国真实FFPE样本下的失败率、RNA质量和报告率是什么？血浆CHIP、胚系与低脱落如何处理？新增阳性是否改变入药人群并需要桥接？能否取得连续采样和疗效随访？',
    report: `# 技术成熟度与未来突破方向

## 事实：按用途而非平台评价
ESMO 2024建议在多种晚期肿瘤开展NGS，并在泛瘤种检测中考虑匹配治疗可及性。热点PCR、组织DNA NGS、IHC/ISH和部分血浆CDx各有适用范围，不能笼统判定某一路线全面胜出。[T1](https://pubmed.ncbi.nlm.nih.gov/38834388/)

| 技术路线 | 已有价值 | 关键边界 |
|---|---|---|
| 热点PCR | 指定变异的快速、明确检测 | 覆盖范围与说明书限制 |
| 组织DNA NGS | 多靶点选药、复杂变异覆盖 | 样本量、变异类型验证、可行动性 |
| DNA/RNA联检 | 融合与剪接等场景的补充 | RNA质量、失败率和新增结果的临床意义 |
| IHC/ISH | 蛋白表达、扩增相关治疗选择 | 染色系统、阈值与判读一致性 |
| 血浆ctDNA | 补充取材、部分选药和监测 | 低脱落、CHIP及阴性解释 |
| 术后MRD | 风险分层及部分特定干预 | 癌种、采样时点与治疗动作特异 |

血浆未检出不能一概排除相关变异；无信息结果后应考虑组织反射检测。[T2](https://pubmed.ncbi.nlm.nih.gov/35809752/)

## 事实：监测进入治疗决策，但有明确边界
2026年5月FDA批准Signatera CDx用于特定MIBC术后MRD阳性人群选择阿替利珠单抗。IMvigor011随机250例，DFS中位数9.9对4.8个月，HR0.64；OS32.8对21.1个月，HR0.59。持续阴性者并未接受同样的随机比较，不能据此证明所有阴性患者停止其他治疗安全。[T3](https://www.fda.gov/drugs/cancer-approvals/fda-approves-atezolizumab-adjuvant-treatment-muscle-invasive-bladder-cancer-patients-molecular)

2026年9月FDA加速批准camizestrant联合CDK4/6抑制剂，用于治疗期间检出ESR1突变的特定乳腺癌人群，并批准相应Guardant360 CDx用途。SERENA-6的PFS为16.0对9.2个月，OS未成熟。不能扩展为任意耐药位点提前换药有效。[T4](https://www.fda.gov/drugs/cancer-approvals/fda-grants-accelerated-approval-camizestrant-cdk46-inhibitor-esr1-mutated-hr-positive-her2-negative)

## 判断与取舍
更低检测限意味着可能识别更多低丰度阳性，但新识别人群是否获益需要证据。MRD随机试验结果也必须按干预方案分别解读，DYNAMIC-III不支持将所有强化或降阶策略概括为成功。[T5](https://pubmed.ncbi.nlm.nih.gov/41115959/)

HER2低/超低表达用途采用特定IHC判定，不能用HER2突变替代。数字病理若仅提高读片一致性，仍不能直接宣称证明了治疗预测效用。[T6](https://www.fda.gov/drugs/cancer-approvals/fda-approves-fam-trastuzumab-deruxtecan-nxki-unresectable-or-metastatic-hr-positive-her2-low-or-her2)

## 未来三年推演（2026—2029）
DNA/RNA低输入联检、限定癌种MRD干预、动态耐药监测和定量病理值得跟踪。失败条件分别包括质量与时效抵消增益、只有预后相关性、提前换药不改善结局，以及跨中心评分漂移。此处是方向判断，不是上市时间承诺。

## 不确定性与BD条件
具体中国注册状态、真实样本性能、桥接样本权益及软件版本锁定能力尚需验证。药企合作应先确定癌种、药物、样本、阈值、临床动作和桥接方案，再讨论panel容量与检测频次。`,
  },
  {
    kind: 'competitors' as const, title: '国内外竞品格局与策略差异', assignedTo: 'competitor_researcher',
    sources: [
      source('C1', 'List of FDA-Authorized Companion Diagnostic Devices', '美国FDA', '未知', 'https://www.fda.gov/medical-devices/in-vitro-diagnostics/list-fda-authorized-companion-diagnostic-devices-in-vitro-and-imaging-tools', '动态清单，访问2026-11-12。逐项核对企业、检测、药物、癌种、样本与标志物；包括Foundation、Guardant、Thermo、Illumina、Agilent等。'),
      source('C2', '厦门艾德生物医药科技股份有限公司2025年年度报告', '艾德生物 / 巨潮资讯', '2026-04-16', 'https://static.cninfo.com.cn/finalpage/2026-04-16/1225106088.PDF', '试剂、检测服务及药物临床研究等业务构成；公司收入不能等同于纯CDx份额。'),
      source('C3', 'Burning Rock Reports Second Quarter 2026 Financial Results', 'Burning Rock Biotech', '2026-09-10', 'https://ir.brbiotech.com/news-releases/news-release-details/burning-rock-reports-second-quarter-2026-financial-results', '院内、中央实验室和药企研发服务并行；优先/创新审评进展不等于已批准。与宏观任务引用同一来源，不作独立交叉确认。'),
      source('C4', 'K250003 GENESEEQPRIME NGS Tumor Profiling Assay (FFPE)', '美国FDA', '2025-08-29', 'https://www.accessdata.fda.gov/cdrh_docs/pdf25/K250003.pdf', 'Class II 510(k)肿瘤谱分析用途；标签不支持将其等同于特定药物处方性CDx。'),
    ],
    conclusions: [
      conclusion('事实层：全球CDx获批用途覆盖NGS及IHC等多种方法；判断层：不能仅在NGS企业之间比较竞争。', 'single_source', 'C1'),
      conclusion('判断层：竞品比较应采用产品、癌种、样本、药物标签及司法辖区的组合，海外合作不能替代中国注册。', 'inference', 'C1', 'C4'),
      conclusion('事实层：艾德与燃石采用不同业务组合；判断层：需分渠道比较注册与交付能力，不能用总营收推CDx份额。', 'multiple_sources', 'C2', 'C3'),
      conclusion('事实层：GENESEEQPRIME的K250003是肿瘤谱分析510(k)许可；不应将其描述为已取得特定药物CDx标签。', 'single_source', 'C4'),
    ],
    limitations: '没有获得竞品未公开合同、真实净价、排他条款或完整客户覆盖；未完成所有国内企业的逐证照清单。官网宣传、审评受理与现行批准必须分开。该矩阵不是市场份额排名。',
    openQuestions: '哪些药企已签独家CDx？排他覆盖哪些地域、癌种、靶点和期限？既有合作能否并行或更换？具体产品证照、装机兼容性、医院采用和净价如何？',
    report: `# 国内外竞品格局与策略差异

## 事实：竞争单位必须可比较
FDA清单以检测产品、癌种、样本、药物和标志物列示用途；这是比公司名或基因数量更可靠的比较起点。清单为动态页面，本轮访问日期为2026-11-12。[C1](https://www.fda.gov/medical-devices/in-vitro-diagnostics/list-fda-authorized-companion-diagnostic-devices-in-vitro-and-imaging-tools)

| 类型 | 代表 | 已有布局 | 对进入者的判断 |
|---|---|---|---|
| 多用途检测体系 | Foundation Medicine、Guardant | 组织/血浆产品及多个药物相关用途 | 需寻找未覆盖用途、本地交付或权利空间 |
| 平台及配套试剂 | Thermo Fisher、Illumina | 平台供给并拥有自身CDx产品 | 上游伙伴也可能下游竞争，提前界定合同 |
| 病理及单靶点 | Roche/Ventana、Agilent、QIAGEN | 蛋白表达、扩增、指定突变相关用途 | NGS不能替代全部需求 |
| 国内多平台试剂 | 艾德 | 试剂、服务与药物临床研究 | 对比具体注册、医院落地及药企合作 |
| 国内混合渠道 | 燃石 | 院内、中央实验室、药企研发 | 各渠道需求与现金流分别评价 |

艾德资料来自2025审计年报；燃石资料来自2026Q2公司披露。二者业务口径不同，不能按总营收直接排纯CDx份额。[C2](https://static.cninfo.com.cn/finalpage/2026-04-16/1225106088.PDF) [C3](https://ir.brbiotech.com/news-releases/news-release-details/burning-rock-reports-second-quarter-2026-financial-results)

## 事实：许可标签不能混淆
GENESEEQPRIME的K250003为Class II、510(k)肿瘤谱分析许可，其标签不支持作为特定药物处方性的结论判断。肿瘤谱分析许可不能自动宣传成特定药物CDx批准。[C4](https://www.accessdata.fda.gov/cdrh_docs/pdf25/K250003.pdf)

## 判断：竞争护城河的四个层面
需要同时评价适用用途证据、注册范围、临床交付网络及商业合作权利。大panel、低价和国际合作新闻，分别只能覆盖其中一部分。平台选择还涉及仪器兼容、试剂供应、数据格式和未来版本升级控制。

## BD谈判清单
明确地域、癌种、药物与靶点的排他边界；明确原始样本、剩余样本、数据及疗效连接的使用权；明确CTA到最终CDx的桥接责任、标签扩展权、项目取消补偿、里程碑和回款条件。不能只签一个检测单价。

## 不确定性
当前没有可靠同口径净价、客户覆盖与未公开排他合同。未核到注册原件的国内产品不列为已核实获批；受理、优先审评与公司上市预测均不等于批准。`,
  },
  {
    kind: 'clinical_need' as const, title: '临床真实需求与未满足痛点', assignedTo: 'clinical_researcher',
    sources: [
      source('L1', 'Genomic testing and targeted therapy of NSCLC in China: a nationwide survey', 'Wang等 / Annals of Palliative Medicine', '2024-03-14', 'https://apm.amegroups.org/article/view/122522/html', '2020年5—9月采集，135城市、150病理医师及450临床医师；EGFR能力认知差异是受访者自报，不是患者检测率或2026年现状。'),
      source('L2', 'Clinical Utility of Comprehensive Cell-free DNA Analysis in Newly Diagnosed Metastatic NSCLC (NILE)', 'Leighl等 / Clinical Cancer Research', '2019-04-15', 'https://pubmed.ncbi.nlm.nih.gov/30988079/', '282例；血浆中位TAT9天对常规组织15天，组织60例、联合89例识别指南相关标志物；不是统一最佳组织NGS等条件比较，不是2026年SLA。'),
      source('L3', 'ESMO recommendations on the use of circulating tumour DNA assays', 'ESMO / Annals of Oncology', '2022-07-06', 'https://pubmed.ncbi.nlm.nih.gov/35809752/', '无信息ctDNA结果后考虑组织反射检测；与技术任务是同一原文，不视为第二个独立证据。'),
      source('L4', 'Integrated histological and molecular analyses of rebiopsy samples at osimertinib progression', 'Cheng等 / 广东肺癌研究所', '2020-10-20', 'https://pubmed.ncbi.nlm.nih.gov/33126092/', '2017—2019年89例后线奥希替尼患者的单中心回顾研究，复检与匹配治疗的关联受选择等混杂影响，不能证明因果。'),
      source('L5', 'Trastuzumab Deruxtecan in Previously Treated HER2-Low Advanced Breast Cancer', 'Modi等 / NEJM', '2022-06-05', 'https://www.nejm.org/doi/abs/10.1056/NEJMoa2203690', 'DESTINY-Breast04按IHC1+或IHC2+/ISH阴性界定HER2低表达，不能与HER2突变混同。'),
      source('L6', 'Biomarker analyses in the phase III ASCENT study', 'Bardia等 / Annals of Oncology', '2021-06-08', 'https://pubmed.ncbi.nlm.nih.gov/34116144/', 'ASCENT不要求已知TROP2表达才可入组；不能把所有ADC视为必需同一靶点检测。'),
    ],
    conclusions: [
      conclusion('事实层：中国历史调查显示科室认知有差异；判断层：送检协作值得核查；不确定性：不能推出2026年全国漏检率。', 'single_source', 'L1'),
      conclusion('事实层：NILE显示血浆与组织互补及当时流程时效差异；判断层：临床价值应评价有效结果与治疗决策，而非panel大小。', 'single_source', 'L2'),
      conclusion('判断层：液体无信息结果必须有解释与回组织安排，但再活检可行性受患者状态、病灶和意愿影响。', 'inference', 'L3'),
      conclusion('事实层：历史耐药复检研究提示分子与组织学共同评估的重要性；不确定性：观察性关联不能宣称复检直接改善生存。', 'single_source', 'L4'),
      conclusion('判断层：ADC检测需求按药物、癌种及样本定义，不应将蛋白表达、扩增、突变混用。', 'multiple_sources', 'L5', 'L6'),
    ],
    limitations: '未开展医生、患者或采购人员访谈。主要中国实证来自肺癌且有历史时段限制，不能外推全部肿瘤或2026全国现状。海外TAT和增量检出不能替代本地流程数据，检出也不等于用药或获益。',
    openQuestions: '谁负责应检患者开单和漏检追踪？样本不足来自取材、分配还是耗竭？多少患者报告前已治疗？无信息血浆和耐药患者为何未复检？可行动结果未转为匹配用药的原因是什么？',
    report: `# 临床真实需求与未满足痛点

## 事实及时间边界
中国覆盖135城市的问卷包含150名病理医师及450名临床医师，数据采集于2020年5—9月、2024年发表。病理医师自报EGFR能力95.3%，临床医师认为本院具备该能力81.9%。这是能力认知差异，不是患者检测率，也不是2026年的全国现状。[L1](https://apm.amegroups.org/article/view/122522/html)

NILE纳入282例初诊转移性NSCLC，血浆TAT中位9天，常规组织15天；组织单独识别60例指南相关标志物，联合血浆识别89例。该比较针对当时常规组织流程，不能推为血浆对统一优化组织NGS的固有优势，也不能把新增检出当作已改善生存。[L2](https://pubmed.ncbi.nlm.nih.gov/30988079/)

## 判断：按患者路径找缺口
| 环节 | 要验证的痛点 | 统一分母与指标 |
|---|---|---|
| 开单 | 应检但未检测 | 已检测人数/明确应检人数 |
| 取材与病理 | 原始材料不足或分配冲突 | 首次合格率、重复取材原因 |
| 送检及报告 | 报告晚于治疗决策 | 开单至报告、首治时间、P50/P90 |
| 液体无信息 | 错误解读为排除靶点 | 回组织比例、完成时间及未完成原因 |
| 耐药进展 | 未复检或缺组织学 | 复检覆盖、有效报告和治疗去向 |
| 匹配治疗 | 有结果但无法用药 | 药物可及性、支付、体能状态及意愿 |

血浆无信息结果后应考虑组织反射检测，但实际可行性取决于病灶、身体状态与患者意愿。[L3](https://pubmed.ncbi.nlm.nih.gov/35809752/)

历史89例后线奥希替尼单中心研究支持关注进展后的组织学与分子分析，但回顾性关联受患者选择等混杂影响，不能表述为复检本身导致生存获益。[L4](https://pubmed.ncbi.nlm.nih.gov/33126092/)

## 事实：ADC需求并非统一检测需求
DESTINY-Breast04采用HER2 IHC1+或IHC2+/ISH阴性定义入组；ASCENT不要求已知TROP2表达才可入组。不同药物的检测要求必须按其研究和现行标签核验。[L5](https://www.nejm.org/doi/abs/10.1056/NEJMoa2203690) [L6](https://pubmed.ncbi.nlm.nih.gov/34116144/)

## 对BD的判断
院内试点应连续记录“应检—实检—有效报告—可行动结果—实际匹配治疗”，固定分母、证据等级和观察窗口。可行动变异须说明是已批准药物、指南推荐、试验机会还是研究线索，不能把这些结果混为一类。

## 不确定性
没有实际访谈，不能声称掌握某医院当前痛点强度。首次样本不足不能自动归因于多次切片耗竭。跨癌种、跨治疗线次和历史研究迁移都需要本地证据。`,
  },
];

export function cdxSynthesis(ids: Record<string, number>) {
  const ref = (kind: string, id: string) => `[task#${ids[kind]}/${id}]`;
  return {
    status: 'draft',
    executiveSummary: `# 肿瘤伴随诊断市场进入｜首份深度调研报告

**版本：v1.0 · 数据截止：${cdxAsOf} · 中国为主，海外对照 · 待负责人审核。**

## 一、四维度关键发现对照
| 维度 | 事实 | 判断 | 不确定性 |
|---|---|---|---|
| 政策与支付 | 国家病理与检验价格立项已推进 | 逐省逐院核验支付和结算 | 不能把收费项目当作医保支付 ${ref('macro', 'M1')} ${ref('macro', 'M2')} |
| 技术路线 | 多种路线有成熟用途，部分MRD和动态监测已有美国批准 | 按临床动作选择技术 | 不等于中国获批或全癌种效用 ${ref('product_tech', 'T1')} ${ref('product_tech', 'T3')} |
| 竞争格局 | 企业拥有不同产品标签、渠道和合作组合 | 比较具体用途及权利 | 无同口径净价和纯CDx份额 ${ref('competitors', 'C1')} ${ref('competitors', 'C2')} |
| 临床需求 | 历史研究支持样本、时效及流程缺口 | 验证实际匹配治疗 | 无2026年全国漏检率及本轮真实访谈 ${ref('clinical_need', 'L1')} ${ref('clinical_need', 'L2')} |

## 二、交叉验证后的一致结论
1. **有条件进入。**先确定癌种、线次、药物、标志物、样本、检测系统、临床动作与付款方，再扩大投入。依据是用途特异的注册标签与临床可行动性要求，不是行业规模推算。${ref('competitors', 'C1')} ${ref('product_tech', 'T1')}
2. **覆盖、检出、匹配用药和获益分别计量。**更大panel或更低检测限并不能单独证明价值；应看结果能否按时改变临床决策。${ref('clinical_need', 'L2')} ${ref('product_tech', 'T1')}
3. **组织与血浆互补。**无信息血浆结果需有回组织路径；技术与临床代理引用同一ESMO原文，此处不将两次引用计为独立证据。${ref('product_tech', 'T2')} ${ref('clinical_need', 'L3')}
4. **监测方向分用途投入。**MIBC术后MRD已存在特定美国批准，但不同癌种及干预方案证据不一，不能泛化。${ref('product_tech', 'T3')} ${ref('product_tech', 'T5')}

## 三、证据方法与边界
四个专题来自本次独立子代理研究和总控核验；不是平台自动调用代理。正文区分原文事实、分析判断与未验证事项。来源保留原文、机构、日期和支持范围；AI核读不等于负责人已完成审核。没有医生访谈、患者研究或实地采购核验。不提供未经验证的市场规模、统一净价或ROI。`,
    marketOpportunity: `## 市场规模、机会与增长逻辑
国家价格规范为服务落地提供制度条件，但仍需核查目标省份及医院的准入、收费和支付限制。不得把整体IVD规模作为CDx市场。${ref('macro', 'M1')} ${ref('macro', 'M2')} ${ref('macro', 'M3')}

**测算建议（分析框架，尚未填数）：**
- 医院渠道：应检独立患者 × 实际采用率 × 人均检测次数 × 实收净收入；区分初诊、进展、监测，避免重复计算患者。
- 药企渠道：按已签项目、验证/桥接/注册里程碑和检测交付估算；与临床渠道避免重复归属。
- 成本：加入失败重测、取送样、解释、质控、设备、销售、应收及坏账，不只算测序试剂。

燃石不同渠道收入变动方向不同，提示订单及采用机制需要分别建模；这是经营案例，不是行业资本周期结论。${ref('macro', 'M4')}

**待验证假设：**有明确治疗可及性和支付路径的细分用途可能更早形成收入；未拿到实际结算数据前不计入确定收入。`,
    targetUsers: `## 目标用户与核心需求
临床使用者为肿瘤科、病理科、检验科及患者；付款和采购决策者可能是医院、患者或药企，必须分别识别。核心需求是治疗前取得足量、可解释且能行动的结果。历史中国调查提示协作差异，但不能当作当前全国缺口。${ref('clinical_need', 'L1')}

| 决策场景 | 合作入口 | 试点观察指标 |
|---|---|---|
| 初诊选药 | 肿瘤科与病理/检验科 | 应检覆盖、有效报告、报告前已首治比例 |
| 进展复检 | 负责耐药评估的临床团队 | 复检覆盖、组织学评估、结果后的用药去向 |
| 取材受限 | 临床与取材团队 | 血浆补充价值、阴性回组织率及原因 |
| ADC相关评估 | 病理科与药企 | 指定药物评分、样本时点及复核一致性 |

时效研究支持测量全流程，而不是只承诺实验室出报告天数；海外2019年TAT不作为本地2026年SLA。${ref('clinical_need', 'L2')} ${ref('clinical_need', 'L3')}

**待验证：**连续患者的治疗转化、药物可及性、支付障碍及未完成复检原因。本轮没有完成真实访谈。`,
    feasibility: `## 产品和技术可行性
成熟技术不等于任意用途均成立。热点PCR、DNA NGS、DNA/RNA、IHC/ISH和ctDNA应按目标用途选择；分析有效性、临床有效性与临床效用分开论证。${ref('product_tech', 'T1')} ${ref('product_tech', 'T2')}

| 候选方向 | 可验证价值 | 继续投入条件 | 暂停条件 |
|---|---|---|---|
| 已知选药用途 | 稳定获得可行动结果 | 注册与现有平台兼容、时效及成本合格 | 无合法交付或支付路径 |
| DNA/RNA补充 | 融合/剪接等增量 | 真实样本中增量改变决策 | 失败率、费用或延迟抵消价值 |
| MRD指导干预 | 用于具体治疗动作 | 癌种及干预特异临床证据 | 仅证明复发相关性 |
| 动态耐药 | 特定治疗调整窗口 | 锁定系统、采样与前瞻性证据 | 任意位点提前换药的泛化宣传 |
| 病理定量 | 改善指定用途判读 | 跨中心评分与治疗用途验证 | 仅相关性、无用途效用 |

Signatera MIBC批准与camizestrant加速批准提供方向性证据，均不等于中国同用途批准；后者OS尚未成熟。${ref('product_tech', 'T3')} ${ref('product_tech', 'T4')}

**判断：**短期优先交付明确用途；中期投入低输入、多模态及限定监测场景。此处为资源配置判断，不承诺2029年前获批。`,
    competition: `## 竞争格局与策略差异
| 竞争层 | 代表 | 需核验的竞争要素 |
|---|---|---|
| 多用途检测 | Foundation、Guardant | 具体癌种/药物/样本标签与合作权利 |
| 平台体系 | Thermo、Illumina | 仪器兼容、供应、版本和下游竞争 |
| 病理/单靶点 | Roche/Ventana、Agilent、QIAGEN | 表达、扩增、突变用途及评分体系 |
| 国内注册与交付 | 艾德、燃石等 | 中国证照、院内流程、药企合作与渠道净价 |

布局依据FDA动态清单和企业披露；不能把全球标签、中国可销售状态和本地采用率合成一个排名。${ref('competitors', 'C1')} ${ref('competitors', 'C2')} ${ref('competitors', 'C3')}

GENESEEQPRIME的K250003为肿瘤谱分析510(k)许可，不能当作特定药物CDx标签。${ref('competitors', 'C4')}

**判断：**寻找“明确用途＋临床交付＋可取得合作权利”的组合空间。合同尽调需覆盖地域/癌种排他、桥接与标签扩展、样本数据权利、里程碑、最低量及取消条款。尚未获得竞品未公开合同，不能断言空白市场或排他已经解除。`,
    risks: `## 四、维度冲突、风险与待澄清问题
| 冲突 | 判断与取舍 | 验证资料 |
|---|---|---|
| 政策支持 vs 地方预算 | 立项不作为销量保证 | 地方文件、实际结算及采购合同 |
| 广谱覆盖 vs 样本/时间/费用 | 按临床场景比较PCR与NGS | 同路径有效率、TAT、成本和治疗去向 |
| 血浆便利 vs 无信息结果 | 保留解释与回组织 | 再活检可行性和未完成原因 |
| ADC增长 vs 检测方式差异 | 表达、扩增与突变分开 | 指定药物标签和判读体系 |
| 共研锁定 vs 单药失败 | 分里程碑、限制排他损失 | 合同和管线风险 |
| 海外批准 vs 中国准入 | 海外证据用于方向选择 | 中国药械许可及桥接需求 |

支付冲突依据国家立项与目录制定边界；技术冲突依据NGS建议和ctDNA局限；ADC用途依据IHC相关研究与标签。${ref('macro', 'M1')} ${ref('macro', 'M3')} ${ref('product_tech', 'T1')} ${ref('product_tech', 'T2')} ${ref('clinical_need', 'L5')}

**资本风险：**单家公司总毛利不代表新进入者的单位经济性，也不证明纯CDx盈利。药企项目取消、样本权益不足和应收账款均需测算。${ref('macro', 'M4')}

**证据局限：**历史肺癌、海外研究和公司自述不替代目标医院实证；同一原文被多个代理引用不增加独立证据数量。`,
    recommendation: `## 五、BD机会、风险与优先级建议
**总控判断：有条件进入，先验证两个具体用途，再批准扩张。**

| 优先级 | 路径 | 必要能力/进入条件 | 暂停门槛 |
|---|---|---|---|
| P1 | 药企共研、注册桥接 | 质量体系、样本管理、验证与项目交付；确认合作权利 | 既有独家无法突破、桥接责任不清 |
| P1 | 明确用途的医院落地 | 合法供给、稳定报告、院内协作、实际结算 | 无准入/支付、持续失败或赶不上治疗 |
| P2 | DNA/RNA补充与耐药复检 | 可证明相对现有路径的增量价值 | 新结果不改变决策或质量时效不合格 |
| P2 | ADC病理检测及判读支持 | 指定检测系统、阈值、跨中心一致性 | 混淆表达/突变或仅有相关性 |
| P3 | MRD及动态监测共研 | 明确干预、连续采样、随访与验证预算 | 只有预后关联、无治疗动作或付款方 |

以上是推演性的资源配置优先级，不是已确认订单。已有注册及质量体系者优先共研；已有医院渠道者优先流程与结算试点；仅有测序能力者优先作为限定用途合作方，不建议仅以低价、大panel或热点全国扩张。

### 建议90天验证安排（计划，不是已完成工作）
1. 第1—2周：筛选两个癌种/治疗用途，完成中国药械标签与合作权利核查。
2. 第3—6周：与有条件的医院和药企验证样本、临床决策时点、支付和净价，取得经授权的流程数据。
3. 第7—10周：形成连续患者流程或桥接可行性小规模验证；质量和统计方案先行审批。
4. 第11—12周：按注册可行、真实需求、交付质量、付款与合同权利逐项决策；关键项不成立则调整或暂停，不用综合分掩盖硬缺口。

### 合同优先条款
限定地域、癌种、药物、靶点和期限的排他；明确样本/数据权益、桥接和注册责任、标签扩展、取消补偿、里程碑与回款。没有这些权利不将潜在线索列作确定性收入。`,
    openQuestions: [
      '注册团队：取得两个候选用途的NMPA证照、现行说明书、药物标签和桥接需求；用于排除无法合法交付的用途。',
      '目标医院医保办/财务/采购：核验地方收费、医保限制、采购和脱敏结算；用于确认付款方、实收净价和账期。',
      '肿瘤科/病理科/检验科：连续记录应检、实检、样本失败、报告时间、可行动结果和实际治疗去向；用于验证痛点强度。',
      '药企临床开发/转化医学：核实既有CDx伙伴、地域及癌种排他、样本使用和桥接需求；用于判断可签约空间。',
      '竞品尽调：在同用途下比较证照、质量、时效、平台兼容及真实报价；不得用总营收推份额。',
      '财务/运营：加入重测、物流、质控、设备、解释、销售和坏账建立分渠道全成本模型；用于现金与扩张决策。',
      '研究中心/药企：设计癌种和治疗动作特异的前瞻性验证，锁定软件、阈值和观察窗口；用于MRD或动态监测的投入决策。',
    ],
  };
}
