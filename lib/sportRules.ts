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

// ── Team squad sizes ────────────────────────────────────────
// A team's max members must fit its format: at least a full line-up,
// and no more than a realistic squad (line-up + substitutes).
// Tennis / Badminton teams are doubles pairs — always exactly 2.
// The database enforces the same table (fn_team_formats() in
// lib/db/patch_team_sizes_event_alerts.sql) — keep the two in step.

export interface TeamFormat {
  format: string;
  label: string;
  onField: number;      // players in the line-up
  min: number;          // smallest squad allowed
  max: number;          // largest squad allowed
  def: number;          // default squad size
}

export const TEAM_FORMATS: Record<string, TeamFormat[]> = {
  Tennis:     [{ format: 'Doubles',   label: 'Doubles pair', onField: 2,  min: 2,  max: 2,  def: 2 }],
  Badminton:  [{ format: 'Doubles',   label: 'Doubles pair', onField: 2,  min: 2,  max: 2,  def: 2 }],
  Football: [
    { format: '5-a-side',  label: '5-a-side',  onField: 5,  min: 5,  max: 10, def: 8 },
    { format: '7-a-side',  label: '7-a-side',  onField: 7,  min: 7,  max: 14, def: 10 },
    { format: '11-a-side', label: '11-a-side', onField: 11, min: 11, max: 25, def: 18 },
  ],
  Cricket: [
    { format: '8-a-side',  label: '8-a-side',  onField: 8,  min: 8,  max: 12, def: 10 },
    { format: '11-a-side', label: '11-a-side', onField: 11, min: 11, max: 16, def: 14 },
  ],
  Basketball: [
    { format: '3x3',    label: '3x3',    onField: 3, min: 3, max: 4,  def: 4 },
    { format: '5-on-5', label: '5-on-5', onField: 5, min: 5, max: 15, def: 12 },
  ],
  Baseball: [{ format: '9 players', label: '9 players', onField: 9, min: 9, max: 20, def: 14 }],
  Hockey:   [{ format: '6 on ice',  label: '6 on ice',  onField: 6, min: 6, max: 22, def: 15 }],
};

export function teamFormatsFor(sport: string): TeamFormat[] {
  return TEAM_FORMATS[sport] ?? [];
}

/** The team's format, or the sport's most common one (the last for team sports, e.g. 11-a-side). */
export function teamFormat(sport: string, format?: string): TeamFormat | null {
  const list = teamFormatsFor(sport);
  return list.find((f) => f.format === format) ?? list[list.length - 1] ?? null;
}

/** "5 on the pitch + up to 5 subs" style explanation. */
export function squadNote(f: TeamFormat, maxMembers: number): string {
  if (f.min === f.max) return `A doubles pair is always exactly ${f.max} players.`;
  const subs = Math.max(0, maxMembers - f.onField);
  return `${f.onField} in the line-up + ${subs} sub${subs === 1 ? '' : 's'} · allowed ${f.min}–${f.max}`;
}
