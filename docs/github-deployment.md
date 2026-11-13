# GitHub 与 SSH 发布

## 日常使用

1. 将本次已经审核的代码推送到 `main`。
2. 在 [GitHub Actions](https://github.com/jiang0828-cpu/AIvaultview2026/actions/workflows/release.yml) 查看 `VaultView - Verify and Publish`。前端、后端、Python、数据合并测试及构建通过后，会保留对应提交的发布包。
3. 工作流进入 `production` 待审核状态后，点击 **Review deployments**，核对提交和变更，再选择 **Approve and deploy**。
4. GitHub 通过独立 SSH 密钥上传同一次构建的发布包。服务器先预演迁移、备份，再升级；升级脚本自带部署锁、健康检查和失败恢复。后台执行不会随 SSH 断开而中止。
5. Actions 结果显示实际状态及服务器日志路径。发布成功后访问 https://vault.trialmatch.xin。

每次审批只对应该工作流的提交和产物。新的推送会生成新候选，仍需再次批准。拉取请求只运行验证，不发布。

## 首次配置

仓库 `production` Environment 需要设置：

- Required reviewers：文隽的 GitHub 账号。
- 关闭管理员绕过审批；单人维护时允许本人审批自己的推送。
- 仅允许 `main` 分支部署。
- Secrets：`VAULTVIEW_SSH_PRIVATE_KEY`、`VAULTVIEW_SSH_KNOWN_HOSTS`。

仓库 Actions Variables：

| 名称 | 值 |
| --- | --- |
| `VAULTVIEW_DEPLOY_HOST` | `47.114.47.164` |
| `VAULTVIEW_DEPLOY_PORT` | `22` |
| `VAULTVIEW_DEPLOY_USER` | `root`，仅允许受限部署命令 |
| `VAULTVIEW_DEPLOY_ENABLED` | 首次安装验收前为 `false`，验收成功后设为 `true` |

独立密钥仅用于部署；不要上传个人现有 SSH 私钥。服务器 `authorized_keys` 中该公钥必须包含：

```text
command="/usr/local/sbin/vaultview-ci",restrict ssh-ed25519 <专用公钥>
```

`ci-receiver.sh` 安装到 `/usr/local/sbin/vaultview-ci`。受限密钥只接受指定提交的发布上传与状态查询，不开放交互终端、端口转发或任意远程命令。

`install-ci.sh` 通过指定 Git 提交及 SHA256 校验接收器，添加专用公钥前备份既有授权文件，保留已有 SSH 登录方式。安装命令由本地配置流程生成，存于忽略目录 `output/private-deploy/`，不要提交密钥目录。

配置完成后，先使用专用密钥查询一个不存在的部署 ID，确认返回 `{"state":"absent"}`，再开启 `VAULTVIEW_DEPLOY_ENABLED`。然后在 Actions 选择该工作流，点击 **Run workflow**，分支选择 `main`，进行首次验证和人工审批。

## 内容与数据边界

此 Git 流程打包代码、前端静态文件及数据库迁移，不包含开发 `.env`、本地 SQLite、账号、会话、私人账本、健康数据或本地私有媒体。迁移在现有线上数据库上执行，不做全库 seed，不替换生产数据库。

数据库里的新课程、项目资料及受保护媒体仍使用本地 `freeze-release.mjs` 和 `package-upgrade.mjs` 的受控内容更新流程；Git 推送本身不会同步这些本地数据库内容。内容更新审核确认后，由现有部署工具单独执行。

## 失败处理

- 验证失败：不生成可发布结果；修复后重新推送。
- 没有审批人或允许绕过审批：部署前检查会拒绝执行。
- SSH 无法连接：不切换线上版本；先检查服务器、22 端口、SSH 服务和云安全组。GitHub 联动无法绕过服务器网络故障。
- 状态查询断开或工作流超时：服务器后台任务可能仍在执行。先检查对应 `/root/vaultview-ci/<commit>-<run>-<attempt>/upgrade.log`、`result.json` 及实际当前版本，不盲目重复部署。
- 升级失败：查看脚本记录的备份和恢复结果；不要把 Actions 红色状态直接等同于已回滚。

GitHub 官方说明：[部署环境与审批](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments)。
