# 消费支出｜跨平台比价

## 2026-11-12 更新：日常消费品

工作台增加食品、饮料与家庭日化。录入“每件净含量 × 包装件数”后按 kg/L/件换算单价：例如 250 ml × 12 盒牛奶共 3 L，确认到手价 48 元时为 16 元/L。不同质量和体积单位不混算，包装量不符的商品只作参考；口味、配方、纸品层数等仍需填写在配置中核对。

新增三组明确标记的合成演示，可直接试验单位换算和低价小包装过滤。演示的“平台搜索”打开对应平台搜索页，真实人工报价的“原商品页”打开所选平台完整 HTTPS 链接；平台可能要求登录或使用 App。系统不把平台搜索结果自动当成已经核实的商品。

日常消费品的费用字段仍需明确录入，未知运费、服务费、税费或优惠不按 0 计算。可记录食品到期日，过期商品排除，临期、日期未知和较旧报价显示风险。单位价格和推荐分是辅助复核依据，无法保证全网最低价或品质。

## 安装与升级

需要 Node 22.12+、Python 3.11+ 和现有 VaultView 账号。首次安装仍先按根 README 初始化；已有库只执行以下命令，不运行全库 seed，不覆盖既有内容：

```powershell
npm install
npm run compare:install
npm run db:seed:compare
npm run dev
```

`compare:install` 在 `python/.venv` 建立隔离环境。若系统 Python 命令不同，可先设置 `PYTHON_BIN`。前端地址沿用 `.env` 中的 `FRONTEND_ORIGIN`，在“生活场景”进入“消费支出｜跨平台比价”，再点击“开始比价”。访问者需管理员在“用户与授权”授予该项目，账号权限不会因 seed 自动扩张。

```powershell
npm run dev:compare
npm run test:compare
npm run lint:compare
npm run typecheck:compare
npm test
npm run typecheck
npm run lint
npm run build
```

`npm run dev` 同时启动三个服务；也可分别启动 `dev:frontend`、`dev:backend`、`dev:compare`。`COMPARE_PORT` 默认 8001，Node 与 Python 必须一致。Python 固定绑定 `127.0.0.1`，不要通过局域网或反向代理公开该端口。

## 数据与权限

浏览器只请求已登录的 Node `/api/compare`；每次调用都会重新核对项目授权，Node 从会话提供用户身份。Python 请求需要内部令牌和可信用户、项目标识，所有历史、导入和收藏均限定在这两个标识下。`COMPARE_INTERNAL_TOKEN` 可提供独立的 32 字符以上密钥；留空时两服务使用 `JWT_SECRET` 派生专用令牌。不要把任何密钥写入前端环境变量、数据表或日志。

Python 默认使用 `python/data/price_compare.db`，可按 Python 配置通过 `COMPARE_DATABASE_URL` 指定 SQLite 文件。主内容仍存 Prisma SQLite，不改现有 schema。备份时停止三个服务，再复制主数据库、`backend/media`、Python 数据库以及私有 `.env`；备份应保存在非公开目录。恢复时先恢复文件再启动；如果轮换 JWT 或内部令牌，重启 Node 和 Python 保持一致。

## 真实数据和演示

演示模式为合成 fixture，验证手机、电脑配置与新品/二手隔离，不代表真实现价和库存。实际报价模式只使用已授权官方接口及自己导入的报价。京东、拼多多、抖音、闲鱼首版未实现未经验证的自动搜索授权；对应状态明确提示人工导入。粘贴链接不会自动抓取页面，需补录价格、配置、运费、税费和来源时间。

eBay 使用官方 OAuth client credentials 与 Browse API。配置 `EBAY_CLIENT_ID`、`EBAY_CLIENT_SECRET`、`EBAY_MARKETPLACE_ID`，重启 Python 后才能自动搜索。账号仍需实际获准使用相关 API；代码集成不等于平台授权已通过。平台故障单独降级，不阻断其他来源。官方文档：[Browse API](https://developer.ebay.com/develop/api/buy/browse_api)、[OAuth](https://developer.ebay.com/api-docs/static/oauth-client-credentials-grant.html)。

外币不自动换算；默认 CNY 推荐不混入 USD 商品。平台卖家好评与商品评价分开处理；没有评论文本时不会生成“续航好”等虚构摘要。点赞、转发等热度只在同平台内参考，不能证明商品质量。

## 复核规则

推荐最多三条，仅完全匹配进入候选；型号、要求配置、成色或硬条件不同的商品不会补位。未知运费、税费或条件优惠不按 0 计算，展示预计或不完整价格，并写明缺口。导入属于人工提供，价格和参数真实性需要自行核对；保存的历史与收藏是当时的快照，不会因后续修改报价而改写。

购买前打开原链接复核规格、版本、保修、总费用、库存、优惠资格、配送和退换货条款。系统不自动下单，不保存支付或银行卡信息。
