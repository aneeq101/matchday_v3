import { supabase } from './supabase';
import { isPastGame, toISODate } from './matchday';
import {
  TOURNAMENTS, type Tournament, type EventType, type EntrantType, type TournamentStatus, type EventCategory,
} from '../data/mockData';
import {
  generateKnockout, generateRoundRobin, shuffle, type BracketMatch, type Entrant,
} from './bracket';

const SPORT_EMOJIS: Record<string, string> = {
  Football: '⚽', Cricket: '🏏', Tennis: '🎾',
  Basketball: '🏀', Badminton: '🏸', Baseball: '⚾',
};

function dbToTournament(row: Record<string, unknown>): Tournament {
  return {
    id: row.id as string,
    name: row.name as string,
    type: row.type as EventType,
    sport: row.sport as string,
    sportEmoji: (row.sport_emoji as string) ?? '🏆',
    date: (row.date_text as string) ?? 'TBD',
    location: (row.location as string) ?? '',
    participants: (row.participants_count as number) ?? 0,
    maxParticipants: (row.max_participants as number) ?? 16,
    entryFee: (row.entry_fee as number) ?? 0,
    prizePool: (row.prize_pool as number) ?? 0,
    entrantType: ((row.entrant_type as EntrantType) ?? 'player'),
    minParticipants: (row.min_participants as number) ?? 2,
    format: (row.format as string) ?? '',
    status: ((row.status as TournamentStatus) ?? 'active'),
    championName: (row.champion_name as string) ?? null,
    organiserId: (row.organiser_id as string) ?? null,
    startsOn: (row.starts_on as string) ?? null,
    readyAt: (row.ready_at as string) ?? null,
    resultScore: (row.result_score as string) ?? null,
    resultNote: (row.result_note as string) ?? null,
    resultSummary: (row.result_summary as string) ?? null,
    category: (row.category as EventCategory) ?? undefined,
  };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Maps database error codes to messages people can act on. */
function friendlyError(message?: string, fallback = 'Something went wrong. Please try again.'): string {
  const m = message ?? '';
  if (m.includes('REGISTRATION_CLOSED')) return 'Sign-ups for this event are closed.';
  if (m.includes('TEAM_REQUIRED')) return 'Pick a team you captain to sign up.';
  if (m.toLowerCase().includes('full')) return 'This event is full.';
  if (m.includes('NOT_ENOUGH_ENTRANTS')) return 'Not enough sign-ups yet to start.';
  if (m.includes('ALREADY_STARTED')) return 'This event has already started.';
  if (m.includes('NOT_ORGANISER')) return 'Only the organiser can do this.';
  if (m.includes('NEXT_ROUND_PLAYED')) return 'The winner has already played their next match, so this result can no longer be changed.';
  if (m.includes('NO_DRAWS_IN_KNOCKOUT')) return 'Knockout matches need a winner.';
  if (m.includes('MATCH_NOT_READY')) return 'Both sides of this match aren\'t decided yet.';
  if (m.includes('PRIZE_REQUIRED')) return 'A prize money event needs a prize pool.';
  if (m.includes('FRIENDLY_NO_MONEY')) return 'Friendly events can’t have an entry fee or prize pool.';
  if (m.includes('NOT_ALLOWED')) return 'Only the players in this match (or the organiser) can record it — any entrant can once the event date has passed.';
  return fallback;
}

/** Friendly or prize money — events, matches and bookings without a category: any money means prize. */
export function eventCategory(t: { category?: EventCategory; entryFee?: number; prizePool?: number }): EventCategory {
  return t.category ?? ((t.entryFee ?? 0) > 0 || (t.prizePool ?? 0) > 0 ? 'prize' : 'friendly');
}

/** "🤝 Friendly" / "💰 Prize CAD 500 · CAD 20 entry" for cards and detail rows. */
export function categoryLabel(t: { category?: EventCategory; entryFee?: number; prizePool?: number }): string {
  if (eventCategory(t) === 'friendly') return '🤝 Friendly';
  const parts = ['💰 Prize money'];
  if ((t.prizePool ?? 0) > 0) parts.push(`CAD ${t.prizePool!.toLocaleString()} prize`);
  if ((t.entryFee ?? 0) > 0) parts.push(`CAD ${t.entryFee!.toLocaleString()} entry`);
  return parts.join(' · ');
}

/**
 * Is this event over? Finished, a pickup "match" event that has started, or a
 * tournament/league whose date has gone by without being started. Running
 * brackets/leagues are not past until they finish.
 */
export function eventIsPast(t: Pick<Tournament, 'status' | 'type' | 'startsOn' | 'date'>): boolean {
  if (t.status === 'completed') return true;
  if (t.type === 'match') return isPastGame({ startsOn: t.startsOn, date: t.date });
  return (t.status ?? 'active') === 'active' && !!t.startsOn && t.startsOn < toISODate(new Date());
}

/**
 * Money to save for a category (friendly → 0/0) from the form text, or an error
 * message when a prize money event/match/booking has no prize pool.
 */
export function categoryMoney(category: EventCategory, entryFee: string, prizePool: string):
  { entryFee: number; prizePool: number; error?: string } {
  if (category === 'friendly') return { entryFee: 0, prizePool: 0 };
  const fee = Math.max(0, parseInt(entryFee) || 0);
  const prize = Math.max(0, parseInt(prizePool) || 0);
  if (prize <= 0) {
    return { entryFee: fee, prizePool: prize, error: 'Prize money needs a prize pool. If there’s no prize, choose Friendly instead.' };
  }
  return { entryFee: fee, prizePool: prize };
}

export const CATEGORY_INFO: Record<EventCategory, { label: string; emoji: string; color: string; bg: string; blurb: string }> = {
  friendly: { label: 'Friendly', emoji: '🤝', color: '#0369a1', bg: '#e0f2fe', blurb: 'Just for fun — no entry fee, no prize money.' },
  prize:    { label: 'Prize money', emoji: '💰', color: '#a16207', bg: '#fef3c7', blurb: 'Compete for a prize pool — players may pay an entry fee.' },
};

export async function fetchTournaments(): Promise<Tournament[]> {
  const { data, error } = await supabase
    .from('tournaments')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error || !data?.length) return TOURNAMENTS;
  return data.map(dbToTournament);
}

