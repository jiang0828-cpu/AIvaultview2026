import { worldReportSchema } from '../src/worldSchema.js';
import { macroEvidence, macroEvidenceSources } from './world-evidence-001.js';

export const worldReport = worldReportSchema.parse({
  version: 1, number: '001', title: '增长仍在，体感为何分化？', subtitle: '从全球重构到中国家庭：理解增长、就业与预期之间的距离', asOf: '2026-11-10',
  tags: ['宏观环境', '社会观察'],
  thesis: '前三季度实际GDP增长4.6%，居民实际收入增长4.4%、消费增长2.7%。数据支持产出、收入和消费不同步，不直接证明全国居民“体感变差”。规上工业利润改善与回款变慢并存；家庭预期、资产与照护负担仍是待检验机制。',
  evidenceReview: macroEvidence,
  boundary: '本期为截至2026年11月10日的资料快照。统计值、机构预测、政策目标和研究估计分开标注；传导机制与情景为编辑分析，不是因果识别结果。后续发布可能修订数据，页面不自动更新。',
  sources: [
    ...macroEvidenceSources,
    { id: 'NBS26', publisher: '国家统计局', title: '前三季度经济运行总体平稳 高质量发展取得新成效', published: '2026-10-19', period: '2026年前三季度及各季度', url: 'https://www.stats.gov.cn/sj/xwfbh/fbhwd/202610/t20261019_1965618.html', scope: '中国实际GDP前三季度同比4.6%；一、二、三季度同比分别5.0%、4.3%、4.5%。初步核算，非全年结果。' },
    { id: 'IMF26', publisher: '国际货币基金组织 IMF', title: 'World Economic Outlook: Resilience Under Strain, Urgent Choices', published: '2026-10-13', period: '2026年10月预测版本', url: 'https://www.imf.org/en/Publications/WEO/Issues/2026/10/13/world-economic-outlook-october-2026', scope: '全球2026/2027年增长预测3.1%/3.4%；预测所用信息截至10月1日，不能当作全年实绩。' },
    { id: 'WTO26', publisher: '世界贸易组织 WTO', title: 'AI boom and trade resilience to Middle East crisis lift outlook, but gains to be uneven', published: '2026-10-08', period: '2026年3月与10月预测版本', url: 'https://www.wto.org/english/news_e/news26_e/stat_08oct26_510_e.htm', scope: '2026年全球货物贸易量增速预测由1.9%上调至3.9%；服务贸易量由4.8%下调至3.3%。预测修订不是实际增量。' },
    { id: 'GOV26', publisher: '国务院 / 工业和信息化部转载', title: '2026年政府工作报告', published: '2026-03-13', period: '2026年度政策部署', url: 'https://www.miit.gov.cn/xwfb/szyw/art/2026/art_a0f73af7d13b44b080ae9b71903939af.html', scope: '扩大内需、稳就业稳企业稳市场稳预期、发展与安全等政策方向；政策目标不等于实施结果。' },
    { id: 'ILO25', publisher: '国际劳工组织 ILO', title: 'Generative AI and jobs: A 2025 update', published: '2025-05-20', period: '2025年职业任务暴露度研究', url: 'https://www.ilo.org/publications/generative-ai-and-jobs-2025-update', scope: '全球约四分之一劳动者所在职业具有一定生成式AI暴露度；暴露度不是裁员概率，也不等于整份职业被取代。' },
    { id: 'UN24', publisher: '联合国经社部 UN DESA', title: 'World Population Prospects 2024: Summary of Results', published: '2024-07-11', period: '2024版长期人口估计与预测', url: 'https://www.un.org/development/desa/pd/sites/www.un.org.development.desa.pd/files/undesa_pd_2024_wpp_2024_advance_unedited_0.pdf', scope: '全球人口年龄结构变化与不同地区的人口转型差异。用于长期背景，不作为2026年即时就业统计。' },
    { id: 'NASA12', publisher: 'NASA Earth Observatory / NOAA', title: 'Night Lights 2012 – The Black Marble', published: '2012-12-06', period: '2012年夜间灯光合成影像', url: 'https://science.nasa.gov/earth/earth-observatory/night-lights-2012-the-black-marble-79803/', scope: '视觉背景：Robert Simmon，Suomi NPP VIIRS，NOAA Chris Elvidge数据。夜光合成图不是2026年经济热度图，不用于定量推断。' },
  ],
  metrics: [
    { label: '中国实际GDP同比', value: 4.6, unit: '%', period: '2026年前三季度', kind: 'observed', note: '初步核算 · 不变价格', sourceIds: ['NBS26'] },
    { label: '居民收入实际增速', value: 4.4, unit: '%', period: '2026年前三季度', kind: 'observed', note: '住户调查 · 不等于GDP分配率', sourceIds: ['HH26'] },
    { label: '居民消费实际增速', value: 2.7, unit: '%', period: '2026年前三季度', kind: 'observed', note: '增速低于收入 · 消费仍增长', sourceIds: ['HH26'] },
    { label: '应收账款平均回收期', value: 71.6, unit: '天', period: '规上工业 · 2026年9月末', kind: 'observed', note: '同比增加1.3天 · 非全部企业', sourceIds: ['PROFIT26'] },
  ],
  charts: [
    { id: 'household', title: '家庭收支同时增长，节奏不同', subtitle: '2026年前三季度 · 全国居民人均收支实际同比', unit: '%', max: 6, sourceIds: ['HH26'], note: '同表同期间；4.4−2.7=1.7个百分点，不是储蓄率，也不能直接归因于信心。', rows: [{ label: '实际收入', value: 4.4, kind: 'observed' }, { label: '实际消费', value: 2.7, kind: 'observed' }, { label: '城镇实际收入', value: 3.6, kind: 'observed' }, { label: '农村实际收入', value: 5.6, kind: 'observed' }] },
    { id: 'china', title: '总量仍在增长，季度节奏并非直线', subtitle: '2026年中国各季度实际GDP同比增速', unit: '%', max: 6, sourceIds: ['NBS26'], note: '均为单季同比、不变价格；不是环比，也不构成全年预测。横轴统一从0开始。', rows: [{ label: '一季度', value: 5.0, kind: 'observed' }, { label: '二季度', value: 4.3, kind: 'observed' }, { label: '三季度', value: 4.5, kind: 'observed' }] },
    { id: 'trade', title: '同一轮冲击，两种贸易方向', subtitle: 'WTO对2026年贸易量增速的预测修订', unit: '%', max: 6, sourceIds: ['WTO26'], note: '比较3月版与10月版预测；货物与服务分别观察，不能相加。边框条为预测。', rows: [{ label: '货物 · 3月版', value: 1.9, kind: 'forecast' }, { label: '货物 · 10月版', value: 3.9, kind: 'forecast' }, { label: '服务 · 3月版', value: 4.8, kind: 'forecast' }, { label: '服务 · 10月版', value: 3.3, kind: 'forecast' }] },
  ],
  lenses: [
    { id: 'politics', name: '政治与政策', question: '政策承诺，怎样变成可感知的结果？', summary: '方向、执行能力与分配方式，决定政策能否穿透到家庭。', fact: '2026年政府工作报告强调扩大内需，并提出稳就业、稳企业、稳市场、稳预期。[GOV26]', mechanism: '政策先改变约束和激励，再经预算、项目和企业决策影响居民。若支持只停留在融资供给，而订单、回款和劳动收入没有改善，信心的恢复就可能慢于政策发布。', counter: '政策传导有时滞，不应在宣布后立即判定成败；同样，也不能把目标、资金安排和最终效果当成同一件事。', watch: '关注执行细则、资金到位、企业回款与就业结果能否形成连续证据。', sourceIds: ['GOV26'], documentTitle: '01 政治与政策｜从承诺到结果' },
    { id: 'international', name: '国际局势', question: '风险上升，为什么贸易仍能增长？', summary: '全球联系会绕路、换供应商，也可能把成本转嫁给更弱的主体。', fact: 'WTO在10月版展望中上调货物贸易量预测，同时下调服务贸易量预测，体现冲击影响的不均衡。[WTO26]', mechanism: '外部冲击通过能源、运输、保险和合规成本传导，而企业会重排供应链。订单没有消失，不代表成本不变；总贸易保持增长，也不代表每个地区和每家企业都受益。', counter: '不能由地缘紧张直接推出全面脱钩，也不能由贸易韧性反推所有冲突无关紧要；替代供应可能缓冲数量冲击，却增加时间与成本。', watch: '将订单数量、交付时间、运费与毛利拆开观察，核对替代路线的真实成本。', sourceIds: ['WTO26', 'IMF26'], documentTitle: '02 国际局势｜绕路的全球化' },
    { id: 'economy', name: '全球经济', question: '增长预测为什么不能回答每个人的处境？', summary: '全球平均数掩盖了行业集中、融资条件与地区差异。', fact: 'IMF的2026年10月预测为：全球2026年增长3.1%，2027年增长3.4%。两者均为预测而非完成值。[IMF26]', mechanism: '新增投资如果集中在少数技术与基础设施环节，会先改善这些供应链的需求。它能否扩散，取决于下游采用、收入分配与配套能力；融资成本则影响其他部门能否跟进。', counter: '投资集中既可能提高脆弱性，也可能带来规模效应和后续生产率收益，不能仅凭集中度判断繁荣必然结束。', watch: '观察资本开支之外的订单、利用率和现金流；区分价格推动的名义增长与实际数量增长。', sourceIds: ['IMF26'], documentTitle: '03 全球经济｜增长的集中与扩散' },
    { id: 'domestic', name: '国内形势', question: 'GDP增长，与企业利润之间隔着什么？', summary: '行业位置、定价权与资产负债表，比单个总量数字更接近日常感受。', fact: '国家统计局初步核算：2026年前三季度中国实际GDP同比增长4.6%。[NBS26]', mechanism: '增加值增长衡量生产活动，不等于每家企业的利润增长。若企业降价换量、账期延长，生产扩大仍可能伴随现金紧张；若家庭重视债务和未来支出，当期收入改善也未必立即转为消费。', counter: '体感分化不能直接归结为统计失真，也不意味着所有部门都在承压；需要行业、地区、年龄和资产负债状况的分组材料。', watch: '把实际产出、销售价格、利润、回款与劳动收入排成一张检查表，避免用单一指标替代全部。', sourceIds: ['NBS26'], documentTitle: '04 国内形势｜总量与资产负债表' },
    { id: 'society', name: '社会要素', question: '为什么相似的收入，会带来不同的安全感？', summary: '照护责任、公共服务可达性与收入稳定性，改变家庭对未来的判断。', fact: '联合国2024版人口展望呈现不同地区人口年龄结构和转型阶段的差异，是长期背景资料。[UN24]', mechanism: '家庭消费不仅取决于收入水平，还取决于收入波动和不可推迟的支出。育儿、医疗和照护安排若缺少稳定支持，家庭可能增加预防性储蓄；公共服务也通过释放时间影响劳动参与。', counter: '年龄结构不直接决定单年消费，家庭类型和地区制度同样重要；不能将宏观老龄化趋势变成对个体能力或价值的判断。', watch: '关注不同家庭的可支配时间、照护费用、就业持续性，以及公共服务的实际使用门槛。', sourceIds: ['UN24', 'GOV26'], documentTitle: '05 社会要素｜家庭的时间与风险' },
    { id: 'technology', name: '技术与劳动', question: 'AI带来效率，谁先获得收益？', summary: '任务被重写后，收益取决于岗位设计、议价关系和技能转移成本。', fact: 'ILO 2025研究估计，全球约四分之一劳动者所在职业具有一定GenAI暴露度；这不是四分之一岗位将消失。[ILO25]', mechanism: '技术首先改变可自动化任务的成本，企业随后决定扩产、提质还是减少工时。若岗位升级伴随培训和新需求，效率可转为收入；若需求不增、议价弱，收益分配则可能倾向资本或少数专业岗位。', counter: '职业暴露度是任务结构估计，不是中国即时裁员统计；生产率提升和就业调整可能同时发生，方向需看具体行业。', watch: '用交付质量、返工时间、岗位变化和薪资结构评估采用效果，避免只数工具使用量。', sourceIds: ['ILO25'], documentTitle: '06 技术与劳动｜效率之后的分配' },
  ],
  channels: [
    { id: 'external', title: '外部冲击如何进入日常生活', stages: [{ label: '规则与冲突', detail: '贸易限制、航线中断或合规变化' }, { label: '企业成本', detail: '运输、能源、库存与交付时间' }, { label: '订单与现金', detail: '转单、定价和资金周转的调整' }, { label: '家庭预算', detail: '工时、工资、物价与支出安排' }], feedback: '企业可换供应商、路线或产品，缓冲冲击；缓冲成本也可能留在利润或库存中。', caveat: '机制示意，不代表本期已测出每一条边的因果强度。', sourceIds: ['WTO26', 'IMF26'] },
    { id: 'policy', title: '政策如何抵达预期', stages: [{ label: '政策取向', detail: '预算、规则和公共服务安排' }, { label: '执行到位', detail: '资金拨付、申请门槛和地方协同' }, { label: '经营与就业', detail: '回款、订单、招聘和工作稳定性' }, { label: '信心与消费', detail: '未来收入和支出风险的重新判断' }], feedback: '消费改善能反过来支持企业订单；若主要形成短期替代，持续性需另行验证。', caveat: '政策出台与效果之间有时滞；每一步都需要独立证据。', sourceIds: ['GOV26'] },
    { id: 'ai', title: '技术效率如何变成生活收益', stages: [{ label: '任务效率', detail: '检索、写作、编码等成本变化' }, { label: '组织选择', detail: '扩产、提质、缩短工时或调整岗位' }, { label: '分配机制', detail: '薪酬、培训、议价与社会保障' }, { label: '实际获得', detail: '收入、闲暇、工作质量与机会' }], feedback: '更低成本可能催生新需求；若缺少适配和培训，转换成本由劳动者先承担。', caveat: '任务暴露度不等于采用率、生产率增幅或裁员率。', sourceIds: ['ILO25'] },
  ],
  scenarios: [
    { id: 'base', name: '基准｜分化延续', premise: '工作假设：外部冲击可部分缓冲，国内传导逐步推进，行业差异仍然显著。不是机构基准预测。', conditions: ['订单与成本并存，企业通过产品与供应链调整消化压力', '政策执行逐步抵达经营端，但家庭预期恢复慢于短期指标'], business: '分客户和产品追踪回款、毛利与复购，避免把行业平均值直接套到自身。', household: '把稳定收入和必要支出分别列示，职业学习优先围绕现有任务，不因单个宏观数字做剧烈调整。', invalidation: '若多个需求、就业与收入指标持续同步改善，或外部冲击明显恶化，需要切换框架。' },
    { id: 'up', name: '改善｜增长向收入扩散', premise: '条件推演：成本缓和与国内需求改善叠加，新增活动更广泛转成稳定岗位。', conditions: ['订单改善伴随回款缩短和利润改善，而非只靠降价', '招聘、工时与居民收入共同改善，变化超出少数高景气行业'], business: '先用小规模订单和可撤回投入验证需求持续性，再安排长期产能与招聘。', household: '若收入稳定性和公共服务可达性共同改善，家庭可重新评估延后的正常支出。', invalidation: '若只有生产端上涨、回款与劳动收入未跟随，不足以判定进入这一情景。' },
    { id: 'down', name: '承压｜成本与预期共振', premise: '条件推演：外部成本反复，企业难以转嫁，家庭预防性行为加深。', conditions: ['交付周期拉长、成本上升与订单质量恶化同时出现', '回款和招聘持续走弱，家庭对不可推迟支出的担忧上升'], business: '先核对账期、库存和客户集中度，预留替代供应方案；不要把营收规模当作现金安全。', household: '优先保障必要支出和工作转换能力，核对保障安排，避免将短期焦虑直接变成高成本决策。', invalidation: '若成本和现金流压力迅速缓和，且需求有持续恢复，承压假设应降权。' },
  ],
  watchlist: [
    { dimension: '政治与政策', indicator: '执行进展与资金到位', frequency: '政策发布与后续落实节点', signal: '细则、预算执行与经营结果是否对得上', alternative: '资金安排可能置换旧支出，不能只看公告金额', sourceIds: ['GOV26'] },
    { dimension: '国际局势', indicator: '运输成本与交付周期', frequency: '周度观察，月度复盘', signal: '成本持续抬升且交付变慢，才更接近实际约束', alternative: '季节性、拥堵及个别航线事件也会造成波动', sourceIds: ['WTO26'] },
    { dimension: '全球经济', indicator: '预测修订与需求广度', frequency: '机构发布时；按预测版本比较', signal: '多个行业和地区是否共同改善，而非少数投资链拉动', alternative: '预测变化可能来自假设和历史数据修订', sourceIds: ['IMF26'] },
    { dimension: '国内形势', indicator: '产出、价格、回款的组合', frequency: '月度与季度联合观察', signal: '量增、价格稳定、现金回收能否同时出现', alternative: '不同频率、样本和口径不能直接相加或排名', sourceIds: ['NBS26'] },
    { dimension: '社会要素', indicator: '家庭风险与服务可达性', frequency: '年度结构观察；结合本地调查', signal: '照护负担、时间约束与收入波动是否减轻', alternative: '宏观人口预测不提供个体家庭即时负担数据', sourceIds: ['UN24'] },
    { dimension: '技术与劳动', indicator: '任务、岗位与薪资变化', frequency: '季度岗位盘点', signal: '效率提升是否伴随质量、培训与收入改善', alternative: '采用AI、岗位暴露和真实替代是不同变量', sourceIds: ['ILO25'] },
  ],
  agenda: [
    { title: '第二期候选｜安全与效率', question: '供应链多一份备份，成本和责任由谁承担？' },
    { title: '第三期候选｜技术与分配', question: 'AI效率增长如何转成岗位升级，而不只是任务压缩？' },
    { title: '第四期候选｜人口与公共服务', question: '照护、住房与流动机会，怎样改变家庭的长期选择？' },
  ],
});
