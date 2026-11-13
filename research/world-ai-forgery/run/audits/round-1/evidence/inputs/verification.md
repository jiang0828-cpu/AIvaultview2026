# 第003期局域网验收

验收日期：2026-11-11。执行者：world003-ops。最终内容冻结后重新执行，以下均为本次实测，不包括独立内容评审或全仓测试结论。

## 入口与数据库

- 正式局域网入口：`http://10.5.2.31:5180/?project=175&issue=193&worldView=responses`。`FRONTEND_ORIGIN`当前为5180；5174可读页面但其写请求Origin不被当前后端接受，因此没有修改安全策略去兼容旧地址。
- 首次seed新增8节点：期次193及7个子节点；第二次及最终重复seed均`created: 0`。
- 最终数据修正后，对本任务拥有的193–200节点先比较逐节点递归SHA256，再在事务内更新8节点；无并发差异，未覆盖人工改动。
- seed前已有95条Content。更新前后比较所有非创建/更新时间字段的SHA256，95条完全一致，包括前两期正文、排序、标签与资源字段。项目175的更新时间由seed按既有逻辑更新。
- 日志：`.tmp/world003-seed-1.log`、`.tmp/world003-seed-2.log`、`.tmp/world003-refresh.log`、`.tmp/world003-seed-final.log`、`.tmp/world003-db-audit-final.log`。
- 再从实际数据库194数据文档反解析确认：两张图的值分别为`[27,38]`与`[90,501]`，第四指标为`22 %`；6组应对的验收指标均有显式分母（`÷`），确认已替换最初seed内容。见`.tmp/world003-live-confirm.log`。

## 浏览器交互和布局

真实Playwright CLI；隔离visitor只获观天下项目授权，未使用或输出真实用户凭据。

- 第003期概览、证据与论证、应对措施在1440、390、320像素宽度分别截图，共9组。`document.documentElement.scrollWidth`分别等于1440、390、320；被检查内容区没有超出视口的后代元素。导航条允许自身滚动。
- 概览有3条本期要点；证据页有12条记录、2项复算、6条结论，证据锚点可跳转。
- 应对页有6组措施，每组包含至少2条动作、触发场景、局限、验收指标和来源链接。刷新后仍保留`worldView=responses`及已登录会话。
- 6个专题维度依次点击并读取实际正文。正文字符数：principle 2274、content 1899、economy 2306、governance 2055、provenance 2382、society 2536。该计数包括正文中附带的事实、应对摘要及参考资料，不等于编辑文章净字数。
- 切换176和185前两期，证据页继续可用；无应对数据的期次不出现空应对标签。切回193正常。
- 最终交互期间pageerror为0，HTTP400及以上为0，浏览器console错误/警告为0。
- `.tmp/world003-browser.log`首行结果保存全部测量值；`.tmp/world003-console-final.log`保存console摘要。首次预检的期次切换断言存在React渲染时序竞争，脚本增加等待URL与目标标签移除后，最终全流程通过，没有修改产品代码。

## 导出

从真实页面“下载本期”按钮下载`output/playwright/world003/report-003.md`，67,243字节。

逐项比对当前源数据的6组措施：标题、责任主体、目标、触发条件、全部动作、局限、验收指标和来源引用均存在；3条要点、13条来源URL均存在，应对层位于条件情景之前。见`.tmp/world003-export-check.log`。

## 图像复核

截图位于`output/playwright/world003/`：overview/evidence/responses的1440、390、320完整页，以及response-detail-desktop/mobile、calculations-detail-desktop/mobile、claim-detail-desktop、takeaways-detail-desktop。

实际打开检查了桌面完整应对页、320完整应对页、最终桌面及390单项应对详情、最终390复算详情、桌面要点详情。桌面措施两列、手机单列，标题、段落、步骤、公式和来源均无重叠；最终指标定义增加后仍能完整换行。完整手机长页缩略图只能判断布局，细字可读性以单项详情原尺寸图确认。

## 清理与保留

- 已删除隔离账号及其浏览日志，关联授权/会话按数据库关系清理；OS临时fixture/state均不存在。
- 删除账号后刷新，应用正确跳转`/login`并显示用户名/密码表单。该阶段`/auth/me`返回401属预期，未计入已登录交互错误统计。
- 只关闭并清理`world003-ops`浏览器session，释放marathon browser锁；原5174、5180、3101服务保留。
- 未提交主工作树，未修改产品源文件。保留截图、导出和审计脚本供独立评审复核。
