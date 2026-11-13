import { alphabet, englishDialogues, englishScenes } from "./englishModel.js";

export const englishAudioKey = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
export const englishAudioTexts = [...new Map([
  ...alphabet.flatMap(word => [word.letter!, word.en]),
  ...englishScenes.flatMap(scene => scene.words.map(word => word.en)),
  ...englishDialogues.flatMap(dialogue => dialogue.lines.map(line => line[1])),
].map(text => [englishAudioKey(text), text])).values()];
export const englishAudioPath = (text: string) => `/english-audio/${englishAudioKey(text)}.mp3`;

export type PracticeProgress = Record<string, { heard: boolean; said: boolean; read: boolean }>;
export function readPracticeProgress(value: string | null): PracticeProgress {
  try {
    const parsed: unknown = JSON.parse(value || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const keys = new Set(englishAudioTexts.map(englishAudioKey));
    return Object.fromEntries(Object.entries(parsed).filter(([key]) => keys.has(key)).map(([key, entry]) => {
      const progress = entry && typeof entry === "object" ? entry : {};
      const heard = "heard" in progress && progress.heard === true;
      const said = heard && "said" in progress && progress.said === true;
      return [key, { heard, said, read: said && "read" in progress && progress.read === true }];
    }));
  } catch { return {}; }
}
