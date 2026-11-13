import type { Prisma } from "@prisma/client";

export const learningBasics = {
  title: "基本信息",
  summary: "先了解学习者的基础、兴趣、目标与可用时间，再安排通识、专业和运动。",
  topics: ["family", "planning"],
  documentTitle: "基本信息与安排依据",
  description: `<!-- LEARNING_BASELINE_V1 -->
# 基本信息与安排依据

本页是通识、专业、运动的共同参考。仅填写安排所需信息；留空表示待了解，不作推断。本项目已授权成员可见。

## 1. 认识学习者

| 项目 | 内容 |
| --- | --- |
| 称呼 | |
| 年龄段 / 年级（选填） | |
| 兴趣与喜欢的活动 | |
| 擅长的事情与已有成果 | |
| 希望获得的支持 | |

## 2. 当前基础与目标

| 板块 | 当前基础 | 近期目标 | 长期方向 | 可观察的完成标准 |
| --- | --- | --- | --- | --- |
| 通识 | | | | |
| 专业 | | | | |
| 运动 | | | | |

## 3. 时间、条件与安排边界

| 项目 | 内容 |
| --- | --- |
| 工作日可用时段与单次时长 | |
| 周末可用时段与单次时长 | |
| 作息、休息与家庭安排 | |
| 可用的资料、器材与场地 | |
| 陪伴者与可提供的支持 | |
| 不适合的安排 / 需要暂停的情况 | |

## 4. 更新与复盘

| 最近确认日期 | 下次回顾日期 | 本次变化 | 需要同步调整的安排 |
| --- | --- | --- | --- |
| | | | |

## 共同使用规则

1. 先核对当前基础与本人意愿，再选择内容；已有课程和资料是资源，不代表必须全部完成。
2. 目标、难度、频次与单次时长均以本页已确认的信息为依据。未填写的条件先确认，不虚构时间、能力或训练量。
3. 通识优先关联兴趣与真实问题；专业按已有基础选择阶段与实践任务；运动遵守本人提供的限制与暂停条件。
4. 新安排写明：参考哪条信息、做什么、何时做、如何判断完成、何时回顾。
5. 基本信息发生变化后，回看三个板块已有安排，标记需要调整的内容；保留原始记录，不把计划当成已完成的事实。
`,
};

export async function ensureLearningBasics(tx: Prisma.TransactionClient, projectId: number) {
  const folder = await tx.content.findFirst({ where: { parentId: projectId, type: "folder", title: learningBasics.title } })
    ?? await tx.content.create({ data: { parentId: projectId, scene: "life", type: "folder", title: learningBasics.title,
      description: learningBasics.summary, topics: learningBasics.topics, sortOrder: 0 } });
  const document = await tx.content.findFirst({ where: { parentId: folder.id, type: "text", OR: [
    { title: learningBasics.documentTitle }, { description: { contains: "<!-- LEARNING_BASELINE_V1 -->" } },
  ] } }) ?? await tx.content.create({ data: { parentId: folder.id, scene: "life", type: "text", title: learningBasics.documentTitle,
    description: learningBasics.description, topics: learningBasics.topics, sortOrder: 0 } });
  for (const [sortOrder, title] of ["基本信息", "通识", "专业", "运动"].entries()) {
    await tx.content.updateMany({ where: { parentId: projectId, type: "folder", title, sortOrder: { not: sortOrder } }, data: { sortOrder } });
  }
  return { folderId: folder.id, documentId: document.id };
}
