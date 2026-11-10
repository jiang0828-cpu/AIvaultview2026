-- Rename the four seeded project trees without replacing content or changing IDs.
WITH RECURSIVE project_nodes(id) AS (
  SELECT id FROM Content WHERE type = 'folder' AND title IN (
    '案例01｜中国高铁运行现状及盈亏分析',
    '案例02｜mRNA 肿瘤药物研究及开发进展',
    '案例03｜南京周边游｜高铁三小时圈',
    '案例04｜AI 使用技能及技巧分享｜系列课程'
  )
  UNION
  SELECT child.id FROM Content AS child
  JOIN project_nodes AS parent ON child.parentId = parent.id
)
UPDATE Content
SET title = replace(title, '案例', '项目'),
    description = replace(description, '案例', '项目'),
    updatedAt = CURRENT_TIMESTAMP
WHERE id IN (SELECT id FROM project_nodes);
