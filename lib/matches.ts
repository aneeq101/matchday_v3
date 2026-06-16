import { supabase } from './supabase';
import { type MatchItem } from '../data/mockData';

const SPORT_EMOJIS: Record<string, string> = {
  Football: '⚽', Cricket: '🏏', Tennis: '🎾',
  Basketball: '🏀', Badminton: '🏸', Baseball: '⚾',
};

export async function fetchMyMatches(userId: string): Promise<MatchItem[]> {
  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .eq('creator_id', userId)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false });

  if (error || !data?.length) return [];
  return data.map((row) => ({
    id:          row.id as string,
    sport:       row.sport as string,
    sportEmoji:  row.sport_emoji as string,
    title:       row.title as string,
    players:     row.players_format as string,
    date:        row.match_date as string,
    location:    row.location as string,
  }));
}

export async function createMatch(params: {
  userId: string;
  title: string;
  sport: string;
  playersFormat: string;
  matchDate: string;
  location: string;
}): Promise<MatchItem | null> {
  const emoji = SPORT_EMOJIS[params.sport] ?? '🏟️';
  const { data, error } = await supabase
    .from('matches')
    .insert({
      creator_id:     params.userId,
      title:          params.title,
      sport:          params.sport,
      sport_emoji:    emoji,
      players_format: params.playersFormat,
      match_date:     params.matchDate,
      location:       params.location,
    })
    .select()
    .single();

  if (error || !data) {
    console.error('[createMatch] error:', error?.message);
    return null;
  }
  return {
    id:         data.id as string,
    sport:      data.sport as string,
    sportEmoji: data.sport_emoji as string,
    title:      data.title as string,
    players:    data.players_format as string,
    date:       data.match_date as string,
    location:   data.location as string,
  };
}

export async function cancelMatch(matchId: string): Promise<boolean> {
  const { error } = await supabase
    .from('matches')
    .update({ status: 'cancelled' })
    .eq('id', matchId);
  return !error;
}

export async function fetchMyTournamentCount(userId: string): Promise<number> {
  const { count } = await supabase
    .from('tournament_registrations')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);
  return count ?? 0;
}
