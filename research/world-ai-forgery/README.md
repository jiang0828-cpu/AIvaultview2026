# 观天下第003期：AI造假

本期为现有观天下项目新增内容，独立应对层已接入页面和完整报告下载。

- 项目概览：http://10.5.2.31:5180/?project=175&issue=193&worldView=overview
- 证据与论证：http://10.5.2.31:5180/?project=175&issue=193&worldView=evidence
- 应对措施：http://10.5.2.31:5180/?project=175&issue=193&worldView=responses

上述地址需要现有账号登录并具有观天下项目授权，设备须能访问相同局域网。

## 内容与来源

`report.md`保留实际下载稿；`BRIEF.md`说明主要纠错和证据边界；`source-manifest.json`记录13个来源及文件SHA256。12份为完整原始文件，EUR-Lex为明确标识的已核验条文摘录，原因是直接请求返回空HTTP202。NASA来源仅用于栏目背景，不参与本期判断。

`notes.md`是早期检索记录，可能包含后来修正的日期和计算建议；最终采用的数据口径以`report.md`、`source-manifest.json`和两份003源码为准。FTC求职与职业中介骗局是商业与就业机会的大类子项，9000万至5.01亿美元为2020至2024年累计变化，不能标成AI损失或年增长率。

## 实现与复核

数据：`backend/prisma/world-003-data.ts`；六篇正文：`backend/prisma/world-003.ts`。应对字段为可选，前两期保持兼容；不存在措施的期次不显示该入口。seed只创建缺失内容，不覆盖人工编辑。

工程命令：`npm test`、`npm run typecheck`、`npm run lint`、`npm run build`。本期79项测试通过；固定候选四项命令即时捕获退出码均为0。Vite现有大包警告仍在，未宣称优化加载体积。局域网验收与隔离测试账号清理见`verification.md`。

固定复核候选位于`output/reviews/world-ai-forgery-candidate`，SHA为`074b6fe96d7f3928e6035735600b783a33564460`。它是独立本地审查副本，没有提交用户的主工作树，也没有推送远程仓库。最终评审及状态以`run/audits/round-1/`和`run/STATE.md`为准。
