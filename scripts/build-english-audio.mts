import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import ffmpeg from "@ffmpeg-installer/ffmpeg";
import { englishAudioTexts, englishAudioKey } from "../frontend/src/englishAudio.js";

if (process.platform !== "win32") throw new Error("Regenerating the audio pack requires Windows with an en-US speech voice. The included MP3 files work on all platforms.");
const scratch = await mkdtemp(join(tmpdir(), "vaultfolio-english-"));
const output = resolve("frontend/public/english-audio");
try {
  await mkdir(output, { recursive: true });
  const input = join(scratch, "phrases.json");
  await writeFile(input, JSON.stringify(englishAudioTexts.map(text => ({ text, key: englishAudioKey(text) }))));
  execFileSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", resolve("scripts/synthesize-english.ps1"), "-InputPath", input, "-OutputDirectory", scratch], { windowsHide: true, stdio: "pipe" });
  for (const text of englishAudioTexts) {
    const key = englishAudioKey(text);
    execFileSync(ffmpeg.path, ["-y", "-i", join(scratch, `${key}.wav`), "-codec:a", "libmp3lame", "-b:a", "64k", join(output, `${key}.mp3`)], { windowsHide: true, stdio: "pipe" });
  }
  console.log(`Generated ${englishAudioTexts.length} English audio clips.`);
} finally { await rm(scratch, { recursive: true, force: true }); }
