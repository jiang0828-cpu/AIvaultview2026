import type { PrismaClient } from '@prisma/client';
import { investmentMarker, investmentTitle } from '../src/investment.js';

const syncNotesMarker = '<!-- INVESTMENT_SYNC_NOTES -->';
const syncNotes = `\n\n${syncNotesMarker}
## 自动更新与数据授权（2026-11-13）

本版已加入后台同步、页面自动刷新和官方入口可达性检查。真实行情需要管理员在本机私有.env配置有效的TUSHARE_TOKEN，不把密钥写入文档、聊天或产品档案。fund_nav、fund_daily、rt_etf_k分别需要相应数据权限；打开配置开关不会购买或授予权限。

默认每15分钟检查已跟踪基金/ETF，页面每60秒重算当前视图。获得ETF盘中权限后设置INVESTMENT_REALTIME_ENABLED=true，交易时段按60秒检查盘中数据；基金净值按实际披露更新，不作为逐笔实时行情。交易日历、净值数据日期与源时间共同决定有效性，取数失败、过期、价格冲突或异常跳变会暂停自动候选。

产品档案可设置dataCode，例如510300.SH、159919.SZ；场外基金需核对完整数据代码。dataCode必须与实际产品代码一致。autoUpdate默认为true；market字段由服务维护，不得手工导入。研究资料日期不会因新行情而自动刷新，过期的风险、费用或持仓材料仍需复核。

官网每6小时检查一次可达性，不表示产品可购、本人具备资格或费率最优。购买仍由本人进入平台确认。

收益页自动重算已录真实账本，并另列最新行情参考估值。未接入券商账户，不能凭行情推断真实成交、分红或资金流；参考估值不写入TWR/XIRR。实际账户记录仍需本人对账。

服务运行时约每30秒检查授权配置变化；无需把密钥传给浏览器。电脑需开机联网，重启后运行npm run lan；关闭网页不停止后台同步。`;

