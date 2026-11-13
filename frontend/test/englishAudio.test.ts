import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { englishAudioKey, englishAudioTexts, englishAudioPath, readPracticeProgress } from "../src/englishAudio.js";

test("all curriculum phrases include a nonempty local MP3", () => {
  assert.ok(englishAudioTexts.length > 90);
  for (const text of englishAudioTexts) {
    const path = englishAudioPath(text);
    assert.match(path, /^\/english-audio\/[a-z0-9-]+\.mp3$/);
    const file = readFileSync(new URL(`../public${path}`, import.meta.url));
    assert.ok(file.length > 1000, text);
    assert.ok(file.subarray(0, 3).toString() === "ID3" || file[0] === 0xff, text);
  }
  assert.equal(englishAudioKey("I'm fine, thank you."), "i-m-fine-thank-you");
});

test("practice restoration rejects corrupt, unknown and out-of-order completion", () => {
  for (const value of [null, "no json", "null", "[]", "true"]) assert.deepEqual(readPracticeProgress(value), {});
  assert.deepEqual(readPracticeProgress(JSON.stringify({
    hello: { heard: true, said: true, read: true },
    cat: { heard: false, said: true, read: true },
    dog: { heard: "true", said: true, read: true },
    apple: null,
    unexpected: { heard: true },
  })), {
    hello: { heard: true, said: true, read: true },
    cat: { heard: false, said: false, read: false },
    dog: { heard: false, said: false, read: false },
    apple: { heard: false, said: false, read: false },
  });
});
