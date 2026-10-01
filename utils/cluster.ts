import type { Venue } from '../data/mockData';
import type { Coord } from './geo';

export type MapItem =
  | { kind: 'venue'; key: string; venue: Venue; coord: Coord }
  | { kind: 'cluster'; key: string; coord: Coord; count: number; venues: Venue[] };

/**
 * Groups venues that would overlap on screen into one numbered bubble.
 * `cellDeg` is the grid cell size in degrees (≈ one marker's width at the
 * current zoom); 0 turns grouping off. Pure — used by both map components.
 */
export function clusterVenues(venues: Venue[], cellDeg: number): MapItem[] {
  const withCoord = venues.filter((v) => v.coord);
  if (cellDeg <= 0) {
    return withCoord.map((v) => ({ kind: 'venue', key: v.id, venue: v, coord: v.coord! }));
  }
  const cells = new Map<string, Venue[]>();
  for (const v of withCoord) {
    const k = `${Math.floor(v.coord!.latitude / cellDeg)}:${Math.floor(v.coord!.longitude / cellDeg)}`;
    const list = cells.get(k);
    if (list) list.push(v); else cells.set(k, [v]);
  }
  const items: MapItem[] = [];
  for (const [k, list] of cells) {
    if (list.length === 1) {
      items.push({ kind: 'venue', key: list[0].id, venue: list[0], coord: list[0].coord! });
    } else {
      const coord = {
        latitude:  list.reduce((s, v) => s + v.coord!.latitude, 0) / list.length,
        longitude: list.reduce((s, v) => s + v.coord!.longitude, 0) / list.length,
      };
      items.push({ kind: 'cluster', key: `c:${k}:${list.length}`, coord, count: list.length, venues: list });
    }
  }
  return items;
}
