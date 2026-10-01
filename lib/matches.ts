import { supabase } from './supabase';
import { type MatchItem, type EventCategory } from '../data/mockData';

const SPORT_EMOJIS: Record<string, string> = {
  Football: '⚽', Cricket: '🏏', Tennis: '🎾',
  Basketball: '🏀', Badminton: '🏸', Baseball: '⚾',
};

function rowToMatchItem(row: Record<string, unknown>): MatchItem {
  return {
    id:             row.id as string,
    sport:          row.sport as string,
    sportEmoji:     row.sport_emoji as string,
    title:          row.title as string,
    players:        row.players_format as string,
    date:           row.match_date as string,
    location:       row.location as string,
    maxPlayers:     row.max_players as number | undefined,
    currentPlayers: row.current_players as number | undefined,
    creatorId:      row.creator_id as string,
    status:         (row.status as MatchItem['status']) ?? 'upcoming',
    startsOn:       (row.starts_on as string) ?? null,
    readyAt:        (row.ready_at as string) ?? null,
    resultScore:    (row.result_score as string) ?? null,
    resultNote:     (row.result_note as string) ?? null,
    resultSummary:  (row.result_summary as string) ?? null,
    category:       (row.category as EventCategory) ?? undefined,
    entryFee:       Number(row.entry_fee ?? 0),
    prizePool:      Number(row.prize_pool ?? 0),
    coord:          row.latitude != null && row.longitude != null
      ? { latitude: Number(row.latitude), longitude: Number(row.longitude) }
      : null,
  };
}

export async function fetchMyMatches(userId: string): Promise<MatchItem[]> {
  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .eq('creator_id', userId)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false });

  if (error || !data?.length) return [];
  return data.map(rowToMatchItem);
}

export async function createMatch(params: {
  userId: string;
  title: string;
  sport: string;
  playersFormat: string;
  maxPlayers: number;
  matchDate: string;
  location: string;
  startsOn?: string | null;   // YYYY-MM-DD
  category: EventCategory;
  entryFee: number;
  prizePool: number;
  /** Venue coordinates — lets the database alert nearby players about prize matches */
  latitude?: number | null;
  longitude?: number | null;
}): Promise<MatchItem | null> {
  const emoji = SPORT_EMOJIS[params.sport] ?? '🏟️';
  const { data, error } = await supabase
    .from('matches')
    .insert({
      creator_id:      params.userId,
      title:           params.title,
      sport:           params.sport,
      sport_emoji:     emoji,
      players_format:  params.playersFormat,
      max_players:     params.maxPlayers,
      current_players: 0,
      match_date:      params.matchDate,
      starts_on:       params.startsOn ?? null,
      location:        params.location,
      category:        params.category,
      entry_fee:       params.entryFee,
      prize_pool:      params.prizePool,
      latitude:        params.latitude ?? null,
      longitude:       params.longitude ?? null,
    })
    .select()
    .single();

  if (error || !data) {
    console.error('[createMatch] error:', error?.message);
    return null;
  }

  // The auto_join_creator_trigger in Supabase handles inserting the creator
  // into match_players (and incrementing current_players) atomically on INSERT.
  return { ...rowToMatchItem(data), currentPlayers: 1 };
}

/** One Organize Match game (for the "ready for match day" popup). */
export async function fetchMatch(id: string): Promise<MatchItem | null> {
  const { data, error } = await supabase.from('matches').select('*').eq('id', id).maybeSingle();
  if (error || !data) return null;
  return rowToMatchItem(data as Record<string, unknown>);
}

export async function cancelMatch(matchId: string): Promise<boolean> {
  const { error } = await supabase
    .from('matches')
    .update({ status: 'cancelled' })
    .eq('id', matchId);
  return !error;
}

export async function joinMatch(matchId: string, userId: string): Promise<boolean> {
  const { error } = await supabase
    .from('match_players')
    .insert({ match_id: matchId, player_id: userId });
  if (error) {
    console.error('[joinMatch] error:', error.message);
    return false;
  }
  return true;
}

export async function leaveMatch(matchId: string, userId: string): Promise<boolean> {
  const { error } = await supabase
    .from('match_players')
    .delete()
    .eq('match_id', matchId)
    .eq('player_id', userId);
  return !error;
}

export async function fetchOpenMatches(userId: string): Promise<MatchItem[]> {
  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .neq('creator_id', userId)
    .eq('status', 'upcoming')
    .order('created_at', { ascending: false });

  if (error || !data?.length) return [];
  return data
    .filter((row) => (row.current_players as number) < (row.max_players as number))
    .map(rowToMatchItem);
}

export async function fetchJoinedMatches(userId: string): Promise<MatchItem[]> {
  const { data: playerRows, error } = await supabase
    .from('match_players')
    .select('match_id')
    .eq('player_id', userId);

  if (error || !playerRows?.length) return [];

  const matchIds = playerRows.map((r: Record<string, unknown>) => r.match_id as string);

  const { data } = await supabase
    .from('matches')
    .select('*')
    .in('id', matchIds)
    .neq('creator_id', userId)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false });

  return (data ?? []).map(rowToMatchItem);
}

/** Is this player already in the match (joined or organiser)? */
export async function isInMatch(matchId: string, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('match_players')
    .select('match_id')
    .eq('match_id', matchId)
    .eq('player_id', userId)
    .maybeSingle();
  return !!data;
}

export async function fetchJoinedMatchIds(userId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from('match_players')
    .select('match_id')
    .eq('player_id', userId);
  return new Set((data ?? []).map((r: Record<string, unknown>) => r.match_id as string));
}

export async function fetchMyTournamentCount(userId: string): Promise<number> {
  const { count } = await supabase
    .from('tournament_registrations')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);
  return count ?? 0;
}