export const investmentDocuments = [
  { title: '01 资金用途与账户对账', body: `## 先保护确定需要的钱

账户只填写本人数据；初始真实账户留空，演示与真实账本分开。现金指尚未投资的可支配现金，不包含持仓市值。应急金、一年内支出、第二至第三年支出分别填写，避免重复预留。负债预留按本次希望保护的还款额录入；若录入全部负债，计算会更保守。

可用于新增投资的现金 = max(0, 现金 − 应急金 − 一年内支出 − 第二至第三年支出 − 负债预留)。每月新增资金只记录计划，不提前加入现金。持仓金额 = 份额 × 单位价格；净资产 = 现金 + 持仓 − 负债预留。当前页面不是完整会计资产负债表。

期限填写月数，风险等级1至5由本人根据已完成的正规适当性评估填写，系统不代替机构评估。可承担亏损金额与历史回撤上限均是研究约束，不能限制实际亏损。未设置亏损承受金额、资金预留不足、持仓估值过期时暂停新候选。

## 月度对账

| 日期 | 账户现金 | 持仓总值 | 负债预留 | 与实际账户差额 | 差异原因 |
| --- | --- | --- | --- | --- | --- |
| | | | | | |

先核对现金，再核对代码、份额、净值日期、复权和分红。成交记录是复核凭证，不自动改写持仓或现金；更新持仓快照后再对账。` },
  { title: '02 产品档案与数据口径', body: `## 分类建档

股票、ETF、主动权益基金、债券基金、直接债券、货币基金使用不同分类。peer填写跟踪指数或明确的同类组，不能用“热门”作为同类组。A/C份额各用自己的产品代码，shareClass区分份额类型。股票和直接债券首版仅研究观察，不参与自动候选。

每条档案记录sourceName、sourceUrl、asOf（数据日）、publishedAt（实际披露）、fetchedAt（获取时间，后两项含时区）。晚于获取时间的披露不得入库。数据超过7天、关键字段缺失或交易状态异常会暂停候选；这是一项保守的资料复核规则，不代表每项指标都必须每天重新披露。

## 指标边界

annualReturn与drawdown都以百分数录入，12表示12%。annualReturn为注明区间的历史收益，不作为上涨概率。债券基金补充duration和credit；主动权益基金补充managerTenure；ETF补充trackingError、premium和turnover。持仓权重与行业权重使用百分比，合计不超过100%，未披露部分保持未知。

Tushare文档：https://tushare.pro/document/2?doc_id=19 。首版仅导入已获得使用权限的数据，不代购积分、不默认调用任何付费接口。公告可到巨潮 https://www.cninfo.com.cn/ 及交易所核对；不同来源冲突时先人工核实，不让AI填补数字。` },
  { title: '03 基金与ETF同类比较', body: `## 比较顺序

先选资产类别，再选同类组/跟踪指数，再勾选产品。不同风险类别与不同基准不做统一排名；同指数ETF也需核对跟踪方式、市场、流动性和折溢价。上交所ETF资料：https://www.sse.com.cn/assortment/fund/etf/home/ 。

费用静态估算 = 假设本金 × [（管理费+托管费+销售服务费）×持有月数/12+申购费+赎回费]。所有费率按百分数填写，申赎费应对应假设的持有期限与渠道。真实费率通常阶梯分档，静态估算不是实际扣费指令。

净值通常已扣除基金层费用。收益复盘使用账户真实净值，不再次扣管理费、托管费或销售服务费。投资者申赎、佣金和其他费用则按真实账户价值处理。代码相同才是同份额产品；跨渠道比较必须对应相同代码、金额与持有期限。

| 核对项 | ETF | 主动权益 | 债券基金 |
| --- | --- | --- | --- |
| 核心风险 | 指数、折溢价、流动性 | 风格、经理与行业 | 久期、信用、杠杆 |
| 历史资料 | 跟踪误差/回撤 | 经理任期/同类回撤 | 回撤/久期/信用 |
| 费用 | 基金层与交易费 | 基金层与申赎费 | 基金层与申赎费 |` },
  { title: '04 候选解释与组合约束', body: `## 可选择今天无需操作

候选最多3项，不凑数。先判断资金计划，再检查资料完整、日期、风险等级、期限、历史回撤、ETF折溢价，再在同类组内排序。规则分只用于该同类组，不跨股票、债券、权益基金比较；历史回撤不是未来最大亏损。

每项显示入选依据、收益逻辑、主要风险、重复持仓、执行条件、重新评估条件和来源。收益逻辑、风险和重估条件均需导入可靠资料；缺失则不生成候选。首版采用确定性规则，不向外部AI发送账户数据，也不虚构公告摘要。

压力情景比例取max(历史回撤，权益类30%或其他10%)。现有持仓先占用压力亏损预算，未建档持仓按100%损失保守预留；再用剩余可承受亏损金额÷情景比例得到研究上界，并受新增可用现金限制。研究上界不是建议买入量；不同候选共享同一资金与风险预算，不能相加。真实亏损可能超过压力情景。

组合检查使用已披露行业权重与前十大成分的最小权重交集。同指数产品会提示重复，但缺少底层持仓时不能断言不存在重叠。穿透结构过期、未披露权重与衍生品暴露需要人工补充。

## 决策记录模板

| 日期 | 产品 | 为什么研究 | 可能亏损 | 资金期限 | 重新评估事件 | 本次决定 |
| --- | --- | --- | --- | --- | --- | --- |
| | | | | | | |` },
  { title: '05 购买渠道与执行复核', body: `## 研究后由本人完成交易

本工作台不下单、不读取证券账号、不保存支付信息。基金可进入天天基金官方 https://www.1234567.com.cn/ 查询，或使用本人已开户的基金公司直销。股票和场内ETF复制代码，进入已开户券商的官方入口自行确认。银行债券等通过本人合资格账户查询。

交易所和中债链接是研究参考，不是直接购买页。天天基金是渠道入口，不表示本工作台已验证某只基金可售、费率最优或本人具备购买资格。链接打开后核对完整产品名称、市场、代码、份额类别、费用、限购、最小单位、交易时间、到账和退出条件。

中债收益率曲线研究入口：https://yield.chinabond.com.cn/ 。曲线收益率不是具体债券的可成交价格，票息不等于实际到期收益率。提前卖出可能产生亏损；信用评级不能替代发行人研究。

| 交易前复核 | 结果 |
| --- | --- |
| 同一代码与份额类别 | |
| 正规渠道与资格 | |
| 全部费用与持有期 | |
| 限购/停牌/流动性 | |
| 未来用钱和退出安排 | |
| 承受最坏情景 | |` },
  { title: '06 成交、现金流与收益复盘', body: `## 首版账本口径

成交记录包含买入、卖出、追加、提取、分红、费用和复盘备注；同key再次导入更新该笔记录。它用于复核，不自动改变资产快照。完整账户估值含现金与持仓，已反映真实费用。账户内部买卖不计外部现金流，分红留在账户内不计外部流入。

估值表每行date/value/flow。flow为该日由账户外部进入的净现金，流出为负；假设发生在日终。首行value是期初本金，flow填0。每个资金流日必须录入估值；日内多次流动无法用本口径精确处理，须补充逐笔前后估值。系统不从零散成交记录自动推断资金流。

投资盈亏=期末总值−期初总值−期间净流入。TWR逐段计算(本期日终价值−本期外部净流入)/上期价值并连乘。XIRR按实际日期、投资者视角资金流求年化根；多次现金流符号变化不报告唯一解。短期年化会放大偶然表现。

回撤从剔除外部流入影响的单位化收益曲线计算，仅覆盖已录估值日期；稀疏数据会低估期间回撤。交易费已在实际价值中反映时不重复扣除。

## 两个对照

fixedBenchmark为固定风险股债组合，simpleBenchmark为简单定投/定期再平衡对照，必须从同一初始本金、相同外部流量与日期、同费用口径获得影子账户价值。没有数据就显示待补，不生成理想化收益。复盘结果只检验已录入区间，不证明长期策略有效。` },
  { title: '07 数据导入与隐私', body: `## 导入方式

工作台提供产品、持仓、成交、账户估值四类CSV/JSON导入与可编辑模板。CSV中exposures与holdings需为JSON对象；时间含时区，例如2026-11-13T16:00:00+08:00。空值保留缺失，不把未知当0。同批重复代码、交易key或日期会拒绝；不同批同键更新记录。所有行校验成功后一次写入。

代码统一人民币资产；首版不做外汇、融资融券、期权及自动税费计算，不在字段中混入其他币种。导入前移除姓名、身份证、银行卡号、证券账户及无关个人信息。

每个登录账号的投资账户、持仓、产品研究、成交和估值均以user_id/project_id隔离。管理员登录查看的是自己账本，不自动读取其他账号账本。项目分享只提供公共资料，投资私有API拒绝分享身份。服务仅在本机回环地址监听，由现有Node会话代理。

数据保存在Python SQLite中，备份应连同主数据库与私有环境配置保存在非公开目录，不应上传公开仓库。项目管理员编辑通用文档不等于访问用户私有账户。` },
  { title: '08 策略检验与首版边界', body: `## 程序正确与策略有效分别验收

首版验证账户对账、数据来源、同类比较、费用口径、候选解释、购买跳转和真实账本复盘。不内置自动交易、保证盈利、外部AI推荐或全市场回测。允许导入两组对照影子账户，使用相同流入、日期与费用假设比较已发生区间。

开展历史回测前，必须补齐当时已披露的原始时间戳、退市/清盘历史产品、复权、基金分红、停牌/涨跌停、成交限制、费用与滑点。事后看到的产品清单不能直接用于过去的筛选。未经这些处理不展示“策略年化盈利”结论。

后续数据接入按官方授权逐项验证；AI只用于阅读和解释，所有数字、排序和收益由可检查代码计算。候选不是投资建议、上涨概率或盈利保证。市场风险与个人承受能力由本人结合专业机构核实。

## 每月复盘

| 项目 | 记录 |
| --- | --- |
| 净投入/净提取 | |
| 投资盈亏（扣真实费用后） | |
| TWR / XIRR与区间 | |
| 固定股债/简单策略对照 | |
| 有效与失效的判断 | |
| 下一次复核条件 | |` },
];

