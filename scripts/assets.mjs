import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import sharp from "sharp";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
const target = resolve("backend/media/demo");
await mkdir(target, { recursive: true });
const slides = [
  [
    "01",
    "构建你的知识收藏",
    "把灵感留下，让知识再次发生。",
    "#e9efea",
    "#245e4f",
  ],
  ["02", "为内容建立秩序", "收集 / 分类 / 连接", "#eaeef5", "#465e8c"],
  [
    "03",
    "回到值得重读的地方",
    "让每一次翻阅，都带来新的理解。",
    "#f4e9e9",
    "#94565f",
  ],
];
for (let index = 0; index < slides.length; index++) {
  const [number, title, subtitle, bg, ink] = slides[index];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="810"><rect width="1440" height="810" fill="${bg}"/><path d="M1000 0H1440V810H1130Z" fill="${ink}" opacity=".08"/><rect x="94" y="94" width="48" height="48" rx="6" fill="${ink}"/><path d="M107 118h22m-11-11v22" stroke="white" stroke-width="3"/><text x="160" y="129" font-family="Microsoft YaHei,Arial" font-size="29" fill="${ink}">藏览 / VaultView</text><text x="94" y="335" font-family="Arial" font-size="26" fill="${ink}">CONTENT SPACE / ${number}</text><text x="90" y="441" font-family="Microsoft YaHei,Arial" font-size="68" font-weight="bold" fill="#202a28">${title}</text><text x="96" y="514" font-family="Microsoft YaHei,Arial" font-size="30" fill="${ink}">${subtitle}</text><path d="M96 648H1344" stroke="${ink}" opacity=".25"/><text x="96" y="704" font-family="Microsoft YaHei,Arial" font-size="22" fill="${ink}">收藏、整理，也让内容被看见</text><text x="1300" y="704" font-family="Arial" font-size="22" fill="${ink}">${number}</text></svg>`;
  await sharp(Buffer.from(svg))
    .png()
    .toFile(resolve(target, `slide-${index + 1}.png`));
  if (index === 0)
    await sharp(Buffer.from(svg)).png().toFile(resolve(target, "cover.png"));
}
const doc = await PDFDocument.create();
const font = await doc.embedFont(StandardFonts.Helvetica);
for (let index = 1; index <= 3; index++) {
  const page = doc.addPage([720, 460]);
  const image = await doc.embedPng(
    await sharp(resolve(target, `slide-${index}.png`)).toBuffer(),
  );
  page.drawImage(image, { x: 0, y: 55, width: 720, height: 405 });
  page.drawText(`VaultView / Local sample document / Page ${index}`, {
    x: 35,
    y: 25,
    size: 10,
    font,
    color: rgb(0.3, 0.35, 0.33),
  });
}
await writeFile(resolve(target, "guide.pdf"), await doc.save());
const aiTarget = resolve("backend/media/cases/ai");
await mkdir(aiTarget, { recursive: true });
const aiSlides = [
  ["01", "AI 工作流八讲", "从模糊任务到可交付结果", "#e8f0ec", "#245e4f"],
  [
    "02",
    "先拆任务，再写提示词",
    "目标 / 背景 / 约束 / 验收",
    "#edf0f6",
    "#465e8c",
  ],
  [
    "03",
    "研究与数据必须可复核",
    "证据表 · 公式 · 独立验证",
    "#f5ede5",
    "#9b6b45",
  ],
  [
    "04",
    "把一次对话变成团队能力",
    "模板 / SOP / 安全 / 复盘",
    "#f1e9ef",
    "#815573",
  ],
];
const aiLessonSlides = [
  ["05", "01 任务拆解", "目标 / 背景 / 约束 / 验收", "#e9f1eb", "#2f6b58"],
  ["06", "02 提示词与迭代", "结构 / 样例 / 具体反馈", "#eef1f7", "#536b9a"],
  ["07", "03 文档与知识库", "版本 / 证据 / 可追溯", "#f6efe8", "#a06e48"],
  ["08", "04 研究与核验", "事实 / 推断 / 假设", "#f3eaf0", "#875d7b"],
  ["09", "05 数据与决策", "单位 / 公式 / 敏感性", "#eaf1f1", "#477b7a"],
  ["10", "06 一稿多形态", "讲义 / PPT / 长图 / 视频", "#f3efdf", "#887440"],
  ["11", "07 编程与自动化", "最小变更 / 测试 / 回退", "#edf0f4", "#5c7187"],
  ["12", "08 团队规范与复盘", "数据分级 / 复核 / SOP", "#f2e9e7", "#915f58"],
];
for (const [number, title, subtitle, bg, ink] of [
  ...aiSlides,
  ...aiLessonSlides,
]) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="810"><rect width="1440" height="810" fill="${bg}"/><circle cx="1220" cy="140" r="170" fill="${ink}" opacity=".08"/><rect x="96" y="88" width="54" height="54" rx="8" fill="${ink}"/><path d="M109 115h28m-14-14v28" stroke="white" stroke-width="4"/><text x="170" y="126" font-family="Microsoft YaHei,Arial" font-size="30" fill="${ink}">藏览 / AI 使用技能</text><text x="96" y="300" font-family="Arial" font-size="26" fill="${ink}">SERIES COURSE / ${number}</text><text x="92" y="420" font-family="Microsoft YaHei,Arial" font-size="70" font-weight="bold" fill="#202a28">${title}</text><text x="98" y="500" font-family="Microsoft YaHei,Arial" font-size="34" fill="${ink}">${subtitle}</text><path d="M98 650H1340" stroke="${ink}" opacity=".24"/><text x="98" y="708" font-family="Microsoft YaHei,Arial" font-size="22" fill="${ink}">示范 · 拆解 · 练习 · 复盘</text><text x="1290" y="708" font-family="Arial" font-size="22" fill="${ink}">${number}</text></svg>`;
  await sharp(Buffer.from(svg))
    .png()
    .toFile(resolve(aiTarget, `slide-${Number(number)}.png`));
}
const roadmapSections = [
  ["01", "先拆任务", "目标 · 背景 · 约束 · 验收", "#e8f0ec", "#245e4f"],
  ["02", "再做研究", "来源 · 证据 · 事实核验", "#edf0f6", "#465e8c"],
  ["03", "多形态产出", "文档 · PPT · 长图 · 视频", "#f5ede5", "#9b6b45"],
  ["04", "沉淀成 SOP", "模板 · 安全 · 复盘 · 复用", "#f1e9ef", "#815573"],
];
const roadmapRows = roadmapSections
  .map(
    ([number, title, subtitle, bg, ink], index) =>
      `<rect x="76" y="${570 + index * 620}" width="928" height="500" rx="18" fill="${bg}"/><rect x="112" y="${614 + index * 620}" width="74" height="42" rx="8" fill="${ink}"/><text x="130" y="${644 + index * 620}" font-family="Arial" font-size="22" fill="white">${number}</text><text x="112" y="${760 + index * 620}" font-family="Microsoft YaHei,Arial" font-size="52" font-weight="bold" fill="#202a28">${title}</text><text x="112" y="${842 + index * 620}" font-family="Microsoft YaHei,Arial" font-size="30" fill="${ink}">${subtitle}</text><path d="M112 ${958 + index * 620}H968" stroke="${ink}" opacity=".25"/><text x="112" y="${1016 + index * 620}" font-family="Microsoft YaHei,Arial" font-size="22" fill="${ink}">${index === 0 ? "把模糊需求变成可执行任务" : index === 1 ? "所有关键结论都能回到来源" : index === 2 ? "同一份知识适配不同传播场景" : "让一次经验变成团队能力"}</text>`,
  )
  .join("");
const roadmapSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="3180"><rect width="1080" height="3180" fill="#fbfcfa"/><text x="76" y="130" font-family="Microsoft YaHei,Arial" font-size="28" fill="#245e4f">藏览 / AI 使用技能分享</text><text x="76" y="275" font-family="Microsoft YaHei,Arial" font-size="66" font-weight="bold" fill="#202a28">从会问到能交付</text><text x="76" y="355" font-family="Microsoft YaHei,Arial" font-size="30" fill="#657161">一张图看懂八讲课程的统一工作流</text><path d="M76 430H1004" stroke="#d8e1d8"/>${roadmapRows}<text x="76" y="3050" font-family="Microsoft YaHei,Arial" font-size="24" fill="#70836b">示范 · 拆解 · 练习 · 复盘 | 事实 · 推断 · 假设 · 待核验</text></svg>`;
await sharp(Buffer.from(roadmapSvg))
  .png()
  .toFile(resolve(aiTarget, "course-roadmap.png"));
const videoResult = spawnSync(
  ffmpegInstaller.path,
  [
    "-y",
    "-framerate",
    "0.5",
    "-stream_loop",
    "7",
    "-i",
    resolve(aiTarget, "slide-%d.png"),
    "-vf",
    "scale=960:540,zoompan=z='min(zoom+0.0015,1.08)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=48:s=960x540:fps=24,drawbox=x=0:y=ih-8:w=iw:h=8:color=0x245e4f:t=fill",
    "-t",
    "32",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    resolve(aiTarget, "course-intro.mp4"),
  ],
  { encoding: "utf8", windowsHide: true },
);
if (videoResult.status !== 0)
  throw new Error(
    `Could not generate AI course video: ${videoResult.stderr?.slice(-1000)}`,
  );
const result = spawnSync(
  ffmpegInstaller.path,
  [
    "-y",
    "-loop",
    "1",
    "-i",
    resolve(target, "cover.png"),
    "-f",
    "lavfi",
    "-i",
    "anullsrc=channel_layout=stereo:sample_rate=44100",
    "-vf",
    "scale=960:540,drawbox=x=0:y=ih-8:w=iw:h=8:color=0x245e4f:t=fill",
    "-t",
    "8",
    "-r",
    "24",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-movflags",
    "+faststart",
    "-shortest",
    resolve(target, "intro.mp4"),
  ],
  { encoding: "utf8", windowsHide: true },
);
if (result.status !== 0)
  throw new Error(
    `Could not generate local sample video: ${result.stderr?.slice(-1000)}`,
  );
console.log("Local slide images, PDF and playable MP4 generated.");
