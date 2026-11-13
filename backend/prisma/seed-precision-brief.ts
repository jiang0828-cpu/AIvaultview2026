import type { PrismaClient } from '@prisma/client';
import { precisionBriefProjectMarker, precisionBriefProjectTitle } from '../src/precisionBriefSchema.js';

const documents = [
  { title: '项目规则｜消息、关注点与点评', marker: '<!-- PRECISION_BRIEF_RULES -->', text: '# PM·每日行业简报\n\n每日北京时间09:00生成，普通期次采集前24小时，首期最多回看7天并明确标注。五栏依次为世和动态、同行与竞对、监管与支付、科学与突破、上下游伙伴。每栏最多3条，每条标题、消息、关注点和业务点评合计最多300字。\n\n事实与点评分别呈现；不预设世和与Natera或其他机构存在合作，仅按核实公告描述关系。没有可靠新增时明确显示“本时窗未发现经核实新增”，不拿旧闻凑数。' },
  { title: '来源与采集规范', marker: '<!-- PRECISION_BRIEF_SOURCES -->', text: '# 来源与采集规范\n\n官方公告、监管审批原文、财报、注册临床试验和论文优先，主流医药财经媒体补充。关键监管、临床与财务消息应回到一手记录核对。每条保留来源机构、发布日期、访问时间和原文链接，转载不算独立证据。未知发布日期不补造。\n\n范围包括肿瘤NGS、MRD、IVD、早筛、液体活检、多组学、医疗AI、诊疗及支付。基因加等企业实体未确认时不能混用近似名称。采集任务保留检索范围与失败说明。' },
  { title: '调度与质检说明', marker: '<!-- PRECISION_BRIEF_AUTOMATION -->', text: '# 调度与质检说明\n\n由Codex独立调度五类任务，主编核对日期、来源、重复事件和业务点评。通过校验才事务发布当前版；失败保留上一版并写运行记录。当前版覆盖展示，原始运行保留供项目编辑者与管理员检查。\n\n页面重跑只排入待执行队列，由下一次Codex运行或手动启动调度消费；不是网页后端自己调用模型。查看运行日志不等于已经启动采集。本地计划需要电脑与Codex应用可用；启动失败或休眠不会虚构完成状态。普通读者只能阅读已发布当前版，发布、重跑、回退仅限管理员。' },
];

export async function seedPrecisionBrief(db: PrismaClient) {
  return db.$transaction(async tx => {
    let created = 0;
    const marked = await tx.content.findMany({ where: { description: { contains: precisionBriefProjectMarker } } });
    if (marked.length > 1) throw new Error('Duplicate precision brief project marker; no changes applied.');
    let project = marked[0];
    if (project && (!project.isProject || project.type !== 'folder' || project.scene !== 'work')) throw new Error('Incompatible precision brief project; preserved.');
    if (project) {
      const parent = project.parentId ? await tx.content.findUnique({ where: { id: project.parentId } }) : null;
      if (!parent || parent.parentId !== null || parent.isProject || parent.type !== 'folder' || parent.scene !== 'work') throw new Error('Precision brief must belong to a work scene root; preserved.');
    }
    if (!project) {
      const roots = await tx.content.findMany({ where: { title: '事业工作', type: 'folder', scene: 'work', parentId: null, isProject: false } });
      if (roots.length > 1) throw new Error('Ambiguous work scene; no changes applied.');
      const scene = roots[0] ?? await tx.content.create({ data: { title: '事业工作', type: 'folder', scene: 'work', sortOrder: 3 } });
      if (!roots.length) created++;
      if (await tx.content.findFirst({ where: { parentId: scene.id, title: precisionBriefProjectTitle } })) throw new Error('Unmarked project title conflict; preserved.');
      project = await tx.content.create({ data: { title: precisionBriefProjectTitle, type: 'folder', isProject: true, scene: 'work', parentId: scene.id, topics: ['精准医疗', 'AI'], sortOrder: 8,
        description: `${precisionBriefProjectMarker}\n\n以事实、关注点和业务点评跟踪精准医疗行业，五类专题独立调研，通过来源与日期质检后更新当前日报。` } });
      created++;
    }
    for (const [index, document] of documents.entries()) {
      const existing = await tx.content.findMany({ where: { parentId: project.id, description: { contains: document.marker } } });
      if (existing.length > 1 || existing.some(row => row.type !== 'text')) throw new Error('Precision brief document marker conflict; preserved.');
      if (existing.length) continue;
      if (await tx.content.findFirst({ where: { parentId: project.id, title: document.title } })) throw new Error('Unmarked precision brief document title conflict; preserved.');
      await tx.content.create({ data: { title: document.title, type: 'text', scene: 'work', parentId: project.id, description: `${document.marker}\n\n${document.text}`, topics: ['精准医疗', 'AI'], sortOrder: index } });
      created++;
    }
    return { projectId: project.id, created };
  });
}
