# 藏览 · 江湖行者

身份为行走江湖、持续求知并愿意分享所得的游侠。品牌保留“藏览 / VaultView”，六场景、项目、内容类型和操作名称保留直接含义。

- 墨色 `#252d2c`：侧栏与正文主色。
- 朱红 `#a33f34`：藏字印章、主要行动与座右铭。
- 青绿 `#38675d`：索引、辅助强调与内容关联。
- 冷白 `#f6f7f5`：阅读底色。标题使用本地宋体字体回退，正文使用系统无衬线字体；不加载远程字体。
- 山水题图：以原图 3:1 比例完整显示，持剑行旅者置于右侧，宽屏左侧留白承载标题；窄桌面与手机在题图下方排布文字，避免裁切画面或压住人物。

座右铭使用“穷则独善其身，达则兼济天下”，注明化用《孟子·尽心上》。原文为“穷则独善其身，达则兼善天下”。参考：[中央纪委网站对原文与通行说法的说明](https://m.ccdi.gov.cn/content/21/6c/20308.html)。这句话作为个人自勉，不冒充孟子原句。

## 控件与细节

共用控件样式集中在 `frontend/src/jianghu-details.css`。静态标签使用细描边和小图标，主题标签按已知领域使用青绿、石青、朱砂或淡金色签；未知主题回退青绿。周期始终排在首位，长期性、阶段性、临时性分别使用无穷、旗帜、沙漏图标，保留文字含义。管理员仍通过下拉选择修改周期，等待与错误信息单独显示。

场景签、内容类型、研究状态、作者主题、旅行标签使用一致的字号、基线、边框和圆角。研究状态保留正向、混合、负向及相邻范围的文字和颜色区别。切换页签以朱砂下划线表示当前页，筛选控件以浅朱选中背景表示已选项。搜索、输入、下拉和编辑弹窗使用一致的焦点提示。标签支持长词换行；手机项目卡片的元数据和操作分行排布。

验证包括首页 21 个项目标签的文字对比度（至少 4.5:1），课程章节切换与幻灯片翻页，以及课程、课件、旅行、研究、人物索引、关系网在桌面与 390/320 像素手机宽度下的布局。管理员周期与编辑弹窗通过隔离的界面预览检查布局，不更改数据库资料。

## 题图

使用内置 `image_gen` 生成，随后使用 Sharp 转为 WebP。静态资源为 `frontend/public/images/jianghu-landscape.webp`（2172 × 724）。不调用外部 CDN；原始图片不改写。

生成提示词：

> Use-case: stylized-concept. Create one refined horizontal 3:1 Chinese ink wash landscape painting as a wide website masthead for 藏览, a personal knowledge/research/project library with a wandering wuxia swordsman identity. Atmospheric yet crisp enough to see real details: layered pale mineral-green mountain ridges, a sinuous river, fine ink-drawn pines on rocky bank, a SINGLE small lone traveler in simple pale cloak and bamboo hat carrying a sheathed sword, on the lower-right stone path gazing across mountains. Calm learned traveler, no combat, no fantasy magic. High-end contemporary literati painting with spare expressive black ink brushwork, cool off-white rice-paper base (#f5f6f3), small cinnabar detail on traveler, restrained jade pigments, charcoal outlines. Composition: left 55 percent is mostly very light unobstructed paper and distant faint mountain washes, all detailed mountains and traveler on right 45 percent, traveler not cropped at bottom. This left negative space is intentional for HTML black title text overlay. No written words, no calligraphy, no signatures, no logos, no border, no UI, no text of any kind, no gradients or glowing orbs. Elegant visible paper grain, not yellow or beige.
