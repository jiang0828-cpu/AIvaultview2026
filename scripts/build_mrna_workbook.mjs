import fs from "node:fs/promises";
import { Workbook, SpreadsheetFile } from "file:///C:/Users/admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs";

const outputDir = "E:/AI/Codex/AGIOS/07AI_VaultFolio_钥藏/output/mrna-research";
const colors = {
  navy: "#17324D",
  blue: "#2F5D7C",
  teal: "#2F7D68",
  light: "#EAF2F5",
  orange: "#F2E2C8",
  red: "#F6E3E3",
  gray: "#66737A",
};

const columnLetter = (number) => {
  let result = "";
  while (number > 0) {
    const remainder = (number - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    number = Math.floor((number - 1) / 26);
  }
  return result;
};

function writeTable(workbook, name, title, headers, rows, tabColor) {
  const sheet = workbook.worksheets.add(name);
  const lastColumn = columnLetter(headers.length);
  sheet.showGridLines = false;
  sheet.tabColor = tabColor;
  sheet.getRange(`A1:${lastColumn}1`).merge();
  sheet.getRange("A1").values = [[title]];
  sheet.getRange(`A3:${lastColumn}3`).values = [headers];
  sheet.getRange(`A4:${lastColumn}${rows.length + 3}`).values = rows;
  sheet.getRange(`A1:${lastColumn}1`).format = {
    fill: colors.navy,
    font: { bold: true, color: "#FFFFFF", size: 14 },
  };
  sheet.getRange(`A3:${lastColumn}3`).format = {
    fill: colors.light,
    font: { bold: true, color: colors.navy },
    wrapText: true,
    borders: { preset: "all", style: "thin", color: "#C9D7DE" },
  };
  sheet.getRange(`A4:${lastColumn}${rows.length + 3}`).format = {
    wrapText: true,
    verticalAlignment: "top",
    borders: { preset: "all", style: "thin", color: "#E0E5E7" },
  };
  sheet.freezePanes.freezeRows(3);
  sheet.getRange(`A:${lastColumn}`).format.columnWidth = 22;
  sheet.getRange("A:A").format.columnWidth = 10;
  return sheet;
}

const pipeline = [
  ["P01", "V940", "mRNA-4157; intismeran autogene", "Moderna", "Merck/MSD", "体内个体化新抗原", "项目制剂细节待补", "完全切除高危IIB-IV黑色素瘤术后辅助", "NCT05933577", "III", "Active, not recruiting", "企业披露实际随机入组1137；注册预计1089", "2026-08-19", "2026-11-10", "A+B", "III期RFS/DMFS topline达终点；OS继续", "完整分层、绝对事件率、OS和监管结论待补", "S01;S02;S03", "优先支持样本、HLA、抗原预测、TAT、MRD和身份链"],
  ["P02", "autogene cevumeran", "BNT122; RO7198457; iNeST", "BioNTech", "Genentech/Roche", "体内个体化新抗原", "RNA-LPX", "术后胰腺导管腺癌；II期IMCODE003", "NCT05968326", "II", "Recruiting", "预计260", "2026-06-09", "2026-11-10", "A", "I期8/16出现高幅度新抗原T细胞反应；II期随机对照在招募", "I期小样本、单中心、非随机、联合治疗", "S04;S05", "样本质量、快速制造、免疫监测和MRD"],
  ["P03", "BNT111", "FixVac", "BioNTech", "Regeneron", "共享抗原", "RNA-LPX", "抗PD-1/PD-L1失败晚期黑色素瘤", "NCT04526899", "II", "Completed", "实际184", "2026-01-08", "2026-11-10", "A+B", "公司2024阳性topline；最终注册结果待补", "不写具体ORR/PFS，缺完整论文/注册结果", "S06;S07", "免疫监测、抗原表达/HLA筛选"],
  ["P04", "BNT113", "tenumomeran; raplemomeran; tenu-ra", "BioNTech", "无", "共享病毒抗原", "RNA-LPX", "HPV16+、PD-L1+复发/转移HNSCC一线", "NCT04534205", "II/III", "Recruitment complete / follow-up", "以最新注册版本为准", "2026-10-13", "2026-11-10", "A+B", "PFS双主要终点未达统计显著；OS继续", "完整OS和分层数据待补", "S08;S09", "HPV分型、免疫监测和阴性复盘"],
  ["P05", "mRNA-5671/V941", "V941", "Moderna", "Merck/MSD", "KRAS共享抗原", "项目标签为mRNA-LNP", "KRAS突变晚期NSCLC/CRC/胰腺癌", "NCT03948763", "I", "Terminated; Business Reasons", "实际70", "2025-01-28", "2026-11-10", "A", "研究因商业原因终止", "不外推为KRAS路线整体失败", "S10", "项目级尽调和退出样本"],
  ["P06", "mRNA-2752", "mRNA-2752", "Moderna", "无", "体内免疫调节型", "瘤内LNP", "晚期实体瘤或淋巴瘤", "NCT03739931", "I", "Completed", "实际134", "2025-08-15", "2026-11-10", "A", "瘤内表达OX40L、IL-23、IL-36γ", "不是新抗原疫苗；可注射病灶限制外推", "S11", "局部给药、病灶可及性和免疫监测"],
  ["P07", "BI 1361849", "CV9202; RNActive", "CureVac / Boehringer相关", "Ludwig Institute", "共享抗原多价RNA", "RNA疫苗；具体递送待核对", "晚期NSCLC，联合durvalumab ± tremelimumab", "NCT03164772", "I/II", "Complete", "最多计划56", "2026-11-10", "2026-11-10", "A", "早期路线和有限/失败背景", "缺少现代注册级可比证据", "S12;S13", "历史/失败路线对照"],
  ["P08", "LK101", "LK101 Injection", "北京立康生命科技", "研究者/临床中心", "ex vivo DC-mRNA个体化新抗原", "mRNA导入自体DC后回输", "晚期实体瘤；公开资料涉及NSCLC IIT", "NCT05886439线索", "I / Ib-IIa线索", "国内I期接近尾声；公司披露推进肺癌II期", "2026-08-24", "2026-11-10", "B", "政府披露国内和FDA IND；公司披露II期推进", "研究分层、样本量和疗效待注册核验；不与体内LNP横比", "S14;S15", "样本、单采、细胞加工、中心实验室"],
  ["P09", "LY01620", "LY01620", "绿叶制药", "无", "共享病毒抗原", "具体递送待注册核验", "HPV16+宫颈HSIL；探索HPV相关肿瘤", "中国II期拟开展", "I→II", "公司公告拟开展II期", "未披露", "2026-08-20", "2026-11-10", "B", "企业披露I期HPV清除率近90%等信号", "缺样本量、对照、随访、原始摘要", "S16", "HPV分型、病理、长期复发监测"],
  ["P10", "ZY008", "ZY008", "中国项目（注册信息）", "无", "体内个体化新抗原（待确认）", "待核验", "晚期实体瘤", "ChiCTR2600117499", "I线索", "预注册（搜索结果）", "待核验", "2026-01-26", "2026-11-10", "B（部分）", "搜索结果显示安全性/耐受性/初步有效性研究", "详情页405，不能补写全文", "S17", "监测池"],
  ["P11", "YKYY031", "YKYY031", "悦康药业", "无", "肿瘤新抗原mRNA（临床前）", "公司披露含TLP平台", "肿瘤新抗原；临床前", "未公开", "临床前", "候选序列确认", "待核验", "2025-08-29", "2026-11-10", "B", "公司报告披露候选序列及TLP/Cap1平台", "无临床编号；平台披露不等于临床验证", "S18", "递送和CMC方法学切入"],
];

const evidence = [
  ["E01", "V940 / intismeran", "NCT05933577", "III期随机、双盲、安慰剂/主动对照", "完全切除高危IIB-IV黑色素瘤", "术后辅助", "V940 + pembrolizumab", "pembrolizumab单药", "企业披露随机入组1137", "RFS、DMFS；OS继续", "企业披露达RFS/DMFS终点；绝对率和OS未披露", "公司称无新安全信号", "2026-08-19", "来源披露（B）", "完整会议/论文数据待补", "S01;S02"],
  ["E02", "V940 / mRNA-4157", "KEYNOTE-942 / NCT03897881", "IIb随机研究；五年随访", "高危切除后III/IV黑色素瘤", "术后辅助", "V940 + pembrolizumab", "pembrolizumab单药", "按原注册记录核对", "RFS、DMFS", "公司披露HR(RFS)=0.510；HR(DMFS)=0.411", "公司称组合安全性一致", "2026-01-20", "来源披露（B）", "不能分离mRNA单独贡献", "S03"],
  ["E03", "autogene cevumeran", "研究者发起I期（Nature 2023）", "单中心、非随机、序贯联合", "可手术切除PDAC", "术后辅助", "atezolizumab→autogene cevumeran→mFOLFIRINOX", "无随机对照", "19例接受；16例接种", "免疫原性；18个月RFS", "8/16出现高幅度新抗原T细胞；应答者RFS较长", "16例均有1-2级AE；1/16有3级AE", "2023-05-10", "原始论文（A）", "样本小、单中心、非随机、联合治疗", "S04"],
  ["E04", "autogene cevumeran", "NCT05968326 / IMCODE003", "II期开放标签、多中心、随机", "切除后PDAC且无既往系统治疗", "术后辅助", "autogene cevumeran + atezolizumab + mFOLFIRINOX", "mFOLFIRINOX单药", "预计260", "无事件生存/安全性等", "2026-06-09 Recruiting；无公开结果", "结果未到", "2026-06-09", "注册事实（A）", "试验进行中，不能提前推断", "S05"],
  ["E05", "BNT111", "NCT04526899", "II期开放标签随机，含单药校准臂", "抗PD-1/PD-L1失败晚期黑色素瘤", "晚期/难治", "BNT111 + cemiplimab；单药校准臂", "单药校准臂", "184实际", "疗效、安全性、耐受性", "公司阳性topline；完整结果待注册发布", "未独立核验完整数据", "2026-01-08", "A+B", "公司topline不能替代最终结果", "S06;S07"],
  ["E06", "BNT113", "NCT04534205 / AHEAD-MERIT", "II/III期开放标签对照", "HPV16+、PD-L1+复发/转移HNSCC", "一线晚期", "BNT113 + pembrolizumab", "pembrolizumab单药", "以最新注册版本为准", "PFS、OS双主要终点", "PFS未达统计显著；OS继续", "完整OS待随访", "2026-10-13", "来源披露（B）", "不能据PFS提前写终局失败", "S08"],
  ["E07", "mRNA-5671/V941", "NCT03948763", "I期开放标签", "KRAS突变NSCLC/CRC/胰腺癌", "晚期", "V941单药或 + pembrolizumab", "无", "70实际", "安全性、耐受性、推荐剂量", "Terminated；Business Reasons", "无注册级疗效结论", "2025-01-28", "注册事实（A）", "项目级终止，不外推路线", "S10"],
  ["E08", "mRNA-2752", "NCT03739931", "I期开放标签剂量递增/扩展", "晚期实体瘤或淋巴瘤", "晚期/瘤内", "瘤内mRNA-2752 ± durvalumab", "单药/联合探索", "134实际", "安全性、耐受性、剂量探索", "2025-08-01完成；本轮未取得完整疗效数据", "具体安全性和疗效待结果提交", "2025-08-15", "注册事实（A）", "局部免疫调节型，不与新抗原横比", "S11"],
  ["E09", "BI1361849/CV9202", "NCT03164772", "I/II期开放标签", "晚期NSCLC", "晚期/联合", "BI1361849 + durvalumab ± tremelimumab", "联合方案内无标准对照", "最多计划56", "安全性和初步疗效", "NCI记录complete；EU CTR另有早期维持结果", "早期项目，跨试验不可比", "2026-11-10", "注册事实（A）", "纳入历史/有限证据", "S12;S13"],
  ["E10", "LY01620", "中国II期拟开展", "企业披露I期结果", "HPV16+宫颈HSIL", "癌前/早期病变", "HPV16 E6/E7治疗性mRNA疫苗", "公司称接近标准手术治疗", "未披露", "病毒清除、病理改善、安全性", "企业披露HPV清除率近90%等信号", "公司称总体耐受良好", "2026-08-20", "来源披露（B）", "样本量、对照、随访和原始摘要缺失", "S16"],
];

const sources = [
  ["S01", "ClinicalTrials.gov", "NCT05933577 V940-001 / INTerpath-001", "NLM / MSD", "2025-09-24", "https://clinicaltrials.gov/study/NCT05933577", "Study Overview; Phase 3; estimated enrollment 1089", "研究编号、阶段、状态、预计样本量", "A", "已访问"],
  ["S02", "企业正式披露", "INTerpath-001 topline", "Moderna / Merck", "2026-08-19", "https://news.modernatx.com/merck-and-moderna-announce-phase-3-interpath-001-trial-of-intismeran-plus-keytruda-met-endpoints-of-rfs-and-dmfs-in-melanoma", "RFS/DMFS topline; actual randomized 1137; OS ongoing", "III期结果与实际入组", "B", "已访问"],
  ["S03", "企业正式披露", "5-Year Data for Intismeran Autogene", "Merck / Moderna", "2026-01-20", "https://www.merck.com/news/moderna-merck-announce-5-year-data-for-intismeran-autogene-in-combination-with-keytruda-pembrolizumab-demonstrated-sustained-improvement-in-the-primary-endpoint-of-recurrence-free-survival-i/", "HR(RFS)=0.510; HR(DMFS)=0.411", "五年随访HR", "B", "已访问"],
  ["S04", "原始论文", "Personalized RNA neoantigen vaccines stimulate T cells in pancreatic cancer", "Nature", "2023-05-10", "https://www.nature.com/articles/s41586-023-06063-y", "16 treated; 8/16 immune responders; RFS association", "I期免疫原性和可行性", "A", "已访问"],
  ["S05", "ClinicalTrials.gov", "NCT05968326 IMCODE003", "NLM / Genentech", "2026-06-09", "https://clinicaltrials.gov/study/NCT05968326", "Recruiting; Phase II; estimated enrollment 260", "后续随机对照验证", "A", "已访问"],
  ["S06", "ClinicalTrials.gov", "NCT04526899 BNT111", "NLM / BioNTech", "2026-01-08", "https://clinicaltrials.gov/study/NCT04526899?tab=researcher", "Completed; actual enrollment 184", "阶段、状态、样本量、设计", "A", "已访问"],
  ["S07", "企业正式披露", "Positive Topline Phase 2 Results for BNT111", "BioNTech", "2024-07", "https://www.biontech.com/int/en/home/mediaroom/news/press-releases/2024/07/biontech-announces-positive-topline-phase-2-results-mrna.html", "Press release; topline only", "公司披露，不替代完整结果", "B", "已访问"],
  ["S08", "企业正式披露", "BNT113 AHEAD-MERIT update", "BioNTech", "2026-10-13", "https://www.biontech.com/us/en/home/mediaroom/news/press-releases/2026/10/BioNTech-Provides-Update-on-Phase-2-3-Clinical-Trial-for-mRNA-Cancer-Immunotherapy-Candidate-BNT113-in-Metastatic-HPV16-positive-Head-and-Neck-Cancer.html", "PFS not statistically significant; OS ongoing", "阴性/未决临床信号", "B", "已访问"],
  ["S09", "企业临床试验页", "BNT113-01", "BioNTech", "2026-11-10", "https://clinicaltrials.biontech.com/trials/BNT113-01", "Phase II/III; recruitment complete; NCT04534205", "试验设计与状态", "B", "已访问"],
  ["S10", "ClinicalTrials.gov", "NCT03948763 V941-001", "NLM / MSD", "2025-01-28", "https://clinicaltrials.gov/study/NCT03948763", "Terminated; Business Reasons; actual enrollment 70", "终止状态、原因、样本量", "A", "已访问"],
  ["S11", "ClinicalTrials.gov", "NCT03739931 mRNA-2752", "NLM / Moderna", "2025-08-15", "https://clinicaltrials.gov/study/NCT03739931", "Completed; Phase I; actual enrollment 134", "阶段、状态、路线、样本量", "A", "已访问"],
  ["S12", "NCI", "NCT03164772 BI1361849/CV9202", "National Cancer Institute", "2026-11-10", "https://www.cancer.gov/research/participate/clinical-trials-search/v?id=NCI-2018-01133", "Phase I/II; NSCLC; complete", "历史路线、设计、状态", "A", "已访问"],
  ["S13", "EU Clinical Trials Register", "BI1361849 maintenance results", "EU CTR", "2019-01-06", "https://www.clinicaltrialsregister.eu/ctr-search/trial/2014-004959-30/results", "Phase II results; trial ended 2016-10-10", "早期有限/失败证据", "A", "已访问"],
  ["S14", "政府正式披露", "LK101 获FDA IND批准", "北京市科委/中关村管委会", "2025-02-11", "https://kw.beijing.gov.cn/xwdt/bmdt/202502/t20250211_4007999.html", "国内2023临床批准；FDA IND；DC/mRNA", "中国项目状态、产品形态", "B", "已访问"],
  ["S15", "企业正式披露", "LK101 phase II investigators meeting", "Likang Life Sciences", "2026-08-24", "https://likanglife.com/news/original-news-321", "NCT05886439 cited; NSCLC phase II activity", "研究线索", "B", "已访问"],
  ["S16", "企业正式披露", "LY01620 planned China Phase II", "Luye Pharma", "2026-08-20", "https://www.luye.cn/lvye/view.php?id=1956", "HPV16 E6/E7; planned China Phase II; company signals", "产品方向和来源披露", "B", "已访问"],
  ["S17", "临床注册搜索结果", "ChiCTR2600117499 ZY008", "Chinese Clinical Trial Registry", "2026-01-26", "https://www.chictr.org.cn/hvshowproject.html?id=293672&v=1.0", "Prospective registration shown; detail page returned 405", "仅作监测池", "B", "部分访问"],
  ["S18", "公司定期报告", "悦康药业2025年半年度报告", "CNINFO / Yuekang", "2025-08-29", "https://static.cninfo.com.cn/finalpage/2025-08-29/1224610083.PDF", "PDF p16-17; YKYY031 preclinical; TLP/Cap1", "中国平台与临床前线索", "B", "已访问"],
  ["S19", "监管质量文件", "Guideline on quality aspects of mRNA vaccines", "EMA", "2024 draft", "https://www.ema.europa.eu/en/documents/scientific-guideline/draft-guideline-quality-aspects-mrna-vaccines_en.pdf", "CQA: size/PDI, integrity, cap, poly(A), encapsulation, stability", "CMC质量框架", "A", "已访问"],
  ["S20", "监管质量文件", "WHO TRS 1039 Annex 3 mRNA vaccines", "WHO", "2022", "https://cdn.who.int/media/docs/default-source/biologicals/vaccine-standardization/annex-3---mrna-vaccines_who_trs_1039_web-2.pdf?download=true", "Manufacturing, validation, lipid controls, stability", "制造质控框架", "A", "已访问"],
];

const bd = [
  ["BD01", "V940; autogene cevumeran; LK101; ZY008", "样本与个体化抗原筛选", "肿瘤/正常配对样本、DNA/RNA测序、HLA、肿瘤纯度、候选新抗原排名与版本报告", "V940由患者突变指纹驱动；Nature 2023实时制造；LK101强调测序和AI预测", "最低样本量、FFPE接受度、算法锁定、TAT、数据归属", "与2–3个项目方做20–30例回溯验证", "P0", "样本质量和TAT若不满足，结果无法转成药物交付"],
  ["BD02", "V940; IMCODE003; LK101", "MRD/ctDNA与复发监测", "个体化panel、基线/治疗中/随访采样、ctDNA清除/反弹规则", "RFS/DMFS是关键终点；MRD可作为支持性读数", "阈值、预设统计、是否写入方案、panel可比性", "提交研究者发起伴随检测方案", "P1", "不能未经验证替代RFS/OS"],
  ["BD03", "个体化mRNA与ex vivo DC项目", "中心实验室与身份链", "条码、样本物流、患者-序列-批次绑定、放行前身份核验、温度/偏差记录", "个体化产品每位患者一套序列/批次；Nature 2023显示术后窗口制造", "真实节点、偏差范围、冷链、跨中心SOP", "搭建端到端模拟链路，测量采样到首剂给药TAT", "P1", "任何错配或延迟都可能临床不可用"],
  ["BD04", "V940; BNT111; BNT113; mRNA-2752", "免疫监测与伴随证据", "ELISpot、TCR、单细胞、空间病理、PD-L1/HLA/抗原表达", "Nature 2023把T细胞克隆与RFS联系；BNT113机制不能抵消PFS阴性", "assay标准、时间点、中心实验室、统计桥接", "设计跨项目标准panel并与临床终点对齐", "P1", "免疫原性阳性不等于肿瘤获益"],
  ["BD05", "LNP/RNA-LPX/候选平台", "CMC/QC方法学", "cap/poly(A)、完整性、包封率、粒径/PDI、残留、效价、稳定性、冻融", "EMA/WHO明确列出关键质量属性和工艺控制", "产品特定放行标准、参比品、变更管理、稳定性数据", "做一次CMC gap assessment", "P1", "质量框架不等于具体产品已达标"],
  ["BD06", "LK101; LY01620; ZY008", "中国临床标准化", "多中心样本采集、中心实验室、病理/病毒分型、注册数据包", "公开资料显示中国项目从I期到II期活动增加", "真实入组、方案、预算、注册路径", "按阶段建立项目清单，先核验注册号和负责人", "P2", "企业披露和注册状态可能不一致"],
];

const gaps = [
  ["G01", "V940完整III期数据", "缺绝对RFS/DMFS、OS、分层和全文", "高", "企业topline已核验；完整数据待会议/论文/监管文件", "保留为topline，不写已获批", "待跟踪"],
  ["G02", "BNT113 OS", "PFS未达统计显著，OS仍在随访", "高", "BioNTech 2026-10-13披露", "不能据PFS阴性提前写终局失败", "持续跟踪"],
  ["G03", "LY01620 I期", "缺样本量、对照、随访、原始摘要和注册号", "高", "仅企业正式页面", "将近90%写为来源披露", "待补注册/摘要"],
  ["G04", "LK101研究分层", "国内I期、NCT05886439 IIT/IIa和FDA IND关系需拆分", "中高", "政府与企业页面分别披露", "每项研究单独建ID", "待补注册全文"],
  ["G05", "ZY008", "ChiCTR详情页405，无法核验全文", "高", "搜索结果可见预注册", "不进入主要结论", "待人工浏览/下载"],
  ["G06", "产品递送细节", "V940、V941、LY01620部分制剂细节未完整确认", "中", "注册/企业页面片段", "不凭行业常识补写", "待补CMC/IB"],
  ["G07", "跨试验比较", "不同疾病、线次、联合和终点不可直接排名", "高", "方法学审查", "报告已禁用横向疗效排名", "已修订"],
  ["G08", "中国全量管线", "未做穷尽性注册数据库导出", "中", "本轮为代表性样本", "继续按别名和企业扩展", "下一轮"],
];

const searchLog = [
  ["2026-11-10", "ClinicalTrials.gov", "V940; mRNA-4157; intismeran autogene", "NCT05933577; KEYNOTE-942", "核验阶段、状态、样本量、终点", "区分注册更新时间和公司实际入组", "完成"],
  ["2026-11-10", "ClinicalTrials.gov", "autogene cevumeran; BNT122; NCT05968326", "IMCODE003", "核验II期设计、状态、样本量", "I期论文与II期注册分开", "完成"],
  ["2026-11-10", "ClinicalTrials.gov", "BNT111; BNT113; mRNA-5671; mRNA-2752", "NCT04526899; NCT04534205; NCT03948763; NCT03739931", "核验代表路线和阴性/终止证据", "保留BNT113 PFS阴性与V941商业终止", "完成"],
  ["2026-11-10", "NCI/EU CTR", "CV9202; BI1361849; RNActive", "NCT03164772; EudraCT 2014-004959-30", "补充早期/有限证据", "纳入历史和失败背景，不做疗效排名", "完成"],
  ["2026-11-10", "论文/PubMed", "personalized RNA neoantigen vaccines pancreatic cancer", "Nature 2023", "核验16例、8/16免疫反应、RFS相关、AE", "写成I期可行性/免疫原性", "完成"],
  ["2026-11-10", "监管质量", "EMA draft quality aspects mRNA; WHO TRS1039", "EMA/WHO", "补充CMC/QC关键质量属性", "用于BD需求框架，不写成产品合格", "完成"],
  ["2026-11-10", "中国政府/企业", "LK101; LY01620; ZY008; YKYY031", "北京科委、Likang、Luye、ChiCTR、CNINFO", "覆盖中国样本和信息缺口", "企业披露与注册状态分开", "部分完成"],
];

const workbook = Workbook.create();
writeTable(workbook, "Pipeline", "mRNA 肿瘤药物管线台账（截至 2026-11-10）", ["ID", "药物", "别名", "企业", "合作方", "技术路线", "递送方式", "适应证/场景", "研究编号", "阶段", "研究状态", "样本量/入组", "最新来源日期", "本轮核验日", "证据等级", "最新信号", "局限/待核验", "来源ID", "BD相关性"], pipeline, colors.teal);
writeTable(workbook, "Clinical_Evidence", "临床证据表（药物、试验、队列与时间点分开）", ["证据ID", "产品", "试验编号", "研究设计", "人群", "治疗场景", "方案", "对照", "样本量/分析集", "主要终点", "疗效/免疫原性", "安全性", "数据截止/披露日", "证据类型", "局限性", "来源ID"], evidence, colors.blue);
writeTable(workbook, "Sources", "来源与定位记录", ["来源ID", "来源类型", "标题", "机构/作者", "发布日期/更新日", "URL", "定位信息", "支持内容", "证据等级", "访问状态"], sources, colors.orange);
writeTable(workbook, "BD_Opportunities", "精准检测企业 BD 机会表", ["机会ID", "目标项目", "待解决需求", "合作切口", "公开证据", "待验证信息", "下一步行动", "优先级", "主要风险"], bd, colors.teal);
writeTable(workbook, "Gaps_Review", "信息缺口与审查修订", ["缺口ID", "问题", "影响", "优先级", "已核验依据", "修订口径", "后续状态"], gaps, colors.red);
writeTable(workbook, "Search_Log", "检索与质量检查日志", ["日期", "来源范围", "检索词/别名", "定位范围", "目的", "处理规则", "状态"], searchLog, colors.gray);

const cover = workbook.worksheets.add("Cover");
cover.showGridLines = false;
cover.tabColor = colors.navy;
cover.getRange("A1:H1").merge();
cover.getRange("A1").values = [["mRNA 肿瘤药物研究及开发进展｜主台账"]];
cover.getRange("A3:B12").values = [
  ["执行日", "2026-11-10"],
  ["信息截止日", "2026-11-10"],
  ["目标受众", "精准医学企业市场与药企合作BD负责人"],
  ["研究口径", "全球范围，兼顾中国；代表性样本，不是穷尽性注册库"],
  ["路线分类", "体内个体化 / 共享或病毒抗原 / 免疫调节 / ex vivo DC-mRNA"],
  ["证据标签", "A=注册/原始论文/监管；B=企业或政府披露；C=线索；D=推断"],
  ["管线样本数", null],
  ["临床证据条数", null],
  ["来源条数", null],
  ["高优先级缺口", null],
];
cover.getRange("B9:B12").formulas = [["=COUNTA(Pipeline!A4:A200)"], ["=COUNTA(Clinical_Evidence!A4:A200)"], ["=COUNTA(Sources!A4:A200)"], ["=COUNTIF(Gaps_Review!D4:D200,\"高\")"]];
cover.getRange("A1:H1").format = { fill: colors.navy, font: { bold: true, color: "#FFFFFF", size: 16 } };
cover.getRange("A3:A12").format = { fill: colors.light, font: { bold: true, color: colors.navy }, borders: { preset: "all", style: "thin", color: "#D3DEE4" } };
cover.getRange("B3:B12").format = { wrapText: true, borders: { preset: "all", style: "thin", color: "#D3DEE4" } };
cover.getRange("A14:H14").merge();
cover.getRange("A14").values = [["使用约束"]];
cover.getRange("A14:H14").format = { fill: colors.blue, font: { bold: true, color: "#FFFFFF" } };
cover.getRange("A15:H19").merge();
cover.getRange("A15").values = [["1) 产品、试验、队列和时间点分开管理；2) 企业topline、政府转述或新闻稿均在证据等级中标注；3) 不跨试验直接比较ORR/PFS/RFS；4) 待核验字段不能作为已证实事实；5) 更新时保留来源日期和变更日志。"]];
cover.getRange("A15:H19").format = { wrapText: true, verticalAlignment: "top", fill: "#F6F8F7", borders: { preset: "all", style: "thin", color: "#D3DEE4" } };
cover.getRange("A21:H21").merge();
cover.getRange("A21").values = [["对应文件：00_管理层决策摘要.md｜01_完整调研报告.md｜03_检索与质量检查记录.md"]];
cover.getRange("A21:H21").format = { font: { italic: true, color: colors.gray } };
cover.getRange("A:H").format.columnWidth = 24;
cover.freezePanes.freezeRows(2);

await fs.mkdir(outputDir, { recursive: true });
await workbook.recalculate();
const xlsx = await SpreadsheetFile.exportXlsx(workbook);
await xlsx.save(`${outputDir}/02_mRNA肿瘤药物主台账.xlsx`);
const preview = await workbook.render({ sheetName: "Cover", autoCrop: "all", scale: 1, format: "png" });
await fs.writeFile(`${outputDir}/02_mRNA肿瘤药物主台账_preview.png`, new Uint8Array(await preview.arrayBuffer()));
console.log("Workbook written.");
