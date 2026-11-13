import { isDeepStrictEqual } from 'node:util';

export function sameTrip(remote, local) {
  return remote.title === local.title || (remote.startDate === local.startDate && remote.endDate === local.endDate && remote.destination === local.destination);
}

// Only update a field when production still matches the previous release.
export function mergeFields(base, local, remote) {
  const changes = {};
  const conflicts = [];
  for (const key of Object.keys(local)) {
    if (['id', 'createdAt', 'updatedAt'].includes(key)) continue;
    if (isDeepStrictEqual(base[key], local[key])) continue;
    if (isDeepStrictEqual(remote[key], local[key])) continue;
    if (isDeepStrictEqual(remote[key], base[key])) changes[key] = local[key];
    else conflicts.push(key);
  }
  return { changes, conflicts };
}
