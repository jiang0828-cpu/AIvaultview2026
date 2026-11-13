import { useCallback, useEffect, useRef, useState } from "react";
import { englishAudioPath } from "./englishAudio";

export function useEnglishAudio(onHeard: (text: string) => void) {
  const [rate, setRate] = useState(1);
  const [playing, setPlaying] = useState("");
  const [notice, setNotice] = useState("");
  const active = useRef<HTMLAudioElement | null>(null);
  const utterance = useRef<SpeechSynthesisUtterance | null>(null);
  const sequence = useRef(0);
  const timeout = useRef<ReturnType<typeof setTimeout>>();
  const heard = useRef(onHeard);
  heard.current = onHeard;
  const stop = useCallback(() => {
    sequence.current++;
    clearTimeout(timeout.current);
    if (active.current) {
      active.current.onended = null;
      active.current.onerror = null;
      active.current.pause();
      active.current.removeAttribute("src");
      active.current.load();
      active.current = null;
    }
    if (utterance.current) {
      utterance.current.onend = null;
      utterance.current.onerror = null;
      utterance.current = null;
      window.speechSynthesis?.cancel();
    }
    setPlaying("");
    setNotice("");
  }, []);
  useEffect(() => {
    const hide = () => { if (document.hidden) stop(); };
    document.addEventListener("visibilitychange", hide);
    return () => { document.removeEventListener("visibilitychange", hide); stop(); };
  }, [stop]);

  function speak(text: string) {
    stop();
    const current = sequence.current;
    setNotice("");
    setPlaying(text);
    const finished = () => {
      if (sequence.current !== current) return;
      clearTimeout(timeout.current);
      setPlaying("");
      heard.current(text);
    };
    const failed = () => {
      if (sequence.current !== current) return;
      stop();
      setNotice("暂时无法发音，请检查手机媒体音量后重试，也可以请家人带读。");
    };
    let fallbackStarted = false;
    const fallback = () => {
      if (sequence.current !== current || fallbackStarted) return;
      fallbackStarted = true;
      clearTimeout(timeout.current);
      if (active.current) {
        active.current.onended = null;
        active.current.onerror = null;
        active.current.pause();
        active.current = null;
      }
      if (!("speechSynthesis" in window)) { failed(); return; }
      try {
        const phrase = new SpeechSynthesisUtterance(text);
        utterance.current = phrase;
        phrase.lang = "en-US";
        phrase.rate = rate === 1 ? 0.85 : 0.65;
        const voice = window.speechSynthesis.getVoices().find(item => item.lang.startsWith("en"));
        if (voice) phrase.voice = voice;
        phrase.onend = finished;
        phrase.onerror = failed;
        timeout.current = setTimeout(failed, 20000);
        window.speechSynthesis.speak(phrase);
      } catch { failed(); }
    };
    try {
      const audio = new Audio(englishAudioPath(text));
      active.current = audio;
      audio.playbackRate = rate;
      audio.onended = finished;
      audio.onerror = fallback;
      audio.onplaying = () => {
        if (sequence.current === current) clearTimeout(timeout.current);
      };
      timeout.current = setTimeout(fallback, 10000);
      void audio.play().catch(fallback);
    } catch { fallback(); }
  }
  return { speak, stop, playing, notice, rate, setRate };
}
