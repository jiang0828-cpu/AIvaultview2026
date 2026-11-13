import { BookOpen, Check, MessageCircle, Volume2 } from "lucide-react";
import type { PracticeProgress } from "./englishAudio";
import { englishAudioKey } from "./englishAudio";

export function EnglishPractice({ text, translation, progress, onSpeak, onComplete }: {
  text: string; translation: string; progress: PracticeProgress;
  onSpeak: (text: string) => void; onComplete: (text: string, step: "said" | "read") => void;
}) {
  const current = progress[englishAudioKey(text)];
  return <section className="english-practice" aria-label="听说读练习">
    <header><h3>听 · 说 · 读</h3><span role="status">{current?.read ? "本条练习已完成" : "一步一步，开口试试"}</span></header>
    <p className="english-practice-text" lang="en">{text}</p><p className="english-practice-translation">{translation}</p>
    <ol>
      <li><button className="english-secondary" onClick={() => onSpeak(text)}>{current?.heard ? <Check size={18} /> : <Volume2 size={18} />}听一听</button></li>
      <li><button className="english-secondary" disabled={!current?.heard || current.said} onClick={() => onComplete(text, "said")}>{current?.said ? <Check size={18} /> : <MessageCircle size={18} />}{current?.said ? "已跟读" : "我跟读了"}</button></li>
      <li><button className="english-secondary" disabled={!current?.said || current.read} onClick={() => onComplete(text, "read")}>{current?.read ? <Check size={18} /> : <BookOpen size={18} />}{current?.read ? "已朗读" : "我读过了"}</button></li>
    </ol>
    <p className="english-practice-caption">{!current?.heard ? "先听完整发音。" : !current.said ? "模仿发音说一遍，再确认跟读。" : !current.read ? "看着英文自己读一遍，再确认朗读。" : "太好了，换一个词或下一句继续吧。"} 跟读与朗读由自己或陪练确认，不录音。</p>
  </section>;
}
