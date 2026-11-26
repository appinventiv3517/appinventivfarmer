import type { Land } from '@/types';

/**
 * Sample fields Ver 3 does not show. The sample data is shared with
 * Directions 01 and 02, so Ver 3 hides these instead of deleting them.
 */
const HIDDEN_IN_V3 = new Set(['l-riverside']);

export function visibleLands<T extends Pick<Land, 'id'>>(lands: readonly T[]): T[] {
  return lands.filter((l) => !HIDDEN_IN_V3.has(l.id));
}
