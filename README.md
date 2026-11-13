# 观澜 / VaultView

面向个人、小团队和对外展示场景的内容空间。支持受控访问、30 天会话、六个固定场景模块、1–2 个 topics 标签、分层目录、视频、幻灯片、思维导图、长图、PDF、Markdown，以及独立管理员内容管理。原品牌“钥藏 / VaultFolio”已优化为“观澜 / VaultView”，保留“收藏”能力，同时突出浏览、展示和分享。

资料库的六个场景是：系统管理、工具方法、生活场景、事业工作、兴趣爱好、其他模块。场景是资料的一级归属；每个程序或资料有 1–2 个 topics，例如 `AI`、`business`、`food&drink`、`health`。已有资料迁移时会保留在“其他模块”，管理员可以在内容管理中调整场景和标签。

左侧目录的三角箭头只展开或折叠下级标题，文字按钮在右侧打开对应场景、项目、目录或资料，两个操作互不触发。“观天下”期次标题会打开所选期次；进入资料时，目录自动展开其上级并标记当前资料。

整体视觉以“江湖行者”为身份：墨色侧栏、朱红藏字印章、青绿水墨行旅题图与宋体标题，正文使用清晰的无衬线字体。中文名称统一为“观澜”，英文保持“VaultView”，印章依旧为“藏”字。首页与登录页展示“穷则独善其身，达则兼济天下”；这是化用说法，《孟子·尽心上》原文为“穷则独善其身，达则兼善天下”。题图保存在前端静态目录，不依赖外部图片服务或字体 CDN；设计与生成提示词见 [江湖风格说明](docs/jianghu-style.md)。

## 本地启动

需要 Node.js 22.12+（本项目在 Node.js 24 上验证）、npm，以及 Python 3.11+（比价服务）。无需安装数据库或 Docker。

```powershell
npm install
npm run setup
npm run compare:install
npm run dev
```

打开初始化输出的地址，默认 http://localhost:5173。API 默认监听 `127.0.0.1:3001`；首次初始化若端口被占用，会自动选择空闲端口并写入 `.env`。首次安装需要网络下载 npm 包以及用于生成演示视频的开发依赖；初始化后，演示内容与媒体均在本地。

`setup` 创建根目录 `.env`，随机生成首次管理员临时密码与 JWT 密钥，然后生成 Prisma Client、应用迁移、生成本地示例媒体并写入示例内容。已有 `.env` 不会被覆盖。

首次启动后端时，使用 `.env` 的 `ADMIN_USERNAME`（默认 `admin`）及 `ADMIN_PASSWORD_HASH` 或 `ADMIN_PASSWORD` 初始化唯一的首个管理员；哈希优先。登录后必须设置新密码并重新登录。引导标记存入数据库，之后修改环境变量不会重置账号，`SITE_PASSWORD` 已停用。不要提交或分享 `.env`，前端构建不包含密码或密钥。

## 账号与项目授权升级

已有资料库升级时先停止后端及其他写入进程，备份 `backend/prisma/dev.db`（自定义 `DATABASE_URL` 时使用实际路径）与 `backend/media/`，再运行：

```bash
npm install
npm run db:generate
npm run db:migrate
npm run dev
```

升级不运行 `setup`、`assets` 或全库 seed，避免改动已有资料。迁移保留内容 ID、媒体和历史日志，将原来按标题或标记识别的项目转为显式 `isProject`。旧共享密码会话全部失效。初始化仅在未完成账号引导时进行，不会随服务重启重复创建用户。

管理员进入“用户与授权”创建访问者或其他管理员，设置临时密码；访问者首次登录必须改密。选中访问者后勾选项目并单独保存授权。管理员可管理全部内容，访问者只能查看和下载已授权项目及全部后代资料。项目外散落资料仅管理员可见；内容管理中的“作为独立项目”决定授权边界，与标题无关，项目不可嵌套。

服务启动时还会按 `SHARE_USERNAME` / `SHARE_PASSWORD`（默认 `user` / `123456`）创建只读“分享浏览”账号，并按 `SHARE_PROJECTS`（默认 `爱的城堡`，可填项目名称或 ID，逗号分隔）首次授予项目访问权。该账号不能进入管理员页面、编辑内容或管理授权；管理员可在“用户与授权”中调整它的项目范围。已有分享账号的手工授权不会被服务重启覆盖；分享用户名若与已有普通账号冲突，服务会拒绝启动并要求修改配置。