export async function fetchRegisteredIds(userId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from('tournament_registrations')
    .select('tournament_id')
    .eq('user_id', userId);
  return new Set(
    (data ?? []).map((r: Record<string, string>) => r.tournament_id)
  );
}

export async function registerForTournament(
  tournamentId: string,
  userId: string,
  teamId?: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from('tournament_registrations')
    .insert({ tournament_id: tournamentId, user_id: userId, team_id: teamId ?? null });
  if (!error) return { ok: true };
  if (error.code === '23505') {
    return {
      ok: false,
      error: teamId ? 'This team (or you) is already signed up for this event.' : 'You are already registered for this event.',
    };
  }
  return { ok: false, error: friendlyError(error.message, 'Failed to register. Please try again.') };
}

export async function unregisterFromTournament(
  tournamentId: string,
  userId: string
): Promise<boolean> {
  // .select() returns the deleted rows — none means row security blocked it
  // (the event has already started), which is not a successful leave.
  const { data, error } = await supabase
    .from('tournament_registrations')
    .delete()
    .eq('tournament_id', tournamentId)
    .eq('user_id', userId)
    .select('tournament_id');
  return !error && (data?.length ?? 0) > 0;
}

export async function fetchMyRegistrations(userId: string): Promise<Tournament[]> {
  const { data, error } = await supabase
    .from('tournament_registrations')
    .select('registered_at, tournaments(*)')
    .eq('user_id', userId)
    .order('registered_at', { ascending: false });

  if (error || !data?.length) return [];

  return data
    .filter((r) => r.tournaments)
    .map((r) => dbToTournament(r.tournaments as unknown as Record<string, unknown>));
}

export async function fetchMyOrganisedTournaments(userId: string): Promise<Tournament[]> {
  const { data, error } = await supabase
    .from('tournaments')
    .select('*')
    .eq('organiser_id', userId)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map((r) => dbToTournament(r as Record<string, unknown>));
}

export async function createTournament(
  params: {
    name: string;
    type: EventType;
    sport: string;
    date: string;
    location: string;
    entryFee: number;
    prizePool: number;
    maxParticipants: number;
    minParticipants: number;
    entrantType: EntrantType;
    format: string;
    category: EventCategory;
    /** YYYY-MM-DD; lets players record scores once match day arrives */
    startsOn?: string | null;
    /** Venue coordinates — lets the database alert nearby players */
    latitude?: number | null;
    longitude?: number | null;
  },
  userId: string | null
): Promise<Tournament | null> {
  const { data, error } = await supabase
    .from('tournaments')
    .insert({
      name: params.name,
      type: params.type,
      sport: params.sport,
      sport_emoji: SPORT_EMOJIS[params.sport] ?? '🏆',
      organiser_id: userId,
      date_text: params.date,
      location: params.location,
      entry_fee: params.entryFee,
      prize_pool: params.prizePool,
      max_participants: params.maxParticipants,
      min_participants: params.minParticipants,
      entrant_type: params.entrantType,
      format: params.format,
      starts_on: params.startsOn ?? null,
      category: params.category,
      latitude: params.latitude ?? null,
      longitude: params.longitude ?? null,
      participants_count: 0,
    })
    .select()
    .single();
  if (error) {
    console.warn('[createTournament] error:', error.message, error.code, error.details);
    return null;
  }
  if (!data) return null;
  return dbToTournament(data as Record<string, unknown>);
}

