# vault.trialmatch.xin 部署准备

目标服务器：47.114.47.164，Ubuntu 24.04，2 核 / 2 GB，现有 Nginx 与多个业务服务。
本目录包含部署模板和首次安装脚本。2026-11-11 已通过现有 SSH 配置完成首次安装，公网入口为 https://vault.trialmatch.xin。

## 当前部署记录

### 2026-11-12 更新

- 当前发布：`20261112T100149Z`；上传包：`20261112T100029Z`；独立构建快照：`output/releases/20261112T095614Z`。
- 公网现有 13 个项目、149 条内容，新增健康管理、比价、行业简报、调研、第二期 AI 课程及英语学习资料。
- 采用资料增量合并，保留公网原有账号、密码、项目授权、会话和私人数据；新增 46 条内容、更新 1 条内容，导入 179 条调研与简报关联记录，合并 73 个媒体文件。本次没有字段或媒体冲突，没有删除公网内容。
- 升级前备份：`/var/backups/vaultview/upgrade-20261112T095203Z` 和 `/var/backups/vaultview/upgrade-20261112T100149Z`；旧代码版本仍保留在 `releases` 中。
- 比价服务由 `vaultview-compare.service` 管理，仅监听 `127.0.0.1:8001`，数据库为 `/var/lib/vaultview/compare/compare.db`；每日备份已覆盖此数据库。未配置授权平台凭据时支持演示及手动导入，不宣称已开通各平台实时搜索。
- Nginx 为调研接口单独开放 3 MB 请求体，其余接口仍沿用原限制；保留本域名之外的站点配置。
- 独立快照通过 103 项后端、69 项前端测试、类型检查、lint 和生产构建。Python 73 项测试、lint 和 mypy 通过，合并逻辑 2 项测试通过。公网 55 项接口验收通过；桌面和手机浏览器检查首页、会话恢复、健康管理、比价及第二期课程，未发现运行错误或页面横向溢出。
- 本地完整备份命令：`node scripts/backup-local.mjs`，包含 Git 历史、未提交源码、数据库一致性快照、媒体及本机配置。备份位于忽略目录 `output/backups/<版本>`，含私密信息，不得公开上传。
- 本次资料合并以首次发布数据为基线，禁止用本地数据库覆盖生产数据库。后续发布须重新核对上一版基线及合并预览；有冲突时保留公网字段，不强制覆盖。原始备份和迁移脚本不等同于已完成完整恢复演练。

### 2026-11-11 首次安装

- 发布版本：`20261111T090425Z`，迁移包版本：`20261111T085831Z`。
- 保留 103 条内容、7 个项目、2 个原有账号及其项目授权；没有重置原有账号密码。
- `vaultview.service` 已启动并设为开机启动，后端仅监听 `127.0.0.1:3101`；Nginx 提供 HTTPS。
- `vaultview-backup.timer` 已启用，安装后及验收后均成功完成本地备份，数据库完整性检查通过。
- 线上接口验收 50 项通过，覆盖临时账号创建、首次改密、会话撤销、空授权、两个访问者的项目隔离、授权撤销、媒体保护和视频 Range。
- 验收脚本 `scripts/verify-production.mjs` 已检查语法和 lint；上传至服务器后用 `/opt/vaultview/runtime/node /root/vaultview-upload/verify-production.mjs` 运行。脚本仅使用随机临时账号，结束后清理账号、会话、授权和测试日志，不改现有密码。
- 已从本机验证公网 HTTPS 健康检查和浏览器登录页，检查移动端登录布局；原有 `baijia`、`yanwustudy` 子站安装前后均返回 200。
- Certbot 自动续期定时任务已存在，本站证书的续期演练已成功；正式续期后由部署钩子检查并重载 Nginx。
- 异地备份与完整恢复演练仍待配置；本地备份不代表已具备异地灾难恢复能力。

## 首次安装包

本机先运行测试、类型检查、lint 和构建，成功后执行 `node scripts/package-production.mjs`。
输出到忽略的 `output/deploy/<版本>/`，上传下列四个文件到服务器 `/root/vaultview-upload/`：

- `vaultview-release.tar.gz`：已编译前后端、依赖清单、迁移和部署模板；不包含 Windows node_modules。
- `vaultview-private-data.tar.gz`：SQLite 一致性快照和媒体，包含账号密码哈希、授权及私有资料，不得公开下载。
- `install-first.sh`：首次安装脚本。
- `SHA256SUMS`：传输完整性校验。

服务器执行 `cd /root/vaultview-upload && bash install-first.sh`。脚本校验文件摘要、证书和端口，不覆盖已有数据库或应用安装。依赖在服务器按 Linux 平台安装，生产 JWT 密钥重新生成；沿用迁移数据库的管理员账号和密码，所有人须重新登录。临时密码账号仍须首次改密。

脚本使用独立服务用户，备份旧 Nginx 站点配置，启用 HTTPS 和证书续期后的 Nginx 重载，安装每天本地备份并保留最近七份。备份采用 SQLite backup API，第一份备份在安装时立即运行。上传目录中的私有数据包和本地快照也含敏感资料，安装验收后应按备份策略妥善保管。

若中途失败，保留输出并检查具体阶段；不要删除已生成的生产数据库后盲目重跑。该脚本仅用于首次安装，后续升级须单独制定发布和回退步骤。

## 1. DNS 与服务器检查

在 trialmatch.xin 的 DNS 管理中新增记录，不修改已有根域名及其他子域名：

