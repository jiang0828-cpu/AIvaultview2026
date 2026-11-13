import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeFields, sameTrip } from './release-merge.mjs';

test('trip merge recognizes existing and renamed itineraries without overwriting online changes', () => {
  const local = { title: 'New trip', startDate: '2026-12-01', endDate: '2026-12-03', destination: 'City', notes: 'local' };
  assert.equal(sameTrip({ ...local, notes: 'online' }, local), true);
  assert.equal(sameTrip({ ...local, title: 'Renamed online' }, local), true);
  assert.equal(sameTrip({ ...local, title: 'Another trip', startDate: '2027-01-01' }, local), false);
});

test('release updates unchanged production fields while retaining online edits', () => {
  const base = { title: 'old', description: 'original', topics: ['AI'], updatedAt: 'old' };
  const local = { ...base, title: 'new', description: 'local', topics: ['AI', 'tools'], updatedAt: 'local' };
  const remote = { ...base, description: 'online' };
  assert.deepEqual(mergeFields(base, local, remote), {
    changes: { title: 'new', topics: ['AI', 'tools'] }, conflicts: ['description'],
  });
});
test('repeated releases and remote-only changes do not produce updates', () => {
  assert.deepEqual(mergeFields({ title: 'old', description: 'old' }, { title: 'new', description: 'old' },
    { title: 'new', description: 'online' }), { changes: {}, conflicts: [] });
});