export async function seedInvestment(db: PrismaClient) {
  return db.$transaction(async tx => {
    const roots = await tx.content.findMany({ where: { type: 'folder', scene: 'life', parentId: null, isProject: false } });
    if (roots.length > 1) throw new Error('Life scene root is ambiguous');
    let root = roots[0];
    if (!root) root = await tx.content.create({ data: { title: '生活场景', type: 'folder', scene: 'life', sortOrder: 2 } });
    const marked = await tx.content.findMany({ where: { description: { contains: investmentMarker } } });
    if (marked.length > 1) throw new Error('Investment project marker is duplicated');
    let project = marked[0];
    if (project && (!project.isProject || project.type !== 'folder' || project.scene !== 'life' || project.parentId !== root.id)) throw new Error('Investment marker belongs to incompatible content');
    if (!project && await tx.content.findFirst({ where: { parentId: root.id, title: investmentTitle } })) throw new Error('An unmarked investment project already uses this title');
    if (!project) project = await tx.content.create({ data: { title: investmentTitle, type: 'folder', isProject: true, scene: 'life',
      parentId: root.id, topics: ['长期性', 'finance', 'investment'], sortOrder: 40,
      description: `${investmentMarker}\n个人投资决策工作台：账户总览、基金/ETF对比、候选解释、购买入口与收益复盘。` } });
    let created = 0;
    let updated = 0;
    for (const [index, doc] of investmentDocuments.entries()) {
      const marker = `<!-- INVESTMENT_DOC_${index + 1} -->`;
      const existingDoc = await tx.content.findFirst({ where: { parentId: project.id, OR: [{ description: { contains: marker } }, { title: doc.title }] } });
      if (!existingDoc) {
        await tx.content.create({ data: { title: doc.title, type: 'text', scene: 'life', parentId: project.id,
          topics: ['finance', 'investment'], sortOrder: index, description: `${marker}\n\n${doc.body}${index === 7 ? syncNotes : ''}` } });
        created++;
      } else if (index === 7 && !existingDoc.description.includes(syncNotesMarker)) {
        await tx.content.update({ where: { id: existingDoc.id }, data: { description: existingDoc.description + syncNotes } });
        updated++;
      }
    }
    return { projectId: project.id, documentsCreated: created, documentsUpdated: updated };
  }, { timeout: 15000 });
}
