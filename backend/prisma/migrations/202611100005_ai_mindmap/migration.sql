UPDATE Content
SET sortOrder = CASE title
  WHEN '课程文档｜AI 使用技能及技巧分享完整讲义' THEN 1
  WHEN '课件展示｜AI 工作流八讲' THEN 2
  WHEN '长图展示｜AI 使用技能路线图' THEN 3
  WHEN '动画视频｜AI 工作流四章导览' THEN 4
  ELSE sortOrder
END,
updatedAt = CURRENT_TIMESTAMP
WHERE parentId IN (
  SELECT id FROM Content
  WHERE title = '项目04｜AI 使用技能及技巧分享｜系列课程'
);
