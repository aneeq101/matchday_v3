export interface SportFormat {
  label: string;
  format: string;
  maxPlayers: number;
}

export const SPORT_FORMATS: Record<string, SportFormat[]> = {
  Football: [
    { label: '3v3', format: '3v3', maxPlayers: 6 },
    { label: '5v5', format: '5v5', maxPlayers: 10 },
    { label: '6v6', format: '6v6', maxPlayers: 12 },
    { label: '7v7', format: '7v7', maxPlayers: 14 },
    { label: '8v8', format: '8v8', maxPlayers: 16 },
    { label: '11v11', format: '11v11', maxPlayers: 22 },
  ],
  Cricket: [
    { label: '5v5', format: '5v5', maxPlayers: 10 },
    { label: '6v6', format: '6v6', maxPlayers: 12 },
    { label: '8v8', format: '8v8', maxPlayers: 16 },
    { label: '11v11', format: '11v11', maxPlayers: 22 },
  ],
  Tennis: [
    { label: 'Singles (1v1)', format: 'Singles', maxPlayers: 2 },
    { label: 'Doubles (2v2)', format: 'Doubles', maxPlayers: 4 },
  ],
  Basketball: [
    { label: '3v3', format: '3v3', maxPlayers: 6 },
    { label: '4v4', format: '4v4', maxPlayers: 8 },
    { label: '5v5', format: '5v5', maxPlayers: 10 },
  ],
  Badminton: [
    { label: 'Singles (1v1)', format: 'Singles', maxPlayers: 2 },
    { label: 'Doubles (2v2)', format: 'Doubles', maxPlayers: 4 },
  ],
  Baseball: [
    { label: '5v5', format: '5v5', maxPlayers: 10 },
    { label: '7v7', format: '7v7', maxPlayers: 14 },
    { label: '9v9', format: '9v9', maxPlayers: 18 },
  ],
};

// Maximum players allowed for venue bookings (not match formats)
export const BOOKING_MAX_PLAYERS: Record<string, number> = {
  Football: 22,
  Cricket: 22,
  Tennis: 4,
  Basketball: 10,
  Badminton: 4,
  Baseball: 18,
};

export function getFormatsForSport(sport: string): SportFormat[] {
  return SPORT_FORMATS[sport] ?? [
    { label: '3v3', format: '3v3', maxPlayers: 6 },
    { label: '5v5', format: '5v5', maxPlayers: 10 },
    { label: '11v11', format: '11v11', maxPlayers: 22 },
  ];
}

export function getBookingMaxPlayers(sport: string): number {
  return BOOKING_MAX_PLAYERS[sport] ?? 22;
}

// ── Tournament / league entry rules ─────────────────────────
// Who signs up follows from the sport and format:
//   Tennis / Badminton singles → individual players
//   Tennis / Badminton doubles → pairs (a 2-player team; the captain enters it)
//   Football, Cricket, Basketball, Baseball → teams
// Every knockout or league needs at least 4 entrants (a semi-final + final,
// or enough fixtures for a real table). The database enforces the same minimum.

export const RACQUET_SPORTS = ['Tennis', 'Badminton'];
export const MIN_ENTRANTS = 4;

export type EntrantKind = 'player' | 'team';

export interface EventRules {
  entrant: EntrantKind;
  noun: string;         // 'player' | 'pair' | 'team'
  nouns: string;
  min: number;          // lowest minimum allowed
  max: number;          // highest maximum allowed
  defMin: number;
  defMax: number;
  who: string;          // one line explaining who signs up
}

export function isDoubles(format?: string): boolean {
  return (format ?? '').toLowerCase() === 'doubles';
}

export function eventRules(sport: string, type: 'tournament' | 'league', format?: string): EventRules {
  const league = type === 'league';
  if (RACQUET_SPORTS.includes(sport) && !isDoubles(format)) {
    return {
      entrant: 'player', noun: 'player', nouns: 'players',
      min: MIN_ENTRANTS, max: league ? 16 : 64, defMin: MIN_ENTRANTS, defMax: league ? 8 : 16,
      who: 'Individual players sign up (singles).',
    };
  }
  if (RACQUET_SPORTS.includes(sport)) {
    return {
      entrant: 'team', noun: 'pair', nouns: 'pairs',
      min: MIN_ENTRANTS, max: league ? 12 : 32, defMin: MIN_ENTRANTS, defMax: league ? 6 : 8,
      who: 'Doubles pairs sign up — one partner enters their 2-player team.',
    };
  }
  return {
    entrant: 'team', noun: 'team', nouns: 'teams',
    min: MIN_ENTRANTS, max: league ? 20 : 32, defMin: MIN_ENTRANTS, defMax: 8,
    who: 'Teams sign up — the team captain enters the team.',
  };
}

/** Singular/plural label for an existing event's entrants. */
export function entrantNouns(entrantType?: string, format?: string): { noun: string; nouns: string } {
  if (entrantType !== 'team') return { noun: 'player', nouns: 'players' };
  return isDoubles(format) ? { noun: 'pair', nouns: 'pairs' } : { noun: 'team', nouns: 'teams' };
}