// ── Tournament details, bracket and results ────────────────

export async function fetchTournament(id: string): Promise<Tournament | null> {
  if (!UUID_RE.test(id)) return TOURNAMENTS.find((t) => t.id === id) ?? null;
  const { data, error } = await supabase.from('tournaments').select('*').eq('id', id).maybeSingle();
  if (error || !data) return TOURNAMENTS.find((t) => t.id === id) ?? null;
  return dbToTournament(data as Record<string, unknown>);
}

/** Everyone signed up, in sign-up order. For team events the entrant is the team. */
export async function fetchEntrants(t: Tournament): Promise<Entrant[]> {
  if (!UUID_RE.test(t.id)) return [];
  const { data, error } = await supabase
    .from('tournament_registrations')
    .select('user_id, team_id, registered_at')
    .eq('tournament_id', t.id)
    .order('registered_at', { ascending: true });
  if (error || !data?.length) return [];
  const rows = data as { user_id: string; team_id: string | null }[];

  if (t.entrantType === 'team') {
    const teamIds = rows.map((r) => r.team_id).filter((x): x is string => !!x);
    const { data: teams } = await supabase.from('teams').select('id, name').in('id', teamIds);
    const names = new Map((teams ?? []).map((x: { id: string; name: string }) => [x.id, x.name]));
    return rows
      .filter((r) => r.team_id)
      .map((r) => ({ id: r.team_id!, name: names.get(r.team_id!) ?? 'Team', userId: r.user_id }));
  }

  const { data: profiles } = await supabase.from('profiles').select('id, name').in('id', rows.map((r) => r.user_id));
  const names = new Map((profiles ?? []).map((x: { id: string; name: string }) => [x.id, x.name]));
  return rows.map((r) => ({ id: r.user_id, name: names.get(r.user_id) ?? 'Player', userId: r.user_id }));
}

export async function fetchBracket(tournamentId: string): Promise<BracketMatch[]> {
  if (!UUID_RE.test(tournamentId)) return [];
  const { data, error } = await supabase
    .from('tournament_matches')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('round', { ascending: true })
    .order('slot', { ascending: true });
  if (error || !data) return [];
  return data.map((r: Record<string, unknown>) => ({
    id: r.id as string,
    round: r.round as number,
    slot: r.slot as number,
    aId: (r.a_id as string) ?? null,
    aName: (r.a_name as string) ?? null,
    bId: (r.b_id as string) ?? null,
    bName: (r.b_name as string) ?? null,
    winnerId: (r.winner_id as string) ?? null,
    isDraw: (r.is_draw as boolean) ?? false,
    score: (r.score as string) ?? '',
    status: ((r.status as BracketMatch['status']) ?? 'pending'),
  }));
}

/** Closes sign-ups and saves a random draw (knockout) or fixture list (league). */
export async function startTournament(
  t: Tournament,
  entrants: Entrant[],
): Promise<{ ok: boolean; error?: string }> {
  const drawn = shuffle(entrants);
  const matches = t.type === 'league' ? generateRoundRobin(drawn) : generateKnockout(drawn);
  const payload = matches.map((m) => ({
    round: m.round, slot: m.slot,
    a_id: m.aId, a_name: m.aName, b_id: m.bId, b_name: m.bName,
    winner_id: m.winnerId, status: m.status,
  }));
  const { error } = await supabase.rpc('start_tournament', { p_tournament_id: t.id, p_matches: payload });
  if (error) return { ok: false, error: friendlyError(error.message) };
  return { ok: true };
}

export async function recordMatchResult(
  matchId: string,
  winnerId: string | null,
  isDraw: boolean,
  score: string,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.rpc('record_match_result', {
    p_match_id: matchId, p_winner_id: winnerId, p_is_draw: isDraw, p_score: score.trim(),
  });
  if (error) return { ok: false, error: friendlyError(error.message) };
  return { ok: true };
}
