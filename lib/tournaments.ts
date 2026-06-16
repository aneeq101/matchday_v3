import { supabase } from './supabase';
import { TOURNAMENTS, type Tournament, type EventType } from '../data/mockData';

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
  };
}

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
  userId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('tournament_registrations')
    .insert({ tournament_id: tournamentId, user_id: userId });
  return !error;
}

export async function unregisterFromTournament(
  tournamentId: string,
  userId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('tournament_registrations')
    .delete()
    .eq('tournament_id', tournamentId)
    .eq('user_id', userId);
  return !error;
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
      participants_count: 0,
    })
    .select()
    .single();
  if (error || !data) return null;
  return dbToTournament(data as Record<string, unknown>);
}
