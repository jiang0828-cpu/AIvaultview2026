import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterWriters } from '../src/writers';
import { writers } from '../../backend/prisma/writers/index';

test('writer searches include Chinese, original names, works and combined filters', () => {
  assert.equal(filterWriters(writers, { q: 'Shakespeare' })[0]?.id, 'william-shakespeare');
  assert.equal(filterWriters(writers, { q: '红楼梦' })[0]?.id, 'cao-xueqin');
  assert.equal(filterWriters(writers, { q: '  源氏物语  ' })[0]?.id, 'murasaki-shikibu');
  assert.equal(filterWriters(writers, { country: 'CN' }).length, 30);
  assert.equal(filterWriters(writers, { country: 'JP', genre: '小说与叙事' }).length, 6);
  assert.equal(filterWriters(writers, { q: '普希金', country: 'JP' }).length, 0);
  assert.ok(filterWriters(writers, { topic: '宫廷' }).every((writer) => writer.topics.includes('宫廷')));
  assert.equal(filterWriters(writers, { era: 'not-an-era' }).length, 0);
});
test('chronological sorting handles uncertain years last without mutating input', () => {
  const ids = writers.map((writer) => writer.id);
  const sorted = filterWriters(writers, { sort: 'birth' });
  assert.equal(sorted.length, 100);
  assert.equal(sorted.at(-1)?.birthYear, null);
  const known = sorted.filter((writer) => writer.birthYear !== null);
  assert.ok(known.every((writer, index) => index === 0 || known[index - 1].birthYear! <= writer.birthYear!));
  assert.deepEqual(writers.map((writer) => writer.id), ids);
});
