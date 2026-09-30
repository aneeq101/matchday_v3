// Bracket + fixture generation. Pure functions — no Supabase here.
//
// Knockout ("tournament"): single elimination. The bracket size is the next power
// of two; spare places become byes (that entrant goes straight to round 2).
// League: round robin — everyone plays everyone once. 3 pts win, 1 draw.

export interface Entrant {
  id: string;        // player id or team id
  name: string;
  userId: string;    // the player, or the team captain
}

export type MatchStatus = 'pending' | 'done' | 'bye';

export interface BracketMatch {
  id?: string;
  round: number;     // 1-based
  slot: number;      // 0-based position within the round
  aId: string | null;
  aName: string | null;
  bId: string | null;
  bName: string | null;
  winnerId: string | null;
  isDraw: boolean;
  score: string;
  status: MatchStatus;
}

export interface StandingRow {
  id: string;
  name: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points: number;
}

export function nextPow2(n: number): number {
  let p = 2;
  while (p < n) p *= 2;
  return p;
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function emptyMatch(round: number, slot: number): BracketMatch {
  return { round, slot, aId: null, aName: null, bId: null, bName: null, winnerId: null, isDraw: false, score: '', status: 'pending' };
}

/** Knockout draw from entrants in the given order (shuffle first for a random draw). */
export function generateKnockout(entrants: Entrant[]): BracketMatch[] {
  const size = nextPow2(entrants.length);
  const firstRound = size / 2;
  const rounds = Math.log2(size);
  const byes = size - entrants.length;

  // Spread byes out: even positions first, then odd, so byes never meet each other early
  const order = [
    ...Array.from({ length: firstRound }, (_, i) => i).filter((i) => i % 2 === 0),
    ...Array.from({ length: firstRound }, (_, i) => i).filter((i) => i % 2 === 1),
  ];
  const byeSlots = new Set(order.slice(0, byes));

  const matches: BracketMatch[] = [];
  let next = 0;
  for (let slot = 0; slot < firstRound; slot++) {
    const m = emptyMatch(1, slot);
    const a = entrants[next++];
    m.aId = a.id; m.aName = a.name;
    if (byeSlots.has(slot)) {
      m.status = 'bye';
      m.winnerId = a.id;
    } else {
      const b = entrants[next++];
      m.bId = b.id; m.bName = b.name;
    }
    matches.push(m);
  }
  for (let r = 2; r <= rounds; r++) {
    for (let slot = 0; slot < size / 2 ** r; slot++) matches.push(emptyMatch(r, slot));
  }
  // Bye winners go straight into round 2
  if (rounds >= 2) {
    for (const m of matches.filter((x) => x.round === 1 && x.status === 'bye')) {
      const nxt = matches.find((x) => x.round === 2 && x.slot === Math.floor(m.slot / 2))!;
      if (m.slot % 2 === 0) { nxt.aId = m.aId; nxt.aName = m.aName; }
      else { nxt.bId = m.aId; nxt.bName = m.aName; }
    }
  }
  return matches;
}

/**
 * Before the organiser starts the event: show the bracket shape with sign-ups
 * filled in the order they joined and "Open spot" for the rest.
 */
export function previewKnockout(entrants: Entrant[], capacity: number): BracketMatch[] {
  const size = nextPow2(Math.max(capacity, entrants.length, 2));
  const rounds = Math.log2(size);
  const matches: BracketMatch[] = [];
  for (let slot = 0; slot < size / 2; slot++) {
    const m = emptyMatch(1, slot);
    const a = entrants[slot * 2];
    const b = entrants[slot * 2 + 1];
    if (a) { m.aId = a.id; m.aName = a.name; }
    if (b) { m.bId = b.id; m.bName = b.name; }
    matches.push(m);
  }
  for (let r = 2; r <= rounds; r++) {
    for (let slot = 0; slot < size / 2 ** r; slot++) matches.push(emptyMatch(r, slot));
  }
  return matches;
}

/** Round robin (circle method). With an odd number, one entrant rests each matchday. */
export function generateRoundRobin(entrants: Entrant[]): BracketMatch[] {
  const list: (Entrant | null)[] = [...entrants];
  if (list.length % 2 === 1) list.push(null);
  const n = list.length;
  const matches: BracketMatch[] = [];
  let ring = list.slice(1);
  for (let r = 0; r < n - 1; r++) {
    const lineup = [list[0], ...ring];
    let slot = 0;
    for (let i = 0; i < n / 2; i++) {
      const a = lineup[i];
      const b = lineup[n - 1 - i];
      if (!a || !b) continue;
      // Alternate home/away so the fixed entrant isn't always listed first
      const [home, away] = r % 2 === 0 ? [a, b] : [b, a];
      matches.push({
        ...emptyMatch(r + 1, slot++),
        aId: home.id, aName: home.name, bId: away.id, bName: away.name,
      });
    }
    ring = [ring[ring.length - 1], ...ring.slice(0, -1)];
  }
  return matches;
}

export function totalRounds(matches: BracketMatch[]): number {
  return matches.reduce((mx, m) => Math.max(mx, m.round), 0);
}

export function roundName(round: number, rounds: number, league: boolean): string {
  if (league) return `Matchday ${round}`;
  const left = rounds - round;
  if (left === 0) return 'Final';
  if (left === 1) return 'Semi-finals';
  if (left === 2) return 'Quarter-finals';
  return `Round of ${2 ** (left + 1)}`;
}

/** League table. Same ranking rule as the database: points, then wins, then name. */
export function computeStandings(entrants: Entrant[], matches: BracketMatch[]): StandingRow[] {
  const rows = new Map<string, StandingRow>();
  const row = (id: string, name: string) => {
    if (!rows.has(id)) rows.set(id, { id, name, played: 0, won: 0, drawn: 0, lost: 0, points: 0 });
    return rows.get(id)!;
  };
  entrants.forEach((e) => row(e.id, e.name));
  for (const m of matches) {
    if (m.status !== 'done' || !m.aId || !m.bId) continue;
    const a = row(m.aId, m.aName ?? '');
    const b = row(m.bId, m.bName ?? '');
    a.played++; b.played++;
    if (m.isDraw) { a.drawn++; b.drawn++; a.points++; b.points++; }
    else if (m.winnerId === m.aId) { a.won++; b.lost++; a.points += 3; }
    else if (m.winnerId === m.bId) { b.won++; a.lost++; b.points += 3; }
  }
  return [...rows.values()].sort(
    (x, y) => y.points - x.points || y.won - x.won || x.name.localeCompare(y.name),
  );
}

/** A knockout result can be changed until the winner has played their next match. */
export function canEditResult(match: BracketMatch, all: BracketMatch[], league: boolean): boolean {
  if (!match.aId || !match.bId || match.status === 'bye') return false;
  if (league) return true;
  const nxt = all.find((m) => m.round === match.round + 1 && m.slot === Math.floor(match.slot / 2));
  return !nxt || nxt.status !== 'done';
}