账号可停用、修改角色和重置密码，不开放注册或邮件找回，也不提供账号永久删除。至少保留一名启用管理员。个人改密需要原密码；改密、重置、停用或角色变更撤销全部会话，退出登录只撤销当前会话。密码至少 12 个字符、不超过 72 个 UTF-8 字节，使用 bcrypt 保存。

授权变更和内容移动从下一次请求生效。媒体按本地文件引用建立归属索引，包含 Markdown、JSON、文学数据与 HLS 依赖；共享文件在至少一个归属项目获授权时可读，没有归属的文件仅管理员可读。前端在窗口重新获得焦点及每 30 秒刷新权限。已经下载到使用者设备上的资料无法远程收回；外部公开 URL 不受本系统保护。

自定义展示组件使用的配套文件须登记为内容的 `assetsJson`，可在内容管理的“附加本地资源”中逐行维护。迁移会为现有 mRNA 项目登记研究数据 JSON；其下引用的 Markdown、Excel 等文件继续按依赖解析。

账号与授权的接口回归位于 `backend/test/auth-access.test.ts`，使用独立临时 SQLite。浏览器验收脚本为 `scripts/auth-browser-fixtures.mjs`（建立临时验收账号、凭据仅写入忽略的 `output/playwright/`）和 `scripts/verify-auth-browser.mjs`（使用 Playwright CLI，读取 `FRONTEND_ORIGIN`）；先运行基础验收，再运行 `--media`、`--formats`。结束后务必运行 `node scripts/auth-browser-fixtures.mjs --cleanup` 清理临时账号和凭据。

## 日常命令

| 命令                                           | 用途                                   |
| ---------------------------------------------- | -------------------------------------- |
| `npm run dev`                                  | 同时启动前端、Node API 和 Python 比价服务 |
| `npm run dev:frontend` / `npm run dev:backend` | 分别启动                               |
| `npm run build`                                | TypeScript 检查并构建前后端            |
| `npm run typecheck`                            | 全项目类型检查                         |
| `npm run lint`                                 | ESLint 检查                            |
| `npm test`                                     | 在独立临时 SQLite 数据库上运行接口测试 |
| `npm run db:migrate`                           | 应用已有迁移                           |
| `npm run db:generate`                          | 重新生成 Prisma Client                 |
| `npm run db:seed`                              | 为全空数据库添加演示内容               |
| `npm run assets`                               | 重新生成本地 PNG、PDF、8 秒 MP4 样例   |
| `npm run db:seed:literature`                    | 仅建立文人墨客空间，保留已有资料和编辑 |
| `npm run db:seed:writers`                       | 补建文人墨客首批 100 位人物，不覆盖已有人物编辑 |
| `npm run db:seed:castle`                         | 仅建立“爱的城堡”及五个生活板块，保留已有资料和编辑 |
| `npm run start -w backend`                     | 运行已构建后端                         |

修改数据模型后，在开发环境使用 `npm exec -w backend -- dotenv -e ../.env -- prisma migrate dev --name your_change` 创建新迁移，再提交迁移文件。SQLite 数据文件位于 `backend/prisma/dev.db`，相对数据库路径以 Prisma schema 所在目录为基准。

## 文人墨客项目空间

“兴趣爱好”下新增 `项目05｜文人墨客｜世界文学人物志`。空间地址为 `/home?project=<项目 ID>`，ID 由定向初始化命令输出，不依赖固定数据库序号。

- 项目概览：专属书库封面、建设阶段、来源与资料统计。
- 文学索引：100 位人物、8 个文学地域入口；按姓名、原文名、作品检索，组合时代、文学类型、内容标签筛选，支持姓名/出生年代排序和每页 24 位分页。条件写入 URL，可刷新恢复。
- 人物档案：中文简介、生平与历史身份、代表作品及版本时间、时间线、文学特色、阅读建议、争议说明与逐条参考来源。详情地址为 `/home?project=<项目 ID>&view=index&writer=<人物 slug>`。
- 项目文档：7 份资料，包含两份用户提供 Word 的完整正文与原件下载。
- 建设路线：内容审校规范、技术风险、里程碑和后续验收要求。

