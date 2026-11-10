# 独立证据审稿

审稿日期：2026-11-10。候选 SHA：`b4fd03d0644e29b4549999a53cf4444df70693b9`。

审稿身份：本环境独立原生 Astra 代理；不是 Claude，也不构成双模型审核。已阅读 CHARTER、STANDARD、QA。核对 research-data.json、findings.json、coverage-notes.json、完整报告和实际 XLSX（只读导入，重点检查 Programs、Trials、Evidence、Endpoints）。本审稿不修改产品文件，不提交 commit。下列判断仅针对该 SHA，不替未来修订版本背书。

## 结论

核心临床结果已明显补齐，未发现 V940 III 期主效应量、CRC 终止、BNT111 历史对照、LK101/EVM16/WGc-043 核心人数和效应数值造假或与核验原始来源矛盾。发现 2 项 Major、3 项 Minor。公司归属错误和导出结果语义丢失应修复后再交 BD。未发现 Critical。

## 五项可执行问题

### E1 — Major：YKYY031 被归到错误公司

- 位置：`research-data.json` 的 `trials[NCT07631793].company`（候选行5749）；Excel `Programs!B31`。值为“远大医药（企业来源）；申办方见注册”。
- 原始证据：已独立打开所引[2025-057公告](https://static.cninfo.com.cn/finalpage/2025-12-13/1224872452.PDF)。公告主体、落款均为悦康药业集团股份有限公司，注册申办方也是 Beijing Youcare Kechuang Pharmaceutical Technology Co., Ltd.，不是远大医药。
- 决策影响：直接把 BD 联系对象、权益尽调和公司管线归并导向另一家企业。附“申办方见注册”不能消除明确错误。
- 修订：归一公司写“悦康药业 / Youcare”；保留注册申办方法人字段及权益来源。检查生成映射、JSON、Programs、页面和任何报告公司表同步更新。
- 验收：全交付物中 YKYY031 不再出现“远大医药”；注册法人和企业来源仍可独立追溯。

### E2 — Major：结果格式化丢失治疗臂、单位及单终点分母，对照列又统一错写“未披露”

- 位置：`evidence[*].control` 16条全部为“未披露”；`E-BNT111-PH2.result`（候选行818）；完整报告行221；Excel `Evidence!G10/K10`。
- 实例：三条 ORR 显示18.1%、17.4%、13.6%，结果文字没有各自治疗臂；PFS 3.1、OS 20.7 没有“月”。其原始 endpoints 有 arm/n/unit，Excel Endpoints 第25–29行也保留了这些字段，说明错误发生在摘要/导出文字层。V940 明确有安慰剂+pembrolizumab，CRC 明确有 watchful waiting，仍被标成对照“未披露”。单臂研究应写“无随机对照/单臂”，不能写未知。
- 原始证据：[ESMO 1605MO](https://s3.eu-central-1.amazonaws.com/m-anage.com.storage.esmo/static/esmo2025_abstracts/1605MO.html.pdf) Methods/Results确认三臂及对应人数；18.1%的主要检验对象是历史假设10%，不是随机cemiplimab臂。原始数据抽取正确，但结果阅读及表格筛选会丢语义。
- 决策影响：把一行结果复制进汇报或筛选对照研究时，可能误配治疗臂或把随机研究归为对照信息缺失。不能要求读者靠结果顺序猜测。
- 修订：显式维护 regimen/control 元数据；所有端点格式化包含 arm、单位、适用n、CI、比较对象与分析集；不披露和不适用分开。保留历史假设与calibrator设计的说明，不擅自计算组间优效。
- 验收：BNT111结果能单独读懂“组合18.1%(n94)、BNT111单药17.4%(n46)、cemi单药13.6%(n44)，中位PFS/OS单位月”；V940和CRC的control不是未披露。Excel Evidence和完整报告与JSON同步。

### E3 — Minor：LK101“回输”容易被理解为静脉输注，和当前结果试验皮内接种不符

- 位置：两个LK101试验的delivery（候选行4403/4583）；完整报告行778/811；Programs路线。
- 原始证据：[ESMO 2026 1950RO](https://s3.eu-central-1.amazonaws.com/m-anage.com.storage.esmo/static/esmo2026_abstracts/1950RO.html.pdf) Methods明确 NCT05886439 的 mRNA转染DC以皮内方式给药，1.5×10^7 cells/dose。
- 决策影响：细胞产品分类已经正确，但“回输”掩盖实际给药途径，会影响递送技术和临床运营比较。
- 修订：该试验写“ex vivo mRNA转染自体DC，皮内注射”；另一方案若尚未独立核实途径，写“ex vivo DC；给药途径待逐方案核验”，不可由同名项目自动套用。临床结果条目也保留给药途径。
- 验收：无笼统“DC后回输”；登记与结果对应方案各自归一。

### E4 — Minor：WGc-043 把两名CR持续状态日期升格成整项分析截止日

- 位置：`E-WGC-2026.dataCutoff = 2026-01-11`（候选行1051），完整报告行276，Excel `Evidence!M14`。
- 原始证据：独立检索可读的[ASCO7077原始摘要及表](https://ascopubs.org/doi/10.1200/JCO.2026.44.16_suppl.7077)写的是两名患者在2026-01-11仍维持CR。并没有明确声明这是全部疗效、安全性数据库的共同截止日。出版PDF脚注还另有摘要数据截至2026-05-12。直开HTML为403，结论基于原站索引全文和表；未声称读取额外论文全文。
- 决策影响：日期已经在accessNote中正确限定，但结构化主字段和导出又把它作为全局dataCutoff，用户会误判数据成熟度。
- 修订：dataCutoff置null；添加CR状态观察日2026-01-11与摘要更新日2026-05-12，含义分别标明。不要把5月12日自动替换成临床数据截止日。
- 验收：报告/Excel截止日为“未明确披露”，CR持续观察日仍可见。保留入组5、疗效/AE表4、CR2/4。

### E5 — Minor：CureVac已完成被收购仍仅留“历史申办方/企业归属待核”，缺少可核的当前集团层级

- 位置：`trials[NCT05938387].company` 及其notes；CVGBM/CureVac相关Programs；analysis.mjs公司映射。
- 原始证据：[BioNTech Q3 2026 SEC报告](https://www.sec.gov/Archives/edgar/data/1776985/000177698526000081/bntxq32026ex991quarterlyre.htm)“Business Combination / Acquisition of CureVac”确认2025-12-15已完成收购；[CureVac官方说明](https://www.curevac.com/curevac-is-now-part-of-the-biontech-group/)也确认其属于BioNTech Group。
- 决策影响：当前写法没有断言CureVac仍独立，故不列Major，但BD公司归一欠完整，不能只按历史名称当不同经济集团计算客户。
- 修订：历史注册申办方CureVac保留；另列“当前集团：BioNTech（来源/核验日）”。具体CVGBM后续资产开发、权利分配仍可待核，不由集团收购自动推定复活或终止。
- 验收：历史申办方、当前集团、资产开发状态三者分开；不虚构新合作方或开发计划。

## 独立原始来源核验记录

| 核心问题 | 实际核验与判断 |
|---|---|
| V940 III期 | 打开[Merck 2026-10-22正式披露](https://www.merck.com/news/merck-and-moderna-will-present-results-from-landmark-phase-3-interpath-001-trial-for-intismeran-autogene-plus-keytruda-pembrolizumab-at-esmo-2026-presidential-symposium/)，Methods、ITT/mITT、KM和TRAE段与项目数据一致。ITT RFS HR0.58、mITT0.51不可互换；安全集755/380不等于ITT每臂人数。现有未获批、OS未成熟和数据截止日未披露限制保留合理。未核NEJM全文。 |
| CRC终止 | 打开[2026-08-28 SEC原始披露](https://www.sec.gov/Archives/edgar/data/1776985/000177698526000061/a991260828_bntxxcrcxenxfin.htm)。确认DSMB新建议及终止决定、既往无效性界值、未给OS数值方向、PDAC继续。主结论准确。注册表仍显示在研不招募且notes解释冲突；建议进一步用独立corporateStatus列，使筛选时不遗漏负证据，但不篡改原始registryStatus。 |
| BNT111 | 独立打开ESMO1605MO完整两页摘要。184随机、94/46/44、组合ORR18.1%对历史10%均吻合；PFS/OS未显示有意义组间差异的限制准确。问题是输出丢arm/单位，见E2。 |
| LK101 | 独立打开1950RO两页摘要。26入组/25治疗/21疗效、4PR、ORR19%、两种随访时钟与选入疾病控制人群均已准确分开；免疫可评n未知没有凭空填25。给药措辞见E3。 |
| EVM16 | 打开[企业授权原始披露](https://www.eqs-news.com/news/press-release/aacr-2026-evm16-first-in-human-data-demonstrate-a-favorable-safety-profile-robust-immunogenicity-and-promising-preliminary-efficacy/a4988ebd-621e-46a9-a33f-4b7bd071b2d4_en)，核验截止2025-12-07、n9、8/9免疫、1确认PR与2SD。现版本未把免疫应答写成ORR，正确。未取得会议海报全文。 |
| WGc-043 | 原站索引完整摘要/表支持5入组、4可评/AE表、2CR，ORR/DCR50%，不能以5为比例分母。整项截止日错误见E4。 |
| RNA机制 | 独立打开[CAR-T载体PubMed摘要](https://pubmed.ncbi.nlm.nih.gov/42587055/)及[CAR髓系细胞摘要](https://pubmed.ncbi.nlm.nih.gov/41880522/)，机制与临床前范围吻合，均确有勘误链接。现有勘误未读披露合理，不应据此宣称人体获益或安全性。未独立审查全部circRNA/saRNA全文和勘误。 |

## 覆盖、重复与交付物一致性

- 65条NCT按唯一ID分开，多试验同项目不是重复项目；同一试验ITT/mITT、历次PDAC更新是分析更新，不是新增患者群。现有计数说明能避免把16个更新当16项独立试验。
- Endpoints表有47条，Evidence有16条、Trials有65条的总体组织与JSON一致；本审稿只做内容抽查，不复述为重新完成所有公式/视觉验证。已具体读取上述单元格及Programs、Trials有关行。
- LY01620、ZY008已在coverageNotes和缺口中保存，不能把30个有NCT归一名当全部已知管线；全文明确不是全球穷尽清单，因此未将其判作虚假覆盖率。后续最好有包含非NCT项目的独立Program表，避免管线筛选漏掉已有线索。
- BNT116 WCLC2026数值仍欠原始摘要；报告公开此缺口，SEC仅给定性临床活动描述，现阶段不应补估pCR/MPR。最新临床进展已不等于“全面穷尽”；应保留检索边界和待核事项。
- 没有发现跨试验优劣排名；未披露数值未被填0。试验注册人数与结果n分层整体正确。上述E1/E2说明“同源生成”本身不能保证生成内容语义正确。

## 使用决定

USE: no

不愿把该候选SHA直接作为最终版交给BD。先修复E1、E2，并尽量同时处理E3–E5；生成后的JSON、报告、Excel需按本报告实例回查。修复后可重新独立判断，不能将本次no改写为既往已通过。

## 修订候选复核：7e114e87ee1bfa2b9df1fc00d398229abc5f1f62

复核日期：2026-11-10。独立原生 Astra 代理复核，未调用Claude。开始复核时确认HEAD等于上述SHA且工作区干净；以下追加不改变前一候选的USE no记录。未修改产品文件。本轮复用上文实际独立核验的原始来源，针对修订内容回查，没有声称重新通读全部论文或重新完成UI视觉验收。

### E1–E5关闭验证

| 原问题 | 当前实际交付物检查 | 结果 |
|---|---|---|
| E1 YKYY031公司错误 | JSON的NCT07631793公司、Excel `Programs!B31`均为“悦康药业 / Youcare”；注册申办方法人仍保留Beijing Youcare Kechuang Pharmaceutical Technology Co., Ltd.。报告质量修订段中的“远大医药”仅用于说明被纠正的历史错误，并非当前归属。 | 关闭 |
| E2 结果语义丢失 | JSON16条control均为具体对照/研究设计/未公开的说明，不再统一“未披露”。Excel `Evidence!G5`为安慰剂+pembrolizumab、`G8`为watchful waiting；`G10/K10`保留BNT111历史10%主假设，以及三臂18.1%/17.4%/13.6%、n94/46/44、PFS/OS月。完整报告相同结果文字已更新，原始endpoints的数值、CI和人数没有变化。 | 关闭 |
| E3 LK101给药 | NCT05886439及Excel `Evidence!F15`为mRNA转染DC皮内注射；NCT06054932明确给药途径待逐方案核验。报告两条试验分别呈现，没有向另一个方案推定皮内途径。 | 关闭 |
| E4 WGc-043日期 | JSON `dataCutoff`为null；`observationDates`分别保存CR观察日2026-01-11与摘要更新日2026-05-12。Excel `Evidence!M14`为未披露，O14说明两日期均非已披露的全局临床截止日；完整报告截止日“未明确披露”，观察日期仍可见。 | 关闭 |
| E5 CureVac集团 | CureVac相关试验保留历史申办方，增加currentGroup及S-BNT-Q3；Excel `Programs!I11`标BioNTech并明确具体资产后续开发未确认，报告说明收购不推定历史资产继续开发。 | 关闭 |

### 交叉检查结果

- 只读重新打开当前实际XLSX，11个sheet存在，Trials65、Evidence16、Endpoints47、Sources102。未发现Excel错误类型单元格。
- 逐条对比当前JSON与旧候选16条证据的endpoints、nRaw、safetyRaw、followUpRaw：无差异，说明本次修订没有意外改动已核临床数字及分析人数。
- 逐条核对Excel Evidence的方案、对照和结果与当前JSON：全部实质一致。唯一原始值差异是ITI-5000无结果的JSON空字符串在Excel中存为空单元格，不是数字丢失；其“非随机首人体，无结果”对照说明保留。
- 当前47条Excel Endpoints的指标值和治疗臂与JSON对应，无错配。trials、evidence、sources均无重复ID；上述条目及technology、bd所引用的来源ID均存在。
- 图表生成已从E-V940-III-ITT/E-V940-III-SENS端点及安全数据派生；当前ITT/mITT和TRAE值保持一致，并增加安全集755/380说明。本项核对的是生成逻辑及数据，不替代浏览器视觉验收。
- reviewFixes已经改为本次五个具体修订，并附相应原始来源链接。原有访问限制、尚未取得全文及非全球穷尽等边界仍保留，没有把修订说明写成未知事实已经核实。

### 当前使用决定

剩余Critical：0。剩余Major：0。原E1–E5均关闭；未发现本轮引入的新决策级证据错误。

USE: yes

愿意把候选`7e114e87ee1bfa2b9df1fc00d398229abc5f1f62`直接交给BD作为截至2026-11-10的公开资料研究与合作线索材料。此结论包含材料已明确列出的资料缺口与非全球穷尽范围，不将其解释为完整资产尽调、监管确认或商业授权证明。
