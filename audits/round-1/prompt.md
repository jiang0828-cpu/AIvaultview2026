# Round 1 Gate Prompt

You are a fresh independent gate reviewer with no build history.
Review candidate b6ecf403d6bc712443799bc7fe1c7a28973d9c6b in the detached snapshot and evidence pack, never the changing main checkout. Do not edit candidate files, commit, publish, deploy, or launch another reviewer.

## What the user will do with it

In the user's words: “用 marathon skill，优化并完善结构世界板块，并完善各模块内容，直至可以交付，先生成标准和提示词，再执行，最后审核确认”

They will: 在局域网打开“爱的城堡”，进入“解构世界”-科技特长（专业），使用成长计划、阶段方案、成果展示和专业成长记录来安排学习、记录实践、整理证据并展示作品。

Wrong if: 四类资料只剩标题或空洞说明；用户无法在栏目之间切换、返回或刷新后保持位置；移动端溢出、访客获得编辑权限，或测试未覆盖核心流程。

## Review inputs

- Read CHARTER.md, PROMPTS.md, research/BRIEF.md, research/DECONSTRUCT_WORLD_STANDARD.md.
- Start with audits/round-1/evidence/EVIDENCE.md and CHANGED.md.
- The reference DOCX is summarized in research/BRIEF.md; inspect the source only if a claim needs verification.
- Format benchmark: a usable Chinese knowledge workspace where the first screen explains location and next step, templates are directly fillable, growth has visible progress, and desktop/mobile work cleanly.

## Required review

Use the live LAN site as a first-time user for at least the main path: open the home URL, enter the castle project, enter the 解构世界 folder, switch all four tabs, open each template, return to the folder and project, refresh, and inspect at desktop and 390px. Recheck the evidence claims. Review content closure, four-template correspondence, navigation, invalid folder fallback, visitor/admin permissions, topics, keyboard focus, text size, overflow, and visible lag.

List problems first in severity order. For every problem give location, user impact, minimal fix, estimate, and likely wider class. Mark each CHARTER user problem FIXED or NOT FIXED. State the largest remaining gap. Score every rubric key from 0 to 10:

accuracy, coverage, visual_design, phone, speed, interaction, maintainability

Map_dataviz is authorized n/a. End with exactly:

REVIEWER: <actual label>
ARTIFACT: b6ecf403d6bc712443799bc7fe1c7a28973d9c6b
SCORES: accuracy=<n>, coverage=<n>, visual_design=<n>, phone=<n>, speed=<n>, interaction=<n>, maintainability=<n>
VERDICT: PASS|FAIL critical=<integer> major=<integer>
USE: yes|no
