import type { PrismaClient } from '@prisma/client';
import { compareProjectMarker, compareProjectTitle } from '../src/compare.js';

const dailyComparisonGuide = {
    title: '日常消费品｜单位价格与性价比复核', topics: ['shopping', 'consumer'],
    body: `# 日常消费品｜单位价格与性价比复核

## 先确认买的是同一种东西
食品、饮料、家庭日化按品类、品牌、系列、口味或配方、单件净含量、包装件数核对。纯牛奶不和乳饮料混比，洗衣液不和柔顺剂混比；抽纸还需注明层数、抽数与尺寸。平台标题含“整箱”“大包装”不能代替规格字段。

## 统一单位
| 商品 | 填写单件量 | 件数 | 总量 | 参考单价 |
| --- | --- | --- | --- | --- |
| 瓶装水 | 550 ml | 24 | 13.2 L | 确认到手价 ÷ 13.2，每升 |
| 大米 | 5 kg | 1 | 5 kg | 确认到手价 ÷ 5，每公斤 |
| 洗衣液 | 2 kg | 2 | 4 kg | 确认到手价 ÷ 4，每公斤 |
| 独立计件商品 | 1 piece | 10 | 10 件 | 确认到手价 ÷ 10，每件 |

毫升与升可以换算，克与公斤可以换算；质量与体积不可自行换算。包装数量或单件量不同的商品只作参考，不进入同规格严格前三。比较纸品时要在配置中保持相同层数、抽数和尺寸，不能只看“每包”价格。

## 到手价与优惠
商品价、运费、税费、服务费、优惠券、补贴都需核录。明确没有费用或优惠请填 0；未知请留空。系统不会默认为包邮或自动扣掉会员、拼团、满减、旧客券等有条件优惠。若优惠资格尚未满足，记录未优惠的可确认价格，条件写入备注。

## 食品与日期
记录实际到期日。过期食品不进入推荐，临期与保质期未知应人工核对，剩余时间应覆盖预计消费周期。合成演示的保质期不能代表平台真实库存；真实商品以包装、批次与卖家承诺为准。生鲜冷链配送条件、过敏原、配料和储存方式需另行复核。

## 性价比怎样得出
同币种同规格候选按价格 40%、质量口碑 25%、卖家售后 15%、配送 10%、数据完整度 10%综合排序，另可切换价格优先或质量优先。单位价格用于复核包装量是否值得，平台热度不等于质量。没有评价的数据保持未知，并降低置信度。旧报价、人工报价与无法核实的字段均显示风险；推荐分不是品质保证，也不代表全网最低。

## 跳转与复核
演示商品提供对应平台的搜索入口，不能伪造在售商品链接。真实报价提供 HTTPS 原平台链接，在新标签页打开；不接受与所选平台不符、带账号凭据或危险协议的地址。短链接请先在平台内打开并复制完整商品链接。平台可能要求登录或 App 才能查看，这是平台访问要求，不是系统已读取商品数据。

| 复核项 | 本次记录 |
| --- | --- |
| 同品类、同口味/配方、同规格 | |
| 单件量、件数、换算单位 | |
| 全部费用和优惠资格 | |
| 到期日、预计用完日期 | |
| 店铺、发票、退货与冷链 | |
| 原页面最终结算价与复核时间 | |`,
} as const;

