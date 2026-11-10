-- Keep the existing AI course ordered as document, deck, long image, video, then lessons.
UPDATE Content
SET sortOrder = CASE title
  WHEN '00 课程总览｜从会问到能交付' THEN 4
  WHEN '01 基础｜任务拆解与提示词结构' THEN 5
  WHEN '02 研究｜搜索、资料阅读与事实核验' THEN 6
  WHEN '03 文档｜长文档、知识库与引用' THEN 7
  WHEN '04 数据｜表格、计算与决策支持' THEN 8
  WHEN '05 内容｜课件、讲稿与一稿多用' THEN 9
  WHEN '06 编程｜从自然语言到可测试自动化' THEN 10
  WHEN '07 团队 SOP｜安全、隐私与复盘' THEN 11
  ELSE sortOrder
END,
updatedAt = CURRENT_TIMESTAMP
WHERE parentId IN (
  SELECT id FROM Content WHERE title = '项目04｜AI 使用技能及技巧分享｜系列课程'
);