首批人物为重新整理的中文档案，不是对原文学百家 97 条人物/251 条作品记录的自动迁移。分布为中国 30、古希腊 10、英国与爱尔兰 15、法国与法语文学 12、德语文学 8、俄语文学 10、日本 8、意大利 7。文学地域不等于现代国籍，历史身份在各档案中单列。

档案源数据位于 `backend/prisma/writers/`，由 Zod 校验字段完整性、1–2 个标签、作品说明、时间线、来源链接和支持范围。生卒无定论者保存为 `null`，写作/初刊/首演/身后出版分别标注；文字为原创整理与编辑导读，不含现代作品全文或未经许可肖像。状态统一为“资料核对版·待人工复核”，核对日期为 2026-11-10；自动数据测试不能替代文学史人工复核，也不承诺外部来源永久可用。

更新现有库执行 `npm run db:generate`、`npm run db:migrate`、`npm run db:seed:writers`。人物存于独立 `LiteraryWriter` 表，经登录保护的 `GET /api/literature/:projectId/writers` 读取，仅允许对应文学项目。定向导入在事务中只补缺项，重复运行不覆盖数据库中的人工编辑；跨项目 ID 冲突会回滚。含人物的项目禁止直接删除，防止误删档案。后续修改源数据不会自动覆盖已有档案，需明确审校迁移。

原始 Word 中的数量、技术“已实现/已验证”描述保留为来源项目历史记录，不代表当前系统完成了原站集成、人工审核或多媒体授权。

项目数据定义位于 `backend/prisma/literature.ts`。两份 Word 的导入正文位于 `backend/prisma/literature-sources.ts`，原件及本地封面位于 `backend/media/projects/literature/`，沿用 `/media` 登录保护。`scripts/import-literature-documents.ps1 -SourceDirectory <原件目录>` 可重新提取段落和表格；它更新归档文件，不覆盖数据库中的人工编辑。

`npm run db:seed:literature` 只补建缺失节点，重复运行不覆盖现有节点。常规全库 seed 也会补建本空间，但全库 seed 对其他示例项目保留其原有更新行为。

## 精准医疗行业简报

“事业工作”下新增“行业简报｜精准医疗 | 消息·点评”，独立于四维市场调研。日报使用世和动态、同行与竞对、监管与支付、科学与突破、上下游伙伴五栏，每条将事实、关注点、业务点评和原文来源分开；`severity=important` 显示重大提示。每条含标题的正文总计最多300字符、每栏最多3条。没有经核实新增时明确写无新增，不用旧闻凑数。

规则、来源导航与调度提示在 `PM-daily/`。升级现有库仅运行 `npm run db:generate`、`npm run db:migrate`、`npm run db:seed:precision-brief`，不要重跑全库seed。首期可回看7天，之后固定前24小时。当前版覆盖展示，运行和质检记录保留；失败不覆盖上一版。来源导航不是已抓取清单，媒体仅作补充，审批、临床、支付和财务事实优先官方原文。

本机已发布2026-11-12首期扩充版，窗口为北京时间11月5日00:00至12日00:00，五栏共12条消息、12个原文来源（世和2、同行3、监管2、科学2、上下游3）。输入归档在 `PM-daily/briefs/2026-11-12.json`。本机项目入口为 `http://10.5.2.31:5180/home?project=213`；迁移到其他数据库时使用定向seed返回的ID。Codex任务“PM·每日精准医疗行业简报”（id `pm`）已配置为每天北京时间09:00；页面通过项目专属 `Config` 记录展示配置状态及最近运行。暂停或修改桌面任务后应同步该配置，页面不会自行查询桌面应用的任务管理器。

```powershell
npm run precision:queue
npm run precision:queue -- --create
npm run precision:queue -- --start <runId>
npm run precision:validate -- PM-daily/runtime/brief.json
npm run precision:publish -- PM-daily/runtime/brief.json
npm run precision:test
```

