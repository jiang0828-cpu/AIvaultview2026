import { test } from "node:test";
import assert from "node:assert/strict";
import { alphabet, englishScenes, englishQuestion, englishDialogues } from "../src/englishModel.js";

test("English curriculum covers A-Z, five scenes and short dialogue practice", () => {
  assert.equal(alphabet.map(word => word.letter).join(""), "ABCDEFGHIJKLMNOPQRSTUVWXYZ");
  assert.equal(englishScenes.length, 5);
  for (const scene of englishScenes) {
    assert.ok(scene.words.length >= 8);
    assert.equal(new Set(scene.words.map(word => word.en)).size, scene.words.length);
    for (const word of scene.words) assert.ok(word.en && word.zh && (word.picture || word.color));
  }
  assert.equal(englishDialogues.length, 4);
  for (const dialogue of englishDialogues) assert.ok(dialogue.lines.every(line => line.length === 3 && line.every(Boolean)));
});

test("two-choice questions include one correct answer and a distinct distractor across full scene cycles", () => {
  for (const scene of englishScenes) {
    for (let round = 0; round < scene.words.length * 2; round++) {
      for (const random of [() => 0, () => 0.999]) {
        const question = englishQuestion(scene.words, round, random);
        assert.equal(question.answer, scene.words[round % scene.words.length]);
        assert.equal(question.options.length, 2);
        assert.equal(question.options.filter(word => word.en === question.answer.en).length, 1);
        assert.equal(new Set(question.options.map(word => word.en)).size, 2);
      }
    }
  }
  assert.throws(() => englishQuestion(alphabet.slice(0, 1), 0));
});
