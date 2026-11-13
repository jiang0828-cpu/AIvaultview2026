# 消费支出｜跨平台比价：实现与验收记录

实现目标、标准和执行提示词位于 `.marathon/price-compare/`。

## 交付范围

- 生活场景中的独立项目与八份使用/规则文档。
- React 工作台、Node 授权代理、仅本机监听的 FastAPI 服务。
- 六组明确标为合成数据的演示，包含手机、电脑、新旧商品隔离、燕麦片、纯牛奶和洗衣液；人工报价、CSV/JSON 导入、历史和收藏。
- 日常消费品按品牌、系列、口味/配方、包装量和成色严格匹配，计算每 kg/L/件到手单价；过期及到货时过期商品排除，临期、未知保质期和陈旧报价提示复核。
- 平台搜索快捷入口常驻；演示报价打开平台搜索，人工/API 报价可打开对应平台原商品页。仅接受平台官方 HTTPS 域名，拒绝错平台、凭据及危险协议链接。
- eBay 官方接口适配器；国内平台在未获授权时保留人工导入。

## 验收记录

- `npm run db:seed:compare` 本轮新增第 8 份日常消费品文档，连续执行第二次新增 0 条，保留原有编辑；项目 ID 为 217。
- `npm run test:compare`：73 项 Python 测试通过；`npm run lint:compare` 与 `npm run typecheck:compare` 通过。
- `npm test`：后端 84 项、前端 59 项全部通过，其中 Node 比价接口/seed 9 项、前端比价模型 8 项。
- `npm run typecheck`、`npm run lint`、`npm run build` 通过。构建仍有现有大 chunk 提示，Python 有 Starlette/httpx 弃用提示。
- `node scripts/verify-compare-browser.mjs` 实际登录局域网服务并验证三组日常演示各返回三条严格推荐，单位价分别按 kg 或 L 展示，平台链接标为搜索。
- 通过页面收藏和手工导入牛奶报价：250ml × 12，确认总价 48 元，真实/导入搜索返回单位价 16 元/L；原商品页链接点击创建新标签页，刷新后包装字段保持。
- 390px 与 1440px 视口的 `scrollWidth` 分别为 390、1440；截图人工检查无明显重叠，详细表格独立横向滚动。截图位于 `output/playwright/compare-v2-desktop.png`、`compare-v2-390.png`、`compare-v2-1440.png`。
- 验收账号及其搜索、报价和收藏数据已清理；Python 仅监听 `127.0.0.1:8001`，前端保留局域网入口。

两名独立 reviewer 均给出 `USE: yes`，报告为 `.marathon/price-compare/audits/daily-review.md` 和 `daily-final-review.md`。本轮为同模型的工作区独立复核，未固定干净提交 SHA，未声称通过 Marathon 严格双模型发布门禁；没有提交或覆盖其他任务改动。

真实 eBay 结果需要填写官方 OAuth 环境变量；京东、拼多多、抖音和闲鱼在未配置授权时显示不可用并提供人工导入入口。演示数据已明确标注为合成数据。

性价比分结合可确认价格、口碑样本、卖家售后、配送与数据完整度，不能保证全网最低价或商品质量。跳转验收确认目标地址与新标签页行为，不代表已验证平台商品存在、库存或实际可购买；下单前仍应核对平台页面。
