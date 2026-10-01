import { supabase } from './supabase';

// Match history + verified win/loss record, worked out by the database from
// recorded results (challenges, tournament/league games, pickup games).
// See lib/db/patch_match_history.sql.

export type HistoryOutcome = 'won' | 'lost' | 'draw' | 'played';
export type HistorySource = 'challenge' | 'event_game' | 'event_match' | 'pickup';
export type OpponentKind = 'player' | 'team' | 'group';

export interface HistoryItem {
  key: string;
  source: HistorySource;
  refId: string;
  eventId: string | null;
  eventName: string | null;
  sport: string;
  playedAt: string | null;
  mySideName: string | null;     // team name when it was a team game
  oppKind: OpponentKind;
  oppId: string | null;          // player id or team id (null for a group game)
  oppName: string;
  oppUserId: string | null;      // the player, or the team's captain
  score: string;
  outcome: HistoryOutcome;
}

export interface VerifiedRecord {
  sport: string;
  played: number;
  wins: number;
  losses: number;
  draws: number;
}

export interface Rival {
  key: string;
  kind: 'player' | 'team';
  id: string;
  name: string;
  userId: string | null;
  sport: string;
  played: number;
  wins: number;
  losses: number;
  draws: number;
  lastAt: string | null;
}

export async function fetchMatchHistory(userId: string, limit = 200): Promise<HistoryItem[]> {
  const { data, error } = await supabase.rpc('match_history', { p_user: userId, p_limit: limit });
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map((r, i) => ({
    key: `${r.source}:${r.ref_id}:${i}`,
    source: r.source as HistorySource,
    refId: r.ref_id as string,
    eventId: (r.event_id as string) ?? null,
    eventName: (r.event_name as string) ?? null,
    sport: (r.sport as string) ?? '',
    playedAt: (r.played_at as string) ?? null,
    mySideName: (r.my_side_name as string) ?? null,
    oppKind: (r.opp_kind as OpponentKind) ?? 'group',
    oppId: (r.opp_id as string) ?? null,
    oppName: (r.opp_name as string) ?? '',
    oppUserId: (r.opp_user_id as string) ?? null,
    score: (r.score as string) ?? '',
    outcome: (r.outcome as HistoryOutcome) ?? 'played',
  }));
}

export async function fetchVerifiedRecord(userId: string): Promise<VerifiedRecord[]> {
  const { data, error } = await supabase.rpc('verified_record', { p_user: userId });
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map((r) => ({
    sport: r.sport as string,
    played: Number(r.played ?? 0),
    wins: Number(r.wins ?? 0),
    losses: Number(r.losses ?? 0),
    draws: Number(r.draws ?? 0),
  }));
}

/** Head-to-head against each player / team you've met (most games first). */
export function rivalsFrom(history: HistoryItem[]): Rival[] {
  const map = new Map<string, Rival>();
  for (const h of history) {
    if (h.oppKind === 'group' || !h.oppId) continue;
    const key = `${h.oppKind}:${h.oppId}:${h.sport}`;
    const r = map.get(key) ?? {
      key, kind: h.oppKind, id: h.oppId, name: h.oppName, userId: h.oppUserId, sport: h.sport,
      played: 0, wins: 0, losses: 0, draws: 0, lastAt: h.playedAt,
    };
    r.played += 1;
    if (h.outcome === 'won') r.wins += 1;
    else if (h.outcome === 'lost') r.losses += 1;
    else if (h.outcome === 'draw') r.draws += 1;
    if (h.playedAt && (!r.lastAt || h.playedAt > r.lastAt)) r.lastAt = h.playedAt;
    map.set(key, r);
  }
  return [...map.values()].sort((a, b) => b.played - a.played || (b.lastAt ?? '').localeCompare(a.lastAt ?? ''));
}