export const compareDocuments = [
  {
    title: '项目说明与使用流程', topics: ['shopping', 'price-comparison'],
    body: `# 项目说明与使用流程

## 这次要买什么
先写商品名称、品牌、准确型号、容量或内存、地区版本、成色、保修和预算。不同容量、新旧成色或套装不能只按标题混在一起比较。

## 一次完整比价
1. 从项目首页进入“开始比价”。首次可选演示模式验证流程，演示报价均为合成数据，不能作为购买价格。
2. 填写品牌、型号、核心配置、必须满足的条件、预算、配送城市和到货时间；在条件确认区检查后执行搜索。
3. 实时报价模式仅调用已配置的官方接口，并合并自己导入的报价。没有授权的平台会显示不可自动搜索；可使用手动录入、CSV 或 JSON。
4. 查看完全匹配商品、到手价是否确认、数据时间、前三推荐理由和风险。不足三件时不补入参数不同的商品。
5. 收藏候选商品并填写复核备注；历史记录保留本次报价快照，修改导入数据后需要重新搜索。
6. 购买前打开原平台页面复核库存、优惠资格、配送和售后。系统不下单，也不保存支付信息。

## 三组演示
| 场景 | 要验证的规则 |
| --- | --- |
| iPhone 16 256GB 全新 | 不同容量、未知费用与低样本口碑分开处理 |
| 笔记本电脑 | 同系列不同内存、硬盘不能进入严格前三 |
| 同型号新品与二手 | 成色隔离，翻新与二手单独标记 |

## 个人记录与权限
项目授权只决定能否进入工作台；报价导入、历史和收藏仍按当前账号隔离。管理员不会通过工作台看到其他账号的私人比价记录。管理员可在现有资料管理中编辑这些说明文档。`,
  },
  {
    title: '商品参数标准化规则', topics: ['consumer', 'python'],
    body: `# 商品参数标准化规则

## 商品身份字段
| 字段 | 填写方式 | 容易混淆之处 |
| --- | --- | --- |
| 品牌 | 使用明确品牌名称 | 店铺品牌不等于商品品牌 |
| 型号 | 准确型号及系列后缀 | Pro、Max、年份与代次不能省略 |
| 配置 | storage、memory、version、region、warranty、bundle 等键 | 256GB 与 512GB，16GB 与 32GB 必须分开 |
| 成色 | new、used、refurbished、unknown | 全新、二手、翻新不是同一组 |
| 配件与保修 | 在配置中填清楚 | 单机、套装、官方保修与店保不同 |

## 匹配等级
**完全匹配**要求已填写的品牌、型号、核心配置和成色逐项得到数据支持；缺字段不能当作已经满足。**参数接近**表示核心型号相同，但配置有差异或不能确认。**相似商品**只供参考，不进入严格推荐。标题相似度只帮助识别参考候选，不能覆盖硬参数差异。

## 导入前检查
- 单位统一：容量用 GB/TB，内存用 GB；不要把运行内存当作存储容量。
- 不知道的参数留空，不能猜测。明确无费用可填 0，未知费用必须留空。
- 商品链接填写原平台 HTTP(S) 地址；粘贴链接不会自动访问私人页面或抓取商品。
- 优惠与商品基础信息分别记录；更正参数后重新运行比价，旧快照仍保留。

## 边界
首版采用确定性参数校验，不承诺从任意自然语言准确识别所有型号。服饰尺码、非标定制、组合套餐等不属于首版严格匹配范围。必须满足条件若无法由报价字段核实，应人工复核并暂不视作已确认。`,
  },
  {
    title: '到手价计算规则', topics: ['shopping', 'consumer'],
    body: `# 到手价计算规则

## 计算口径
到手价 = 商品价 - 已确认优惠券 - 已确认补贴 + 运费 + 税费 + 服务费。

只有费用与优惠条件可确认时才标记“确认到手价”。需要领取、会员资格、凑单或旧机抵扣的优惠，不能默认人人可用。未知运费、税费和服务费必须留空；不要用 0 代替未知。费用不全的报价显示预计或待确认，并在推荐中说明风险。

| 价格字段 | 例子 | 应怎样处理 |
| --- | --- | --- |
| 商品价 | 平台所示单件价 | 必填，不能为负数 |
| 运费 | 明确包邮 | 可填 0；未说明则留空 |
| 税费 | 跨境预估关税 | 未确认则留空，不当作免税 |
| 优惠券/补贴 | 条件已满足并确认 | 只记录已确认金额 |
| 服务费 | 安装或平台服务费 | 明确无此费用可填 0 |

## 币种与时间
不同币种分别比较。首版不会把美元数字直接与人民币数字排序，也不会暗中使用未知汇率。eBay 报价保留原币种；需要人民币换算时，应人工核实汇率及兑换费，再作为独立人工报价记录来源。

每条报价保留来源和采集/录入时间。历史快照表示当时信息，不表示当前仍可购买。库存、地区价和优惠会变化，购买前必须回原页面确认。

## 复核表
| 商品/链接 | 原价 | 优惠条件 | 运费 | 税费/服务费 | 币种 | 复核时间 |
| --- | --- | --- | --- | --- | --- | --- |
| | | | | | | |`,
  },
  {
    title: '口碑与热度分析规则', topics: ['consumer', 'price-comparison'],
    body: `# 口碑与热度分析规则

## 分开看四个维度
价格竞争力比较同币种、同配置候选的价格；质量口碑依据可取得的商品评分、好评率和样本量；平台热度使用同平台候选中的点赞、转发和销量作为辅助；数据完整度表示关键字段是否可核实。

平台店铺信用与商品评价分开保存。eBay seller feedbackPercentage 是卖家反馈，不能写成该商品好评率。没有真实评论文本时，系统不生成“续航好”“发热严重”等关键词结论。未知评价、点赞和转发留空，不当作零分。

## 初版综合权重
| 指标 | 权重 | 作用 |
| --- | --- | --- |
| 价格竞争力 | 40% | 同组到手价 |
| 质量口碑 | 25% | 评价质量与样本量 |
| 卖家与售后 | 15% | 卖家信用、退货政策 |
| 配送与履约 | 10% | 交付信息是否可用 |
| 数据完整度 | 10% | 已确认数据比例 |

缺失指标采用明确的保守处理并降低置信度，不把无评论直接判定为商品差。价格优先、质量优先可调整权重，但不改变型号、成色、预算等硬条件。

## 热度边界
不同平台的点赞、转发和销量统计口径不同，不能简单相加或跨平台比大小。首版没有时间序列时不展示“近期增长趋势”。热度不单独决定前三推荐。

## 人工评论记录
| 样本来源/日期 | 数量 | 正向提及 | 负向提及 | 样本不足/需复核 |
| --- | --- | --- | --- | --- |
| | | | | |
标注提及次数与样本范围；评论只是用户反馈，不能等同于经过验证的产品质量结论。`,
  },
  {
    title: '平台接入状态与数据边界', topics: ['automation', 'python'],
    body: `# 平台接入状态与数据边界

| 平台 | 首版自动能力 | 未接通时怎样使用 |
| --- | --- | --- |
| eBay | 配置官方 OAuth 后使用 Browse API 搜索与详情 | 手动、CSV、JSON |
| 京东 | 预留授权适配器，未承诺通用搜索权限 | 手动、CSV、JSON |
| 拼多多 | 预留多多进宝授权适配器 | 手动、CSV、JSON |
| 抖音 | 预留电商开放平台授权适配器 | 手动、CSV、JSON |
| 闲鱼 | 预留开放平台授权适配器，依账号实际权限 | 手动、CSV、JSON |

实际状态以工作台“平台状态”为准。接口失败只影响该平台，其余平台及人工报价继续返回；系统不把演示数据混入实时报价。

## 官方参考
- [eBay Browse 搜索](https://developer.ebay.com/api-docs/buy/browse/resources/item_summary/methods/search)
- [eBay 商品详情](https://developer.ebay.com/api-docs/buy/browse/resources/item/methods/getItem)
- [eBay client credentials OAuth](https://developer.ebay.com/api-docs/static/oauth-client-credentials-grant.html)
- [闲鱼开放平台](https://open.goofish.com/doc/)

配置密钥只保存在环境变量，不写入报价或前端。eBay 授权并不保证所有国家、类目、运费、税费和评论字段可得；缺失数据按未知处理。国内平台需要逐个平台核对开发者资质、获批 API 与适用范围，不使用逆向私人接口。

## 手动数据
导入时填写平台、原链接、价格币种、采集时间、核心参数、成色和可核实服务信息。仅粘贴链接不会获取报价，需补录参数。禁止把演示价格作为当前市场价转发。`,
  },
  {
    title: '比价结果人工复核清单', topics: ['shopping', 'consumer'],
    body: `# 比价结果人工复核清单

## 下单前
- [ ] 品牌、准确型号、代次和地区版本相同。
- [ ] 容量、运行内存、套装和配件相同。
- [ ] 全新、二手、翻新成色与需求一致；二手瑕疵和维修历史已询问。
- [ ] 商品页面仍可访问、仍在售且有库存。
- [ ] 优惠券资格、凑单要求、会员要求已核实。
- [ ] 到货城市对应的运费、税费、安装费、服务费已确认。
- [ ] 保修责任方、发票、退换货时限和运费承担已确认。
- [ ] 评价样本量、评价时间与卖家信用没有混淆。
- [ ] 到货时间满足需要；跨境时考虑清关和退货成本。
- [ ] 已在原平台核对最终结算页金额，未向陌生私人账户付款。

## 留存决策
| 比价日期 | 需求/配置 | 候选链接 | 选择理由 | 未确认事项 | 最终复核人 |
| --- | --- | --- | --- | --- | --- |
| | | | | | |

## 购买后复盘（人工记录）
| 实际成交价/币种 | 实际到货日期 | 质量/售后反馈 | 与推荐差异 | 下次改进 |
| --- | --- | --- | --- | --- |
| | | | | |

该表是可编辑文档模板，首版不会自动获取订单、物流或支付信息，也不自动设置预算提醒。`,
  },
  {
    title: '隐私、授权与平台合规说明', topics: ['consumer', 'automation'],
    body: `# 隐私、授权与平台合规说明

## 保存什么
系统保存需求、配置、预算、城市、搜索快照、人工报价和收藏备注。不要填写家庭详细地址、身份证、银行卡、支付密码或平台登录 Cookie。项目文档按现有项目授权共享，个人报价和历史按账号隔离。

## 数据路径
浏览器只访问现有 Node API。Node 校验登录、密码状态及项目授权，再通过本机内部令牌调用 Python。Python 默认只监听 127.0.0.1，不应直接暴露到局域网。比价数据库独立于主 Prisma 数据库，备份时两者均应纳入。

## 平台边界
仅使用官方已授权 API，或由用户在有权使用的前提下导入资料。不绕过平台登录、验证码、风控或访问限制，不读取他人私人页面，不保存平台密钥到商品表，不自动下单或付款。

## 使用与删除
收藏和人工报价可以在工作台移除；已经完成的历史快照不会因人工报价修改而被悄悄覆盖。设备交接或删除账号前，应由管理员按备份与数据保留要求处理两个数据库；不要把删除收藏误认为已删除全部历史。

## 输出边界
推荐是基于当前取得字段的辅助判断，不保证最低全网价、正品、质量或库存。未知信息必须明示，演示数据必须标识。购买前由使用者复核原页面价格、配送、优惠和售后。

## 管理维护清单
- 定期更新依赖并检查访问授权。
- 密钥轮换后同时重启 Node 和 Python；不在日志打印令牌和请求头。
- 限制本地数据库与备份文件访问，避免同步到公开仓库。
- 新增平台前核对其授权范围、字段含义和数据保留要求。`,
  },
  dailyComparisonGuide,
] as const;

