UPDATE Content
SET title = '欢迎来到藏览',
    description = replace(description, '钥藏是这些资料的共同归处。', '藏览是这些资料的共同归处，也是一扇可以对外展示的内容窗口。'),
    updatedAt = CURRENT_TIMESTAMP
WHERE title = '欢迎来到钥藏';

UPDATE Content
SET description = replace(description, '钥藏 / VaultFolio', '藏览 / VaultView'),
    updatedAt = CURRENT_TIMESTAMP
WHERE description LIKE '%钥藏 / VaultFolio%';
