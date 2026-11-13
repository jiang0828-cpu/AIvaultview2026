import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, BookOpen, ChevronLeft, ChevronRight, Volume2, Sparkles, Check, RotateCcw, House } from "lucide-react";
import type { Content } from "./types";
import { alphabet, englishDialogues, englishQuestion, englishScenes, type EnglishWord } from "./englishModel";
import "./english.css";
import { ContentBody } from "./components";
import { api } from "./api";

const views = ["字母卡", "场景词", "二选一", "小对话", "课程文档"] as const;
type View = typeof views[number];

function Illustration({ word }: { word: EnglishWord }) {
  return word.color
    ? <span className="english-swatch" style={{ backgroundColor: word.color }} aria-label={word.zh} />
    : <span className="english-picture" role="img" aria-label={word.zh}>{word.picture}</span>;
}

export function EnglishSpace({ project, userId, onBack, onCastle }: {
  project: Content; userId: number; onBack: () => void; onCastle: () => void;
}) {
  const storageKey = `english-learning:${userId}:${project.id}`;
  const [params, setParams] = useSearchParams();
  const requestedView = params.get("englishView");
  const view: View = views.find(item => item === requestedView) || "字母卡";
  const documents = (project.children || []).filter(item => item.type !== "folder");
  const document = documents.find(item => item.id === Number(params.get("englishDoc"))) || documents[0];
  const [sceneIndex, setSceneIndex] = useState(0);
  const [index, setIndex] = useState(0);
  const [round, setRound] = useState(0);
  const [selection, setSelection] = useState<string | null>(null);
  const [dialogueIndex, setDialogueIndex] = useState(0);
  const [lineIndex, setLineIndex] = useState(0);
  const [notice, setNotice] = useState("");
  const [mastered, setMastered] = useState<string[]>(() => {
    try {
      const value: unknown = JSON.parse(localStorage.getItem(storageKey) || "[]");
      const vocabulary = new Set(englishScenes.flatMap(scene => scene.words.map(word => word.en)));
      return Array.isArray(value) ? [...new Set(value.filter((v): v is string => typeof v === "string" && vocabulary.has(v)))] : [];
    } catch { return []; }
  });
  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(mastered)); }
    catch { setNotice("本次进度可以继续使用，浏览器暂时无法保存。"); }
  }, [mastered, storageKey]);
  useEffect(() => () => { if ("speechSynthesis" in window) window.speechSynthesis.cancel(); }, []);
  useEffect(() => {
    if (view === "课程文档" && document) void api("/log", {
      method: "POST", body: JSON.stringify({ contentId: document.id, action: "view_text" }),
    }).catch(() => {});
  }, [view, document]);
  const scene = englishScenes[sceneIndex];
  const words = view === "字母卡" ? alphabet : scene.words;
  const word = words[index % words.length];
  const question = useMemo(() => englishQuestion(englishScenes[sceneIndex].words, round), [sceneIndex, round]);
  const dialogue = englishDialogues[dialogueIndex];
  const correct = selection === question.answer.en;
  function speak(text: string) {
    if (!("speechSynthesis" in window)) { setNotice("当前浏览器不支持发音，可以请大人带读，或换用支持语音的浏览器。"); return; }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 0.75;
    const voice = window.speechSynthesis.getVoices().find(v => v.lang.startsWith("en"));
    if (voice) utterance.voice = voice;
    utterance.onerror = event => {
      if (event.error !== "canceled" && event.error !== "interrupted") setNotice("暂时无法播放，请检查设备的英语语音和音量，或请大人带读。");
    };
    setNotice("");
    window.speechSynthesis.speak(utterance);
  }
  function changeView(next: View) {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    const nextParams = new URLSearchParams(params);
    nextParams.set("englishView", next);
    setParams(nextParams);
    setIndex(0); setSelection(null); setNotice("");
  }
  function answer(value: string) {
    if (correct) return;
    setSelection(value);
    if (value === question.answer.en) setMastered(items => items.includes(value) ? items : [...items, value]);
  }
  return <section className="english-space" aria-label="英语学习及实战">
    <nav className="english-breadcrumbs" aria-label="英语项目导航">
      <button onClick={onBack}><ArrowLeft size={16} /> 返回通识</button>
      <button onClick={onCastle}><House size={16} /> 爱的城堡</button>
    </nav>
    <header className="english-heading">
      <div><p>HELLO, LITTLE EXPLORER</p><h1>英语学习及实战</h1><span>从第一句 Hello 开始，今天也勇敢开口。</span></div>
      <div className="english-achievement"><Sparkles size={22} /><strong>{mastered.length}</strong><span>个词已答对</span></div>
    </header>
    <nav className="english-modes" aria-label="英语学习模式">{views.map((item, i) =>
      <button key={item} aria-pressed={view === item} onClick={() => changeView(item)}><span>{String(i + 1).padStart(2, "0")}</span>{item}</button>)}</nav>
    {notice && <p className="english-notice" role="status">{notice}</p>}
    {(view === "场景词" || view === "二选一") && <div className="english-scenes" role="group" aria-label="词汇场景">
      {englishScenes.map((s, i) => <button key={s.id} aria-pressed={sceneIndex === i} onClick={() => {
        setSceneIndex(i); setIndex(0); setRound(0); setSelection(null);
        if ("speechSynthesis" in window) window.speechSynthesis.cancel();
      }}>{s.label}</button>)}
    </div>}
    {view === "字母卡" && <div className="english-alphabet" role="group" aria-label="26 个字母">
      {alphabet.map((w, i) => <button key={w.letter} aria-pressed={index === i} onClick={() => setIndex(i)}>{w.letter}<small>{w.letter?.toLowerCase()}</small></button>)}
    </div>}
    {(view === "字母卡" || view === "场景词") && <div className="english-learning-stage">
      <div className="english-flashcard">
        <Illustration word={word} />
        {view === "字母卡" && <div className="english-letter">{word.letter}<span>{word.letter?.toLowerCase()}</span>
          <button className="english-audio" title="听字母名称" aria-label="听字母名称" onClick={() => speak(word.letter!)}><Volume2 size={24} /></button></div>}
        <h2>{word.en}<button className="english-audio" title="听单词" aria-label="听单词" onClick={() => speak(word.en)}><Volume2 size={24} /></button></h2>
        <p>{word.zh}</p>
        <div className="english-paging">
          <button aria-label="上一张" disabled={index === 0} onClick={() => setIndex(i => i - 1)}><ChevronLeft /></button>
          <span>{index + 1} / {words.length}</span>
          <button aria-label="下一张" disabled={index === words.length - 1} onClick={() => setIndex(i => i + 1)}><ChevronRight /></button>
        </div>
      </div>
      <aside className="english-today"><span className="english-label">今天的小任务</span><h3>{view === "字母卡" ? "找一找，名字里的字母" : `说一说，身边的${scene.label}`}</h3>
        <ol><li>看图片，听一遍。</li><li>跟着说，再做一个动作。</li><li>换一张卡，回来再认一次。</li></ol>
        <button className="english-primary" onClick={() => changeView("二选一")}>去试两道题 <ArrowRight size={17} /></button>
        {view === "字母卡" && <p>字母名称与单词首音不总相同；先认识它们，再慢慢学习拼读。</p>}
      </aside>
    </div>}
    {view === "二选一" && <div className="english-quiz">
      <p className="english-label">第 {round + 1} 题 · {scene.label}</p><Illustration word={question.answer} />
      <h2>“{question.answer.zh}”用英语怎么说？</h2>
      <div className="english-options">{question.options.map(option => <button key={`${round}-${option.en}`} disabled={correct}
        className={selection === option.en ? correct ? "correct" : "retry" : ""} onClick={() => answer(option.en)}>{option.en}</button>)}</div>
      <div className="english-feedback" role="status">{selection ? correct ? "答对了！再听一遍，大声说出来。" : "再想一想，你可以重新选择。" : "选一个答案试试。"}</div>
      <div className="english-quiz-actions"><button className="english-secondary" onClick={() => speak(question.answer.en)}><Volume2 size={18} /> {selection && !correct ? "听听提示" : "听一听"}</button>
        <button className="english-primary" disabled={!correct} onClick={() => { setRound(r => r + 1); setSelection(null); }}>下一题 <ArrowRight size={18} /></button></div>
    </div>}
    {view === "小对话" && <div className="english-dialogue">
      <div className="english-scenes" role="group" aria-label="对话场景">{englishDialogues.map((d, i) => <button key={d.title} aria-pressed={dialogueIndex === i} onClick={() => { setDialogueIndex(i); setLineIndex(0); }}>{d.title}</button>)}</div>
      <h2><span aria-hidden="true">{dialogue.picture}</span> {dialogue.title}</h2>
      <ol>{dialogue.lines.map(([who, en, zh], i) => <li key={en} className={lineIndex === i ? "active" : ""}>
        <span className="english-speaker">{who}</span><div><strong>{en}</strong><p>{zh}</p></div>
        <button className="english-audio" aria-label={`听对话第 ${i + 1} 句`} title="听这一句" onClick={() => { setLineIndex(i); speak(en); }}><Volume2 size={22} /></button>
      </li>)}</ol>
      <button className="english-primary" onClick={() => { const next = (lineIndex + 1) % dialogue.lines.length; setLineIndex(next); speak(dialogue.lines[next][1]); }}>换你说下一句 <ArrowRight size={18} /></button>
    </div>}
    {view === "课程文档" && <>
      <nav className="english-documents" aria-label="英语课程文档">{documents.map(doc => <button key={doc.id} aria-current={document?.id === doc.id ? "page" : undefined} onClick={() => {
        const next = new URLSearchParams(params); next.set("englishDoc", String(doc.id)); setParams(next);
      }}><BookOpen size={22} /><span><strong>{doc.title}</strong><small>{doc.topics?.join(" · ")}</small></span><ArrowRight size={18} /></button>)}</nav>
      {document ? <article className="english-document"><ContentBody key={document.id} content={document} /></article> : <p>暂无课程文档。</p>}
    </>}
    <footer className="english-footer"><span><Check size={16} /> 每一个愿意开口的瞬间，都值得记录。</span>
      <button onClick={() => { if (window.confirm("清空本账号在此浏览器的英语练习进度？")) setMastered([]); }}><RotateCcw size={15} /> 重置练习进度</button></footer>
  </section>;
}
