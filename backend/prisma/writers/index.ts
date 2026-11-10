import { chinaClassical } from './china-classical.js';
import { chinaLate } from './china-late.js';
import { chinaModern } from './china-modern.js';
import { greek } from './greek.js';
import { britishEarly } from './british-early.js';
import { britishModern } from './british-modern.js';
import { frenchEarly } from './french-early.js';
import { frenchModern } from './french-modern.js';
import { german } from './german.js';
import { russian } from './russian.js';
import { japanese } from './japanese.js';
import { italian } from './italian.js';

export const writers = [...chinaClassical, ...chinaLate, ...chinaModern, ...greek, ...britishEarly,
  ...britishModern, ...frenchEarly, ...frenchModern, ...german, ...russian, ...japanese, ...italian];
if (writers.length !== 100 || new Set(writers.map((item) => item.id)).size !== 100)
  throw new Error('Expected exactly 100 unique literary writers');
