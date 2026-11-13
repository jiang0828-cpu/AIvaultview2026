import type { Content } from "./types.js";

export const englishMarker = "<!-- ENGLISH_LEARNING_PROJECT -->";
export const isEnglishProject = (node: Content) => node.type === "folder" && node.scene === "life" &&
  (node.description.includes(englishMarker) || node.title === "英语学习及实战");

export interface EnglishWord { en: string; zh: string; picture: string; letter?: string; color?: string }
export const alphabet: EnglishWord[] = [
  ["apple", "苹果", "🍎"], ["ball", "球", "⚽"], ["cat", "猫", "🐱"], ["dog", "狗", "🐶"],
  ["egg", "鸡蛋", "🥚"], ["fish", "鱼", "🐟"], ["girl", "女孩", "👧"], ["hat", "帽子", "🎩"],
  ["ice cream", "冰淇淋", "🍦"], ["juice", "果汁", "🧃"], ["kite", "风筝", "🪁"], ["lion", "狮子", "🦁"],
  ["milk", "牛奶", "🥛"], ["nose", "鼻子", "👃"], ["orange", "橙子", "🍊"], ["pig", "小猪", "🐷"],
  ["queen", "女王", "👑"], ["rabbit", "兔子", "🐰"], ["sun", "太阳", "☀️"], ["tree", "树", "🌳"],
  ["umbrella", "雨伞", "☂️"], ["van", "小货车", "🚐"], ["water", "水", "💧"], ["xylophone", "木琴", "🎵"],
  ["yo-yo", "溜溜球", "🪀"], ["zebra", "斑马", "🦓"],
].map(([en, zh, picture], i) => ({ en, zh, picture, letter: String.fromCharCode(65 + i) }));

export const englishScenes: Array<{ id: string; label: string; words: EnglishWord[] }> = [
  { id: "greetings", label: "问候", words: [
    { en: "Hello", zh: "你好", picture: "👋" }, { en: "Goodbye", zh: "再见", picture: "👋" },
    { en: "Thank you", zh: "谢谢", picture: "🎁" }, { en: "Sorry", zh: "对不起", picture: "💛" },
    { en: "Please", zh: "请", picture: "🤲" }, { en: "Yes", zh: "是的", picture: "✅" },
    { en: "No", zh: "不是", picture: "🙅" }, { en: "friend", zh: "朋友", picture: "🤝" },
  ] },
  { id: "colors", label: "颜色", words: [
    ["red", "红色", "#e24a4a"], ["blue", "蓝色", "#287ed1"], ["green", "绿色", "#218748"],
    ["yellow", "黄色", "#f7cd38"], ["white", "白色", "#ffffff"], ["black", "黑色", "#222222"],
    ["pink", "粉色", "#f38eb4"], ["purple", "紫色", "#9456bd"],
  ].map(([en, zh, color]) => ({ en, zh, color, picture: "" })) },
  { id: "animals", label: "动物", words: ["cat", "dog", "fish", "rabbit"].map(en => alphabet.find(w => w.en === en)!).concat([
    { en: "bird", zh: "鸟", picture: "🐦" }, { en: "bear", zh: "熊", picture: "🐻" },
    { en: "duck", zh: "鸭子", picture: "🦆" }, { en: "frog", zh: "青蛙", picture: "🐸" },
  ]) },
  { id: "numbers", label: "数字", words: ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"]
    .map((en, i) => ({ en, zh: ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"][i], picture: String(i + 1) })) },
  { id: "food", label: "食物", words: ["apple", "milk", "egg", "water"].map(en => alphabet.find(w => w.en === en)!).concat([
    { en: "banana", zh: "香蕉", picture: "🍌" }, { en: "bread", zh: "面包", picture: "🍞" },
    { en: "cake", zh: "蛋糕", picture: "🍰" }, { en: "rice", zh: "米饭", picture: "🍚" },
  ]) },
];

export function englishQuestion(words: EnglishWord[], index: number, random = Math.random) {
  if (words.length < 2) throw new Error("A question needs at least two words.");
  const position = ((index % words.length) + words.length) % words.length;
  const answer = words[position];
  const others = words.filter(w => w.en !== answer.en);
  const other = others[Math.floor(random() * others.length)];
  return { answer, options: random() < 0.5 ? [answer, other] : [other, answer] };
}

export const englishDialogues = [
  { title: "见面打招呼", picture: "👋", lines: [["A", "Hello!", "你好！"], ["B", "Hi!", "嗨！"], ["A", "How are you?", "你好吗？"], ["B", "I'm fine, thank you.", "我很好，谢谢。"]] },
  { title: "点心时间", picture: "🍎", lines: [["A", "Apple, please.", "请给我苹果。"], ["B", "Here you are.", "给你。"], ["A", "Thank you.", "谢谢。"], ["B", "You're welcome.", "不客气。"]] },
  { title: "礼貌道歉", picture: "💛", lines: [["A", "Sorry.", "对不起。"], ["B", "It's OK.", "没关系。"], ["A", "Thank you.", "谢谢。"]] },
  { title: "挥手告别", picture: "🌤️", lines: [["A", "Goodbye!", "再见！"], ["B", "See you!", "回头见！"], ["A", "Bye!", "拜拜！"]] },
];