export async function seedCompare(db: PrismaClient) {
  return db.$transaction(async tx => {
    let created = 0;
    const marked = await tx.content.findMany({ where: { description: { contains: compareProjectMarker } } });
    if (marked.length > 1) throw new Error('Price comparison project marker is duplicated.');
    let project = marked[0];
    if (project && (!project.isProject || project.type !== 'folder' || project.scene !== 'life'))
      throw new Error('Price comparison marker belongs to incompatible content.');
    if (project) {
      const parent = project.parentId ? await tx.content.findUnique({ where: { id: project.parentId } }) : null;
      if (!parent || parent.parentId !== null || parent.isProject || parent.type !== 'folder' || parent.scene !== 'life')
        throw new Error('Price comparison project must belong directly to the life scene root.');
    } else {
      const roots = await tx.content.findMany({ where: { title: '生活场景', scene: 'life', type: 'folder', parentId: null, isProject: false } });
      if (roots.length > 1) throw new Error('Life scene root is ambiguous.');
      const root = roots[0] ?? await tx.content.create({ data: { title: '生活场景', scene: 'life', type: 'folder', sortOrder: 2 } });
      if (!roots.length) created++;
      if (await tx.content.findFirst({ where: { title: compareProjectTitle, parentId: root.id } }))
        throw new Error('An unmarked content item already uses the price comparison project title.');
      project = await tx.content.create({ data: { title: compareProjectTitle, type: 'folder', isProject: true, scene: 'life', parentId: root.id,
        topics: ['长期性', 'shopping', 'price-comparison'], sortOrder: 8,
        description: `${compareProjectMarker}\n\n明确需求，核对同款参数，比较到手价与口碑。真实数据、人工报价和演示数据分开记录。` } });
      created++;
    }
    for (const [index, doc] of compareDocuments.entries()) {
      const marker = `<!-- PRICE_COMPARE_DOC:${index + 1} -->`;
      const existing = await tx.content.findMany({ where: { parentId: project.id, description: { contains: marker } } });
      if (existing.length > 1) throw new Error(`Price comparison document ${index + 1} marker is duplicated.`);
      if (existing.length) continue;
      // A document may have had its marker removed while being edited; preserve it by title too.
      if (await tx.content.findFirst({ where: { parentId: project.id, title: doc.title } })) continue;
      await tx.content.create({ data: { title: doc.title, type: 'text', scene: 'life', parentId: project.id, sortOrder: index,
        topics: [...doc.topics], description: `${marker}\n\n${doc.body}` } });
      created++;
    }
    return { projectId: project.id, created };
  }, { timeout: 15_000 });
}
