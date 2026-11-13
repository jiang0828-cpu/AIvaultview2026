# 英语学习及实战

入口：生活场景 → 爱的城堡 → 通识 → 英语学习及实战。

局域网地址：`http://10.5.2.31:5180/home?project=99&folder=248`。

## 首版内容

- 字母卡：26 个大小写字母、代表词、图像联想与点击发音。
- 场景词：问候、颜色、动物、数字、食物，共 42 个词或短语。
- 二选一：错题可重试，答对后解锁下一题，按词汇去重记录进度。
- 小对话：见面、点心、道歉、告别，共四组生活对话。
- 课程文档：学习路线、字母、问候、词汇、实战和学习记录，共六份 Markdown。

学习模式与当前文档保留在 URL 参数中。练习进度只保存在当前浏览器的当前账号下，不同步到其他设备。发音使用浏览器 SpeechSynthesis，需要设备提供英语语音；不支持或播放失败时显示提示。

## 数据和权限

英语项目作为城堡下的内容目录，继承城堡授权，不添加独立项目授权。管理员通过现有内容管理页面编辑课程文档，访客只读。交互词库由 `frontend/src/englishModel.ts` 维护，修改 Markdown 不自动更改交互题库。

执行 `npm run db:seed:english` 只补建缺失英语节点；默认初始化的城堡 seed 也会创建英语内容。重复执行不覆盖已有文档正文和排序。无需 schema 迁移。

## 验证

- 专项测试：`npx tsx --test backend/test/castle.test.ts frontend/test/englishModel.test.ts`。
- 浏览器验收：`node scripts/verify-english-browser.mjs`，自动创建并清除仅授权城堡的临时访客。
- 浏览器证据：`output/playwright/english-result.json` 和桌面/手机各五张截图。
- 浏览器验收使用语音替身检查英文参数；不声称验证实际扬声器声音。