排队重试由下一次Codex调度或手动启动的Codex运行领取，网页上的“重新运行”不等于已调用模型。领取时原子标记运行中，完成后沿用同一`runId`、`runKey`和窗口发布；失败使用 `precision:queue -- --fail <runId> <原因>`，不无限重试。发布CLI调用后端同一套校验及事务，不需要保存管理员密码、Cookie或模型API密钥。生成JSON必须符合 `backend/src/precisionBriefSchema.ts`，`sourceIds`指向来源`key`。

`PM_BRIEF_OUTPUT_DIR` 可为发布CLI指定本地副本输出目录，其下写入 `published/current.json` 与 `runtime/active.json`；默认是 `PM-daily`。该变量仅改变输出副本，不改变数据库或Hook候选路径。`precision:test` 使用独立临时SQLite与输出目录验证迁移、定向seed、五任务领取、CLI发布和失败保留当前版，不联网、不写实际项目数据库与当前版文件。

`.codex/hooks.json` 提供 `PostToolUse` 和 `Stop` 检查，只有 `PM-daily/runtime/active.json` 标记本次候选为`awaiting_validation`时生效；无关项目操作直接退出。Hook配置需要在Codex中信任其准确配置后才会执行，不能将“文件存在”当成“Hook已启用”。Hook不能证明新闻真实，也不能撤销已发生的工具副作用；即使Hook未信任，发布服务仍强制校验。配置及信任行为见[官方Hooks文档](https://developers.openai.com/codex/hooks/)。本地定时任务依赖电脑开机和Codex桌面应用运行，延迟时不伪造当日生成成功；不自动发送邮件或飞书。详见[定时任务文档](https://developers.openai.com/codex/app/automations/)。

## 市场调研｜四维子代理工作台

“事业工作”下的独立项目提供项目概览、研究目标、四个子代理任务、汇总报告、来源与证据、版本记录六个视图。项目入口沿用 `/home?project=<项目ID>`，可在一个项目中建立多个调研轮次。四个任务卡片默认折叠，手机上纵向排列。

现有数据库升级依次执行 `npm run db:generate`、`npm run db:migrate`、`npm run db:seed:research`，重启后端即可。最后一个命令只补建该项目、使用指南和空白研究模板，不覆盖已有编辑；重复执行返回零新增。请勿为了本次升级执行全库 seed。初始化输出实际项目 ID。

使用流程：新建轮次并填写研究对象与目标；打开宏观环境、产品技术、竞品信息、临床或真实用户需求四个任务，复制提示词到独立研究对话或交给研究者；将报告、来源及 3—8 条分类结论回填；填写数据截止日期、局限、待验证问题，依次标记待分派、进行中、已提交；四项全部完成后生成证据汇总，由人工总控补充判断、商业模式与进入路径、建议和风险，审核并导出 Markdown。项目下另有完整使用指南。局域网 HTTP 无法自动复制时会显示可手动选择的提示词。

本版不创建真实 Codex 子任务、不调用模型、付费搜索或临床数据库。生成汇总是确定性的材料归并，不代表自动完成独立研究或决策。来源的“人工核实”由使用者确认；不同 URL 也可能转载同一原始资料，需要人工判断独立性。五类结论分别标记已核实事实、多来源一致判断、单一来源判断、分析推演和未验证假设，不将模型输出直接视为事实。

管理员在账号的项目授权中单独勾选“允许编辑该项目的调研任务”。普通项目授权只读，研究编辑权不授予资料 CRUD 权限；撤销项目授权立即阻止读写。未提交任务可编辑；已提交或审核任务需先重开再修改，原版本保留。并发保存检测修订冲突。任何任务修改会使已有汇总过期；归档轮次仅可阅读和导出。已有研究的项目不能直接删除或取消项目身份。

接口均须已改密登录及项目授权：`GET /api/research/projects/:id/access`、`GET /api/research/studies/:projectId`、`POST /api/research/studies`、`PUT /api/research/studies/:id`、`GET /api/research/studies/:id/tasks`、`PUT /api/research/tasks/:id`、`POST /api/research/tasks/:id/submit`、`POST /api/research/tasks/:id/reset`、`GET /api/research/tasks/:id/versions`、`POST /api/research/studies/:id/synthesize`、`PUT /api/research/studies/:id/synthesis`、`GET /api/research/studies/:id/synthesis/versions`、`GET /api/research/studies/:id/export`、`POST /api/research/studies/:id/archive`。

新建轮次提交 `projectId/title/researchObject/goal`；修改轮次及汇总均携带 `expectedUpdatedAt`。任务完整字段及类型见 `backend/src/researchSchema.ts`，修改、提交、重开均携带 `revision`。导出接口返回 `{markdown, filename}`，报告明确显示草稿、已审核或过期状态，包含任务来源关联。SQLite 新增研究轮次、任务、任务版本、汇总及汇总版本五张表，不迁移或改写其他资料正文。

## 内容与媒体

### 周边游：我的安排

南京周边游的项目页及资料页表头提供“我的安排”，地址为 `/home?project=<项目ID>&view=plans`。每次出行单独保存，包含名称、目的地、出发/结束日期、状态、交通、同行人、预算、实际花费、逐日行程及旅后记录。支持新增、编辑、按状态筛选、展开详情及确认删除；刷新后已保存记录仍在。

点击“查看图文行程”进入独立旅行手册，地址增加 `&trip=<安排ID>`，可刷新或直接访问。手册展示路线示意、每日插画时间轴、衣食住行、预算分项与行前清单；详细说明和原始备注可展开，支持编辑及浏览器打印。清单勾选仅保留在当前页面，刷新后重置。插画不是景区实拍，制作说明见 [亲子旅行手册配图](docs/trip-guide-artwork.md)。私人行程从已认证的安排接口读取，不随前端静态文件发布。

安排持久化到 SQLite `TripPlan` 表，绑定当前账号与项目；访问者也能维护自己的记录。其他账号（包括管理员）不能通过安排接口读取或修改他人的记录。项目授权撤销后，原记录保留，重新授权后可继续访问。内容管理不能删除仍有安排的项目或取消其项目身份。金额以整数分保存，表单与列表显示人民币元；不提供文件上传和通知提醒。

升级只需运行 `npm run db:generate`、`npm run db:migrate` 后重启服务，不需要运行 seed。

安排接口：`GET /api/trip-plans?projectId=<id>`、`POST /api/trip-plans`、`PUT /api/trip-plans/:id`、`DELETE /api/trip-plans/:id`。创建体含 `projectId`，更新体不含；字段 `title/destination/startDate/endDate/status/transport/companions/budget/actualSpent/itinerary/notes`，日期为 `YYYY-MM-DD`，状态为 `planned/ongoing/completed/cancelled`，金额为非负整数分或 `null`，`itinerary` 为 `{ date, title, detail }[]`，最多 90 项且日期须落在出行区间内。删除发送 `{}`。全部接口需要已改密的登录会话、当前项目授权及记录所有权。

管理员可新增目录、文章、视频、幻灯片、长图和 PDF，编辑标题、场景、topics、正文、父级、排序、媒体地址，或删除内容。数字越小排列越靠前；非空目录必须先移动或删除其内容。禁止循环目录关系。正文采用 Markdown，不执行原始 HTML。资料放入目录后会自动继承目录场景。

项目标签固定为“项目周期 + 两个主题”。管理员可在空间概览的项目卡片或项目页直接选择 `长期性 / 阶段性 / 临时性`，选择后自动保存；访客只读。修改周期不会覆盖主题或正文，重新运行 seed 也会保留已设置的周期。

本版本通过地址管理文件，不提供文件上传。把自己的媒体放入 `backend/media/`，表单填写对应的 `/media/文件名` 地址，支持中文文件名；隐藏文件、目录穿越和根目录外的符号链接不可访问。图片序列每行一个地址。视频支持 MP4 和 HLS，HLS 必须同时提供可访问的播放列表及分片。受保护的本地媒体支持浏览器 Range 请求。

也可填写 HTTP(S) URL。远程资源是否支持嵌入、HLS 跨域请求与下载由其服务端决定；观澜无法为外部公开 URL 增加访问保护。内置示例全部使用受保护的本地地址。PDF 使用浏览器原生查看器，并提供独立打开入口；移动端浏览器不支持内嵌 PDF 时可使用该入口。

## 接口

所有写入请求使用 `Content-Type: application/json`。错误统一为 `{ error: { code, message, fields?, retryAfter? } }`。

| 方法与路径                 | 权限   | 行为                                                                       |
| -------------------------- | ------ | -------------------------------------------------------------------------- |
| `POST /api/auth/login`     | 公开   | `{ username, password }`，返回 `{ user: { id, username, role, mustChangePassword } }` 并设置 Cookie |
| `GET /api/auth/me`         | 登录   | 当前身份                                                                   |
| `POST /api/auth/logout`    | 登录   | 清除 Cookie；请求体 `{}`                                                   |
| `POST /api/auth/change-password` | 登录 | `{ oldPassword, newPassword }`，撤销全部会话 |
| `GET /api/admin/users` / `POST /api/admin/users` | 管理员 | 列出账号 / `{ username, password, role? }` 创建账号 |
| `PATCH /api/admin/users/:id` | 管理员 | `{ username?, role?, enabled? }` 编辑账号 |
| `POST /api/admin/users/:id/reset-password` | 管理员 | `{ password }` 重置其他账号的临时密码 |
| `GET /api/admin/projects` | 管理员 | 可授权项目列表 |
| `GET /api/admin/users/:id/projects` / `PUT /api/admin/users/:id/projects` | 管理员 | 查询 / `{ projectIds: number[] }` 全量替换授权 |
| `GET /api/contents`        | 登录   | 按顺序嵌套的内容树                                                         |
| `GET /api/contents/:id`    | 登录   | 单项详情                                                                   |
| `POST /api/contents`       | 管理员 | 创建，返回 201                                                             |
| `PUT /api/contents/:id`    | 管理员 | 全量更新                                                                   |
| `PATCH /api/contents/:id/cycle` | 管理员 | `{ cycle: "长期性" \| "阶段性" \| "临时性" }`，只更新项目首标签 |
| `DELETE /api/contents/:id` | 管理员 | 删除，返回 204；请求体 `{}`                                                |
| `POST /api/log`            | 登录   | `{ contentId, action }`，返回 201                                          |
| `GET /media/*`             | 项目授权 | 逐文件校验，支持 Range 和下载                                             |
| `GET /api/health`          | 公开   | 进程健康状态                                                               |

内容字段：`title`、`type`（`folder/video/ppt/mindmap/longimage/pdf/text`）、`isProject`（仅目录可设为 true）、`scene`（`system/tools/life/work/hobbies/other`）、`topics`（普通资料 1–2 个，项目为周期和两个主题）、`description`、`parentId`、`sortOrder`、`coverUrl`、`fileUrl`、`hlsUrl`、`pdfUrl`、`imagesJson`（字符串数组）。视频至少填写 `fileUrl` 或 `hlsUrl`，幻灯片和长图至少提供一张图片，PDF 至少填写 `pdfUrl` 或 `fileUrl`。

## “爱的城堡”生活项目

“生活场景”下的 `爱的城堡` 是一个可持续编辑的家庭内容空间，包含五个可折叠板块：`“玩”起来-日程安排（日常）`、`“求知如”-生而为人（通识）`、`“解构世界”-科技特长（专业）`、`“奔赴热爱”-体育特长（运动）`、`“愉快假期”家庭游（游乐）`。每个板块自带一份 Markdown 表格模板；使用 `/home?project=<项目 ID>&folder=<板块 ID>` 可打开板块，管理员可继续新增资料。`npm run db:seed:castle` 只补建缺失节点，不覆盖已有编辑。

AI 系列课程示例按“一稿多形态”组织：`课程文档｜…完整讲义`提供完整框架、八讲目标、示范、提示词、练习和验收，并在同一文档内用章节标签切换内容；`课件展示｜…`提供可翻页的 12 页 PPT 视觉导览；`长图展示｜…`提供 1080×3180 的纵向路线图；`动画视频｜…`提供约 32 秒、四章字幕动画。四种成品共享同一课程主题，左侧目录只保留四个形态入口。

## “观天下”宏观环境项目

“系统管理”下的 `观天下` 按“一期一题”归档。首期为“增长仍在，体感为何分化？”，资料截止 2026-11-10，提供项目概览、专题解读、传导与情景、观察清单、资料来源五个视图。六篇专题覆盖政治与政策、国际局势、全球经济、国内形势、社会要素、技术与劳动；本期完整报告可下载为 Markdown。

第二期为“黄仁勋承认婚内不忠：政治的牺牲品？”，资料截止北京时间 2026-11-11。时间线区分公告或披露、媒体报道、公开表态、诉状提交与已公告议程，并随报告导出。

两期已增加“证据与论证”：先展示原始数据、事实和来源依赖，再给出可复算公式、结论强度、替代解释和验证条件，最后阅读机制与条件情景。第一期不从消费行为反推信心再用信心解释消费；第二期分开个人承认、媒体身份指称、调查程序和政策影响。原数据截止日保持不变，另列复核日期。Markdown下载包含同一套证据。

运行 `npm run db:seed:world` 可定向补建项目、内置期次和文档。该命令只补缺项，保留已有编辑；遇到同名节点类型或标记冲突会回滚。无需重置数据库或重跑全库 seed。项目 ID 由数据库分配，从空间概览搜索“观天下”进入。

已有前两期用 `npm run db:upgrade:world-evidence` 预览证据升级；加 `-- --apply` 应用。命令只更新与已保存原模板一致的正文，保留标签、排序等元数据；人工正文冲突保留并返回列表，不用标记授予覆盖权限。应用前将本轮目标内容备份到 `output/backups/`；重复运行不会重复写入。研究笔记、来源归档清单和基线在 `research/world-evidence/`。不要用重跑seed替代升级，也不要用基线覆盖人工正文。

内容沿用管理员 CRUD：项目目录保留 `<!-- WORLD_PROJECT -->` 标记，期次目录保留 `<!-- WORLD_ISSUE -->` 标记；每期恰好有一份以 `<!-- WORLD_DATA_V1 -->` 开头的 JSON 数据文档，结构定义在 `backend/src/worldSchema.ts`，示例见 `backend/prisma/world-data.ts`。六篇 Markdown 正文按数据中 `documentTitle` 对应，编辑正文会同步用于阅读和导出。新增一期时建立同结构目录，递增排序值，页面默认显示排序最高的一期。

资料页提供发布日期、统计期、原始链接和支持范围。公布值、机构预测、政策目标与研究估计分别标注；情景为条件推演，未赋予概率。每期是有截止日期的快照，不自动抓取实时数据；下一期候选题目明确标为未发布。NASA 夜光影像为 2012 年历史背景，来源和署名随页面展示。

## 碌碌无为｜微观与民生观察

在观天下页面的“微观与民生观察项目”入口进入，或从系统管理选择“碌碌无为”。栏目按一期一主题归档，包含项目概览、栏目说明、每期模板和待调研选题池。使用 `npm run db:seed:livelihood` 定向补齐项目、栏目文档及第001期“灵活用工，普通人的权益如何保障？”；重复执行保留人工编辑，遇到同名类型或标记冲突回滚。新项目独立管理访问授权，管理员可在账号管理中分配。

第001期按现状、问题、分析、方案阅读，提供用工关系对照、维权场景路径、责任主体筛选、来源检索及完整Markdown报告下载。方案页提供12333、12348及官方服务入口，四类处境分别列出首次求助说明、辖区核对和回执要求；热线咨询与平台报案不等于正式受理。正文与17条成稿来源截止2026-11-11，不自动更新政策；地方办理条件须另核，机制分析没有虚构调查或效应估计。研究报告和22条来源台账在 `research/livelihood-flexible-work/`。

新增期次沿用 `<!-- LIVELIHOOD_ISSUE -->` 目录标记，每期恰有一份以 `<!-- LIVELIHOOD_DATA_V1 -->` 开头的数据文档，结构见 `backend/src/livelihoodSchema.ts`。四份正文由数据中的 `documentTitle` 对应，管理员修改正文后阅读和下载保留修改；数据损坏显示修复提示，不回退到其他期次。项目介绍默认打开项目概览，期次链接使用 `lifeView=issues&lifeIssue=<id>`，章节使用 `lifeSection=situation|problems|analysis|solutions|sources`。

## 市场调研首份报告

运行 `npm run db:seed:cdx-market`，在“事业工作 → 市场调研｜四维子代理工作台”建立“001｜肿瘤伴随诊断市场进入”。命令输出实际项目与研究编号，以及直达 `researchView=report` 的地址；重复执行不新增、不覆盖人工修改，也不替换原有通用模板。不要重置数据库或重跑全库 seed。

首份资料截止2026-11-12，包含四个已提交专题、总控综合报告、21条来源记录（19个去重原文地址）、冲突分析、BD优先级和补充尽调清单。来源的人工核实标记保持未勾选，综合报告等待负责人审核，不将AI核读等同于人工审核。临床部分没有实际访谈，中国准入与地方支付仍需逐项核验。

“调研报告”支持目录、表格、来源定位和完整Markdown导出；“四维任务”保留子报告正文、结论及历史。`node --import tsx scripts/verify-cdx-browser.mjs` 使用临时受限读者验证1440、390、320宽度、来源定位、下载和刷新，结束后移除测试账号，截图保存在 `output/playwright/cdx/`。

## 配置与运行边界

生活场景新增“基础生活｜健｜健康管理”。升级运行 `npm run db:migrate`、`npm run db:generate`、`npm run db:seed:health` 后重启后端；Windows 若 Prisma 客户端引擎被占用，先停止本项目 Node 服务再 generate。seed 仅补缺，保留既有健康指南编辑，不自动增加账号授权。

管理员从空间概览进入，访问者需先获该项目授权。健康工作区按登录账号与项目隔离，可管理授权家人的最小档案、日常测量趋势、行动与周回顾、药单、预约和就诊摘要；通用指南由项目成员阅读，个人健康信息不要写入共享文档。使用说明与科学来源见 [健康管理说明](docs/family-health.md)。本地 HTTP 仅用于可信网络，未接入在线医生、自动诊断或后台监护。

- `.env.example` 描述可用配置。`FRONTEND_ORIGIN` 必须与浏览器实际地址一致（包括端口），用于拒绝非预期来源的写入；如开发端口被占用，请同时调整该配置和 Vite 启动端口。
- 登录 Cookie 使用 HttpOnly、SameSite=Strict、30 天有效期；`NODE_ENV=production` 时增加 Secure，需 HTTPS。JWT 同时验证数据库会话与用户状态；旧角色 JWT 不再接受。
- 生产环境需同源托管 `frontend/dist`，将 `/api` 和 `/media` 转发到后端。开发时由 Vite 完成转发。项目不包含生产反向代理部署。
- 密码连续错误 5 次后，同一 IP 或同一用户名在 15 分钟窗口内禁止登录。当前限流存储在单进程内存中，重启会清空。后端默认不信任代理转发 IP；使用反向代理时须按实际网络边界配置代理信任，不能直接信任任意 `X-Forwarded-For`。
- 访问日志包含 IP、User-Agent、内容编号、动作与时间，保存在本地 SQLite；本版本没有统计页面或自动清理策略。`Config` 表为后续站点配置预留。
- 备份时同时备份 SQLite 数据库与 `backend/media`；修改数据库提供方需要新的迁移及数据迁移，不能只修改连接字符串。
- 不包含多用户注册、文件上传、媒体转换服务、云存储、Redis 或 Docker。`assets` 仅为开发演示生成静态样例，不是上传处理流水线。

## 目录

`frontend/src`：界面、阅读器与 API 客户端。`backend/src`：认证、校验、接口和启动配置。`backend/prisma`：数据模型、迁移与种子。`backend/test`：隔离数据库接口测试。`scripts`：本地初始化与样例资源生成。
# mRNA 研究工作台更新（2026-11-10）

打开局域网 `/home?project=23`，可切换研究概览、临床证据、管线台账、技术与BD、来源交付。
研究输入及检索快照在 `research/mrna-v2/`；`npm run research:mrna` 从核验数据生成页面JSON、报告和Excel，`npm run db:seed:mrna` 只更新mRNA的模板内容并保留自定义文档。Excel构建使用本机Codex随附的 artifact-tool 运行时，普通npm安装不包含它；已生成的交付文件可直接使用。
实际数据库ID可能与本机23不同，应从空间概览进入mRNA项目。所有下载通过已有登录鉴权的 `/media/projects/mrna/` 提供。

