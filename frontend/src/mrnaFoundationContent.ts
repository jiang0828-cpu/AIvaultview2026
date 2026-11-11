export const foundationUpdatedAt = '2026-11-11';

export const foundationSources = [
  { id: 'F01', title: 'RNA Fact Sheet', publisher: 'NHGRI', url: 'https://www.genome.gov/about-genomics/educational-resources/fact-sheets/ribonucleic-acid-fact-sheet', locator: 'How is RNA different from DNA? / RNA can make proteins', access: '官方科普正文；用于RNA、翻译与结构基础' },
  { id: 'F02', title: 'Prophylactic LNP mRNA Vaccines', publisher: 'FDA研讨会 · Keith Peden · 2022', url: 'https://www.fda.gov/media/166986/download', locator: '幻灯片15：mRNA结构；13、20–21：递送与脂质；24：CMC', access: '已访问演讲PDF相关页；为预防性疫苗教学材料及讲者观点，不作为肿瘤药物监管指南' },
  { id: 'F03', title: 'Can mRNA Vaccines Help Treat Cancer?', publisher: 'NCI · 2022', url: 'https://www.cancer.gov/news-events/cancer-currents-blog/2022/mrna-vaccines-to-treat-cancer', locator: 'How do mRNA vaccines work? / neoantigen相关段落', access: '官方科普正文；仅用于机制，不沿用2022年的临床或审批状态' },
  { id: 'F04', title: 'Cancer Treatment Vaccines', publisher: 'NCI', url: 'https://www.cancer.gov/about-cancer/treatment/types/immunotherapy/cancer-treatment-vaccines', locator: 'How do cancer treatment vaccines work against cancer?', access: '官方机制科普；治疗性疫苗与抗原分类' },
  { id: 'F05', title: 'Immune Checkpoint Inhibitors', publisher: 'NCI', url: 'https://www.cancer.gov/about-cancer/treatment/types/immunotherapy/checkpoint-inhibitors', locator: '机制图及How do immune checkpoint inhibitors work against cancer?', access: '官方机制科普；PD-1/PD-L1与免疫相关不良反应' },
  { id: 'F06', title: 'Ionizable lipid nanoparticles encapsulating barcoded mRNA', publisher: 'Guimaraes et al. · J Control Release · 2019', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC7032071/', locator: 'Introduction：四类脂质与生物屏障；Results：体内递送筛选', access: '已访问PMC论文正文相关段落；动物递送研究不作为人体疗效证据' },
  { id: 'F07', title: 'Systemic RNA delivery to dendritic cells', publisher: 'Kranz et al. · Nature · 2016', url: 'https://www.roswellpark.org/sites/default/files/thanavala_4-13-17_systemic_rna_delivery_to_dc_cancer_vaccine.pdf', locator: '论文PDF第1–4页：RNA-LPX、DC、效应与记忆T细胞', access: '已访问医疗机构托管的原始论文PDF相关页；不将早期机制研究外推为当前临床有效' },
  { id: 'F08', title: 'Branched-Tail Lipid Nanoparticles', publisher: 'Hajj et al. · Small · 2019', url: 'https://pubmed.ncbi.nlm.nih.gov/30637934/', locator: 'Abstract：内体酸性环境、电离与mRNA表达', access: '已访问PubMed摘要；未声称阅读期刊全文' },
  { id: 'F09', title: 'mRNA-2752 / NCT03739931', publisher: 'ClinicalTrials.gov', url: 'https://clinicaltrials.gov/study/NCT03739931', locator: '本库2026-11-10注册快照：干预、给药、队列', access: '沿用已核验API快照；用于局部蛋白表达路线，不新增疗效判断' },
  { id: 'F10', title: 'LK101 / ESMO 2026 1950RO', publisher: 'ESMO原始摘要', url: 'https://s3.eu-central-1.amazonaws.com/m-anage.com.storage.esmo/static/esmo2026_abstracts/1950RO.html.pdf', locator: 'Methods：mRNA转染DC与皮内给药', access: '沿用已核验原始摘要；本节不重述疗效数字' },
];

export const rnaSegments = [
  { id: 'cap', label: "5′ 帽", english: 'CAP', role: '保护RNA末端，并帮助翻译起始复合体识别这条mRNA。', connection: '帽结构及加帽比例影响表达；它本身不决定靶向哪个肿瘤。', sourceIds: ['F01', 'F02'] },
  { id: 'utr5', label: "5′ UTR", english: '非翻译区', role: '位于起始密码子之前，参与调节核糖体募集和翻译效率，不编码目标蛋白。', connection: '序列与局部二级结构会影响表达，设计需与整个载荷一起验证。', sourceIds: ['F02'] },
  { id: 'orf', label: '编码区', english: 'ORF', role: '以密码子指定蛋白的氨基酸序列；可编码肿瘤抗原、细胞因子或抗体等不同载荷。', connection: '决定细胞要表达什么。需要分泌或特定细胞定位时，可按产品设计加入相应信号序列。', sourceIds: ['F01', 'F03', 'F09'] },
  { id: 'utr3', label: "3′ UTR", english: '非翻译区', role: '位于终止密码子之后，参与调节RNA稳定性、定位与翻译，不编码目标蛋白。', connection: '它与编码区、帽和尾协同影响表达持续时间，不是独立的肿瘤识别开关。', sourceIds: ['F02'] },
  { id: 'polya', label: 'poly(A) 尾', english: 'AAAA…', role: '由连续腺苷组成，与RNA稳定性和翻译效率有关。', connection: '尾长、完整性及分布需要表征；不能把尾越长直接解释为药效越好。', sourceIds: ['F01', 'F02'] },
];

export const carrierParts = [
  { title: '可电离脂质', detail: '帮助包载RNA；在酸性环境中电离，参与内体膜扰动与RNA释放。', color: 'teal' },
  { title: '辅助磷脂', detail: '参与颗粒组装、结构稳定和膜相互作用。', color: 'violet' },
  { title: '胆固醇', detail: '调节脂质堆积与颗粒稳定性。', color: 'ochre' },
  { title: 'PEG-脂质', detail: '调节粒径、聚集与体内相互作用；具体比例取决于产品。', color: 'blue' },
];

export type MechanismStep = { title: string; location: string; detail: string; barrier: string };
export const mechanismRoutes: { id: string; label: string; payload: string; destination: string; sourceIds: string[]; steps: MechanismStep[] }[] = [
  { id: 'vaccine', label: '体内抗原疫苗', payload: '肿瘤相关抗原或新抗原', destination: '形成识别相应抗原的免疫反应', sourceIds: ['F03', 'F04', 'F07'], steps: [
    { title: '选择抗原', location: '药物设计', detail: '个体化路线依据患者肿瘤特征选择候选新抗原；共享路线使用特定人群中共有的抗原。先确认肿瘤是否表达目标。', barrier: '检测到突变，不等于相应抗原必然被加工、呈递或被T细胞识别。' },
    { title: '递送与释放', location: '细胞摄取 → 胞质', detail: '载体保护RNA，并促进细胞摄取；有效的胞质释放后，mRNA才可被翻译。疫苗可通过抗原呈递细胞直接表达及其他抗原转移路径启动应答。', barrier: '颗粒进入细胞并不等于RNA已经离开内体；有效递送依赖剂型和给药途径。' },
    { title: '表达与呈递', location: '抗原呈递细胞', detail: '细胞合成抗原，再加工为肽段，通过MHC分子展示。人体MHC也称HLA；I类呈递关联CD8 T细胞识别，II类呈递关联CD4 T细胞辅助。', barrier: 'HLA匹配、抗原加工和共刺激均会影响应答，不能仅凭RNA表达量判断疫苗效力。' },
    { title: '启动T细胞', location: '淋巴组织', detail: '抗原呈递与激活信号促进相应T细胞扩增和分化；部分可形成记忆。CD4辅助与先天免疫信号共同参与。', barrier: '测到免疫反应只支持机制活动，不能代替肿瘤缓解或生存获益。' },
    { title: '识别与杀伤', location: '肿瘤微环境', detail: '效应T细胞需抵达肿瘤，并由T细胞受体识别肿瘤细胞表面匹配的肽-HLA，才能发动相应细胞毒反应。', barrier: '抗原丢失、呈递不足、T细胞无法浸润或受到抑制，都可能阻断疗效。' },
  ] },
  { id: 'protein', label: '免疫调节 / 蛋白表达', payload: '细胞因子、共刺激分子或抗体', destination: '改变局部或全身的蛋白信号', sourceIds: ['F09'], steps: [
    { title: '设计表达载荷', location: '药物设计', detail: '编码具有治疗作用的蛋白，而非主要依靠某个肿瘤抗原训练T细胞。具体作用取决于所表达蛋白。', barrier: '抗原疫苗与蛋白表达药物不能仅因都使用mRNA就合并评价。' },
    { title: '递送并翻译', location: '按方案指定的组织与细胞', detail: 'mRNA进入胞质后翻译。局部注射与静脉给药的分布不同；并非每种产品都需要进入肿瘤细胞。', barrier: '需要同时表征表达位置、持续时间与非靶组织暴露。' },
    { title: '改变免疫信号', location: '蛋白作用部位', detail: '以mRNA-2752为例，其编码OX40L、IL-23、IL-36γ，研究采用肿瘤内给药；不能把这一机制套用到所有mRNA项目。', barrier: '蛋白表达和免疫激活仍需临床终点验证，炎症与毒性也要评估。' },
  ] },
  { id: 'dc', label: '体外 DC 路线', payload: '在体外使树突状细胞表达抗原', destination: '给予处理后的细胞产品以启动免疫应答', sourceIds: ['F04', 'F10'], steps: [
    { title: '制备细胞', location: '体外生产', detail: '采集与制备抗原呈递细胞，并在受控条件下完成细胞处理。DC是树突状细胞的简称。', barrier: '需要患者身份链、细胞质量与制造一致性控制。' },
    { title: '转染与表达', location: '体外细胞', detail: '在mRNA-DC路线中，将编码抗原的mRNA导入细胞，使其表达、加工并呈递抗原。其他DC疫苗也可使用不同抗原加载方式。', barrier: '不能将所有DC疫苗都称为mRNA疫苗，也不能把细胞剂量当作RNA剂量。' },
    { title: '给药与应答', location: '患者体内', detail: '给予处理后的细胞，随后诱导免疫应答。LK101本库ESMO结果队列采用皮内注射；其他方案需各自核验。', barrier: '这与在体内直接注射mRNA-LNP不同，给药方式也不应笼统写成静脉回输。' },
  ] },
];

export const antigenTypes = [
  { title: '个体化新抗原', label: '按患者设计', detail: '围绕患者肿瘤特有的体细胞变异，结合表达与HLA等信息选择抗原。不同患者的编码序列可能不同。', question: '候选突变是否表达、能否呈递、是否覆盖主要肿瘤克隆？', sourceIds: ['F03'] },
  { title: '共享肿瘤抗原', label: '按人群匹配', detail: '选择一部分肿瘤共同表达的相关抗原或共享突变抗原。标准化生产不意味着所有患者都适用。', question: '抗原与HLA入选要求是什么？正常组织表达与免疫耐受如何影响窗口？', sourceIds: ['F04'] },
  { title: '肿瘤相关病毒抗原', label: '按病因与抗原匹配', detail: '在相应病毒驱动肿瘤中，以HPV或EBV等相关抗原为靶点。预防感染与治疗已存在肿瘤是不同目标。', question: '病毒类型、肿瘤内抗原表达和治疗场景是否与方案一致？', sourceIds: ['F04'] },
];

export const tumorBarriers = [
  { stage: '抗原与呈递', challenge: '肿瘤异质性、抗原丢失、HLA或加工通路改变', consequence: '有T细胞也可能识别不到部分肿瘤；选择多个抗原仍需验证覆盖度。' },
  { stage: '到达与浸润', challenge: 'T细胞未充分进入肿瘤，或受基质等局部条件限制', consequence: '外周血免疫反应不代表肿瘤内有效杀伤。' },
  { stage: '效应与抑制', challenge: 'PD-1/PD-L1等抑制信号及免疫抑制微环境', consequence: '有联合检查点抑制剂的机制依据，但联合是否增益仍取决于具体试验。' },
  { stage: '获益与风险', challenge: '疾病进展速度、表达暴露、炎症与免疫相关毒性', consequence: '免疫激活并非越强越好；药效、治疗时间窗与安全性需共同评价。' },
];

export const foundationQuestions = [
  { question: '治疗性肿瘤疫苗和预防性疫苗有什么不同？', answer: '前者针对已存在的肿瘤或治疗后残留、复发风险；后者主要预防感染等致病因素。不能用预防HPV感染的效果推断治疗HPV相关肿瘤的效果。', sourceIds: ['F04'] },
  { question: 'mRNA表达需要进入细胞核、修改DNA吗？', answer: '常规mRNA药物在胞质中被核糖体翻译，表达机制不需要进入细胞核或把序列整合进基因组。它也不等同于基因编辑；若载荷编码编辑工具，则是另一种具体设计。', sourceIds: ['F01', 'F02'] },
  { question: '所有mRNA药物都具有这张结构图吗？', answer: '本图只描述常规线性mRNA的功能区段，并未覆盖所有RNA平台或具体产品。分析实际项目时，应分别核验RNA结构、核苷修饰、递送制剂与质量要求，不能仅凭mRNA这一名称认定产品构成相同。', sourceIds: ['F02'] },
  { question: '出现抗原特异T细胞反应，能否说明药物有效？', answer: '它支持免疫原性或机制活动。是否降低复发、延缓进展或延长生存，仍需在相应人群、对照与随访下评价；小样本联合方案不能直接证明疫苗的独立贡献。', sourceIds: ['F03', 'F07'] },
];