| 字段 | 值 |
| --- | --- |
| 记录类型 | A |
| 主机记录 | vault |
| 记录值 | 47.114.47.164 |
| 线路 | 默认 |
| TTL | 默认值 |

解析目标为 vault.trialmatch.xin。DNS 生效不代表网站已部署。

服务器只读检查：

```bash
getent ahostsv4 vault.trialmatch.xin
ss -lntp '( sport = :3101 )'
nginx -t
nginx -T 2>/dev/null | grep -E '^# configuration file|^[[:space:]]*(server_name|listen|ssl_certificate)[[:space:]]'
```

仅分享筛选后的输出，不分享证书私钥、环境变量或完整 Nginx 配置。确认当前域名未被其他站点使用；确认 80/443 的云安全组和系统防火墙规则。后端端口不开放到公网。

## 2. 目录与发布边界

| 路径 | 用途 |
| --- | --- |
| /opt/vaultview/releases/<version> | 代码、Linux 依赖和构建产物 |
| /opt/vaultview/current | 指向当前发布版本的符号链接 |
| /opt/vaultview/runtime/node | 非 root 服务可执行的 Linux Node 22 运行时 |
| /etc/vaultview/vaultview.env | 生产配置，仅 root 和服务账号可读 |
| /var/lib/vaultview/data/vaultview.db | SQLite 数据库 |
| /var/lib/vaultview/media | 受保护媒体 |
| /var/lib/vaultview/acme | HTTP 证书验证文件 |

用独立 vaultview 系统用户运行服务。发行目录由发布账号维护，服务用户仅写入 /var/lib/vaultview；前端构建目录允许 Nginx 读取。不得使用服务器现有的 /root/.nvm 路径启动非 root 服务，不修改现有业务的 Node 版本。

当前程序仍从发行目录的 backend/media 读取媒体。每个版本的 backend/media 须建立指向 /var/lib/vaultview/media 的符号链接；保留根目录 .env.example 以供项目根目录定位。生产环境配置由 systemd EnvironmentFile 注入，不复制开发 .env。

数据库迁移需要明确选择：迁移现有资料库，或全新空库。迁移现有库时，先停止源端写入，制作一致性备份，并同步数据库与媒体；正式启动后不要继续把本机数据库覆盖到生产。先备份目标数据库再运行 db:migrate，不运行 setup、assets 或全库 seed。更换生产 JWT_SECRET 会要求所有用户重新登录。

## 3. 构建与 Linux 依赖

前端可在本机构建并上传 frontend/dist。后端 TypeScript 可在本机构建，但 Windows node_modules 和 Prisma 引擎不能上传后直接当 Linux 依赖运行。

在 Linux 发布目录执行 npm ci，再运行 npm run db:generate 生成对应平台的 Prisma Client；保留迁移期间需要的 Prisma CLI。优先在 Linux 构建环境完成依赖准备。服务器内存紧张时避免并行构建或与现有业务争抢资源。

发布包仅包含需要的源码、清单、锁文件、迁移、构建产物和媒体；不包含 .git、本机 .env、node_modules、测试凭据、output、数据库备份或临床研究原始大文件。数据库与媒体使用单独受控传输。

## 4. Nginx、HTTPS 与上线前待办

先确认现有配置布局，再新增独立虚拟主机。nginx-http.conf 只用于证书验证，其他请求返回 503。证书须覆盖 vault.trialmatch.xin；可以使用现有证书工具或 webroot 验证，避免独占 80 端口的验证方式影响现有网站。

证书就绪后，将 vaultview-proxy.conf 放入 /etc/nginx/snippets/，以 nginx-https.conf 替换本子域名的 HTTP 引导配置。两份站点配置不要同时启用。证书路径按实际签发结果调整。每次修改先 nginx -t，成功后 reload，不覆盖 nginx.conf 或其他站点配置。

上线前还需落实：

- 生产配置设置 `TRUST_PROXY=loopback`，模板覆盖转发头，应用只信任同机代理；对应回归测试验证了客户端 IP 和默认不信任行为。
- 首次安装脚本创建独立服务用户、复制现有 Linux Node 运行时、安装 Linux 依赖，不更换现有业务的 Node 环境。
- 确认证书自动续期任务有效，运行 `certbot renew --dry-run --cert-name vault.trialmatch.xin --no-random-sleep-on-renew` 验证；脚本安装了续期后 nginx -t / reload 钩子。关闭随机等待仅适用于手动演练，不修改定时任务。
- 本地备份不足以应对服务器丢失；仍需配置异地保存和恢复演练，数据库迁移后的回退应与对应备份配套。
- 检查现有 Nginx logrotate 已覆盖新日志，配置磁盘与内存告警，清理仅本项目的过期发行版本。

## 5. 验收

- 原有主站及 API 行为正常，新增服务不占用原业务端口。
- HTTP 跳转 HTTPS，刷新 /home 等前端路由正常。
- 登录 Cookie 为 Secure / HttpOnly；新建账号、首次改密、注销及授权撤销正常。
- 两个访问者互相不能访问未授权项目，媒体直链也返回拒绝结果。
- 已授权视频 Range、HLS、PDF、PPT、长图和附件下载正常。
- systemd 重启与服务器重启后服务可恢复；日志无敏感凭据。
- 进行异地备份恢复测试，确认数据库和媒体均能恢复。

最终公网地址为 https://vault.trialmatch.xin；只有完成以上部署和验收后才能标记为已上线。
