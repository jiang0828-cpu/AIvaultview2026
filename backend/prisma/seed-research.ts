import type { PrismaClient } from '@prisma/client';
import { researchDefinitions, researchProjectMarker, researchPrompt } from '../src/researchSchema.js';
import { researchTaskView } from '../src/research.js';

export const researchProjectTitle = '市场调研｜四维子代理工作台';
const tutorialMarker = '<!-- MARKET_RESEARCH_TUTORIAL -->';
export const researchTutorial = `${tutorialMarker}
# 四代理市场调研工作流程

这是一套人工分派、人工核验、证据归并的工作流程。工作台不连接模型或任务 API，不会自动启动子代理，也不会伪装已经完成调研。

## 1. 确定研究边界
新建调研轮次，填写具体产品、目标市场、地区、时间范围和目标决策。例如，应分别写明要验证的需求、可接受成本、支付方与进入门槛。空白模板不代表已有研究结果。

## 2. 分派四个专题
四个任务分别覆盖宏观环境、产品技术、竞品信息、临床或真实用户需求。检查每个提示词，补充数据截止日期和输入资料，复制到你选用的外部 AI 对话或交给人工研究者。自行执行与跟进，工作台中的“进行中”仅为人工状态记录。

## 3. 回填报告和证据
保存外部研究者的完整报告，逐条建立来源台账：来源编号、标题、机构、发布日期（无法确认可填“未知”）、原文 HTTP(S) 地址与支持内容。检查原始页面后才勾选人工核实。不要把搜索摘要、转载数量或模型口吻当作真实性证据。

每个任务录入 3—8 条类型化结论，区分已核实事实、多来源一致判断、单一来源判断、分析推演和未验证假设。结论关联本任务来源编号；多来源判断至少关联两项并人工确认独立性；事实只能引用已核实来源。没有真实访谈就不能声称完成了临床或用户访谈。

## 4. 提交前检查
填写数据截止日期、研究局限与待验证问题。日期和来源应相符，不得以示例或待填写文字提交。依次将任务设为待分派、进行中、已提交。人工审核可将已提交任务设为已审核。已提交内容需修改时，先重开；旧版本会保留，重开也保留原报告供继续编辑。

## 5. 归并和人工总控
四类任务全部提交后生成证据汇总。系统只将已录入结论按市场机会、目标用户、技术可行性、竞争格局等维度归并，引用形如 [task#任务编号/来源编号]，不自动判断市场是否值得进入。核查各判断与证据，再由总控填写建议、风险和进一步验证计划，最后标记人工已审核。

子任务、研究对象或目标变化会使已有报告过期，需重新归并并审核。更改研究对象或目标前，先将四个任务重开为草稿，避免沿用旧对象的研究结论。自定义提示词不会被自动覆盖。

## 6. 导出与归档
导出 Markdown 会带上报告状态、类型化结论、来源台账和局限。未完成或过期报告会明确标注，不能当作已审核结论发布。归档保留整个轮次、任务和历史，仅可阅读和导出。不要在资料中填写账号密码、密钥或未获授权的个人信息。
`;

export async function seedResearch(db: PrismaClient) {
  return db.$transaction(async tx => {
    let createdContent = 0;
    let createdStudies = 0;
    let createdTasks = 0;
    const marked = await tx.content.findMany({ where: { description: { contains: researchProjectMarker } } });
    if (marked.length > 1) throw new Error('Market research marker is duplicated; no changes were applied.');
    let project = marked[0];
    if (project && (!project.isProject || project.scene !== 'work' || project.type !== 'folder'))
      throw new Error('Market research marker belongs to an incompatible content record; no changes were applied.');
    if (project) {
      const parent = project.parentId ? await tx.content.findUnique({ where: { id: project.parentId } }) : null;
      if (!parent || parent.parentId !== null || parent.isProject || parent.scene !== 'work' || parent.type !== 'folder')
        throw new Error('Market research project must belong directly to a work scene root; no changes were applied.');
    }
    if (!project) {
      const scenes = await tx.content.findMany({ where: { title: '事业工作', scene: 'work', parentId: null, type: 'folder', isProject: false } });
      if (scenes.length > 1) throw new Error('Work scene is ambiguous; no changes were applied.');
      const scene = scenes[0] ?? await tx.content.create({ data: { title: '事业工作', scene: 'work', type: 'folder', sortOrder: 3 } });
      if (!scenes.length) createdContent++;
      const conflict = await tx.content.findFirst({ where: { title: researchProjectTitle, parentId: scene.id } });
      if (conflict) throw new Error('An unmarked project uses the market research title; no changes were applied.');
      project = await tx.content.create({ data: { title: researchProjectTitle, isProject: true, type: 'folder', scene: 'work', parentId: scene.id,
        description: `${researchProjectMarker}\n\n四类专题独立调研，人工分派与核验，证据归并后形成总控报告。`, topics: ['长期性', 'business', 'AI'], sortOrder: 7 } });
      createdContent++;
    }
    const tutorials = await tx.content.findMany({ where: { parentId: project.id, description: { contains: tutorialMarker } } });
    if (tutorials.length > 1) throw new Error('Market research tutorial marker is duplicated; no changes were applied.');
    if (!tutorials.length) {
      if (await tx.content.findFirst({ where: { parentId: project.id, title: '使用指南｜四代理调研与总控审核' } }))
        throw new Error('An unmarked tutorial uses the research tutorial title; no changes were applied.');
      await tx.content.create({ data: { title: '使用指南｜四代理调研与总控审核', type: 'text', scene: 'work', parentId: project.id, description: researchTutorial, topics: ['business', 'AI'], sortOrder: 0 } });
      createdContent++;
    }
    let study = await tx.researchStudy.findFirst({ where: { projectId: project.id }, orderBy: { id: 'asc' } });
    if (!study) {
      study = await tx.researchStudy.create({ data: { projectId: project.id, title: '首次调研｜通用模板',
        tasks: { create: researchDefinitions.map(item => ({ kind: item.kind, title: item.title, prompt: researchPrompt(item.kind, '', ''), sources: [], conclusions: [] })) } } });
      createdStudies++;
      createdTasks += 4;
      for (const task of await tx.researchTask.findMany({ where: { studyId: study.id } }))
        await tx.researchTaskVersion.create({ data: { taskId: task.id, version: task.revision, snapshot: researchTaskView(task) as unknown as import('@prisma/client').Prisma.InputJsonValue } });
    }
    return { projectId: project.id, studyId: study.id, created: createdContent + createdStudies + createdTasks, createdContent, createdStudies, createdTasks };
  }, { timeout: 15000 });
}
