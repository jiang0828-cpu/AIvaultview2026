# 完善解构世界科技特长专业成长空间 — the user's messages, verbatim

> 用 marathon skill，优化并完善结构世界板块，并完善各模块内容，直至可以交付，先生成标准和提示词，再执行，最后审核确认

> 用 marathon ` skill , 优化并完善结构世界板块，并完善各模块内容，直至可以交付，先生成标准和提示词，再执行，最后审核确认

## 本轮执行记录（2026-11-10）

- 先产出 `research/DECONSTRUCT_WORLD_STANDARD.md`，把内容、导航、交互、权限、响应式和证据要求变成可勾选标准。
- 再按执行提示词修订“解构世界”-科技特长（专业）的入口、四类文档和成长工作台。
- 最后执行测试、类型检查、lint、build、局域网浏览器检查，并将问题与修订证据写入 `audits/` 和 `REPORTS.md`。

> 参考文档：C:\Users\admin\Desktop\“解构世界”-科技特长（专业）.docx

## 执行提示词（供研究、构建和审核阶段复用）

### 内容研究提示词
你是“钥藏 / VaultFolio”的专业成长内容策展人。请以“解构世界”-科技特长（专业）为主题，先读取并核对参考 DOCX 的标题层级、表格字段、方法论和示例，再映射到现有四类内容：专业成长与实践记录、成长计划、阶段方案、成果展示。保留原有用户编辑，不虚构个人信息、健康数据、家庭成员、成绩或外部事实。输出可执行的 Markdown 模板：每个字段说明填写目的、证据要求和复盘问题；空白表格必须保持可编辑。

### 交互构建提示词
你是资深 React/TypeScript 产品工程师。沿用现有 Content 树、Markdown、管理员 CRUD、路由参数和中文响应式视觉系统，不新增 schema。将“解构世界”做成一个清晰的专业成长工作台：用户可以在成长计划、阶段方案、成果展示之间切换，看到阶段路径、任务进度、证据卡片和下一步行动；状态可刷新保持，访客只读，管理员可编辑。交互必须键盘可达、移动端不溢出、无效目录参数回退到当前项目。

### 内容完善提示词
请为四份文档补足“目标—行动—证据—复盘—下一步”的闭环。内容以通用方法和空白模板为主，不编造用户事实；可提供示例字段、检查清单、验收标准和作品集展示建议。每份文档只服务一个使用场景，标题和 Topics 清晰，避免重复描述。

### 审核提示词
你是独立交付审核员。只根据 CHARTER.md、research/BRIEF.md、当前提交内容和测试证据审核。逐条检查：结构完整、字段可填写、内容不虚构、四类文档互相链接、项目入口和返回路径正确、交互有反馈、访客/管理员权限不回归、桌面与 390px 移动端无溢出、测试/类型检查/lint/build 通过。任何 Critical/Major 问题必须修复后再给出 USE: yes；Minor 问题需列出风险和后续建议。

For authorized work, append user messages verbatim before acting, including queued messages and ask replies. Log lead ask batches with --lead; reconcile into R/Q and update ledger_through. Answer-only discussion authorizes no file writes. Never edit earlier entries.
