import { supabase } from './supabase';
import type { Sport } from '../data/mockData';

export interface ProfileSport extends Sport {
  id: string;
  details: Record<string, string>;
}

export interface PlayerStat {
  sport: string;
  matches: number;
  wins: number;
  losses: number;
  draws: number;
  sportStats: Record<string, string | number>;
}

export interface MyRanking {
  matches: number;
  wins: number;
  winRate: number;
  areaRank: number;
  areaTotal: number;
  area: string;
}

export async function fetchMySports(userId: string): Promise<ProfileSport[]> {
  const resolvedId = MOCK_ID_TO_UUID[userId] ?? userId;
  const { data, error } = await supabase
    .from('profile_sports')
    .select('*')
    .eq('profile_id', resolvedId)
    .order('created_at', { ascending: true });

  if (error || !data) return [];
  return data.map((row: Record<string, unknown>) => ({
    id: row.id as string,
    name: row.sport as string,
    skill: (row.skill as Sport['skill']) ?? 'Beginner',
    emoji: (row.emoji as string) ?? '',
    details: (typeof row.details === 'object' && row.details !== null
      ? row.details
      : {}) as Record<string, string>,
  }));
}

export async function addSport(params: {
  userId: string;
  sport: string;
  skill: string;
  emoji: string;
  details: Record<string, string>;
}): Promise<ProfileSport | null> {
  const { data, error } = await supabase
    .from('profile_sports')
    .upsert(
      {
        profile_id: params.userId,
        sport: params.sport,
        skill: params.skill,
        emoji: params.emoji,
        details: params.details,
      },
      { onConflict: 'profile_id,sport' }
    )
    .select()
    .single();

  if (error || !data) return null;
  const row = data as Record<string, unknown>;
  return {
    id: row.id as string,
    name: row.sport as string,
    skill: row.skill as Sport['skill'],
    emoji: (row.emoji as string) ?? '',
    details: (row.details as Record<string, string>) ?? {},
  };
}

export async function removeSport(sportId: string): Promise<boolean> {
  const { error } = await supabase.from('profile_sports').delete().eq('id', sportId);
  return !error;
}

export async function fetchMyRanking(): Promise<MyRanking | null> {
  const { data, error } = await supabase.rpc('get_my_ranking');
  if (error || !data?.length) return null;
  const row = data[0] as Record<string, unknown>;
  return {
    matches: (row.matches as number) ?? 0,
    wins: (row.wins as number) ?? 0,
    winRate: parseFloat(String(row.win_rate ?? '0')),
    areaRank: (row.area_rank as number) ?? 1,
    areaTotal: (row.area_total as number) ?? 1,
    area: (row.area as string) ?? '',
  };
}

// Maps mock player IDs ('1'–'6') used when DB fetch falls back to the real demo UUIDs
const MOCK_ID_TO_UUID: Record<string, string> = {
  '1': '00000000-0000-0000-0000-000000000001',
  '2': '00000000-0000-0000-0000-000000000002',
  '3': '00000000-0000-0000-0000-000000000003',
  '4': '00000000-0000-0000-0000-000000000004',
  '5': '00000000-0000-0000-0000-000000000005',
  '6': '00000000-0000-0000-0000-000000000006',
};

export interface FullProfile {
  bio: string;
  area: string;
  joinDate: string;
  stats: { matches: number; wins: number; rank: string };
}

export async function fetchFullProfile(userId: string): Promise<FullProfile | null> {
  const resolvedId = MOCK_ID_TO_UUID[userId] ?? userId;
  const { data, error } = await supabase
    .from('profiles')
    .select('bio, area, join_date, stats')
    .eq('id', resolvedId)
    .single();

  if (error || !data) return null;
  const row = data as Record<string, unknown>;
  const raw = row.stats;
  const stats =
    typeof raw === 'string'
      ? JSON.parse(raw)
      : (raw as { matches: number; wins: number; rank: string }) ?? {
          matches: 0, wins: 0, rank: 'Bronze',
        };
  return {
    bio:      (row.bio as string) ?? '',
    area:     (row.area as string) ?? '',
    joinDate: (row.join_date as string) ?? '',
    stats,
  };
}

export async function fetchPlayerStats(userId: string): Promise<PlayerStat[]> {
  const resolvedId = MOCK_ID_TO_UUID[userId] ?? userId;
  const { data, error } = await supabase
    .from('player_stats')
    .select('sport, matches, wins, losses, draws, sport_stats')
    .eq('profile_id', resolvedId)
    .order('matches', { ascending: false });

  if (error) {
    console.warn('[fetchPlayerStats] error for', resolvedId, error.message);
    return [];
  }
  if (!data) return [];
  return data.map((row: Record<string, unknown>) => ({
    sport: row.sport as string,
    matches: (row.matches as number) ?? 0,
    wins: (row.wins as number) ?? 0,
    losses: (row.losses as number) ?? 0,
    draws: (row.draws as number) ?? 0,
    sportStats: (typeof row.sport_stats === 'object' && row.sport_stats !== null
      ? row.sport_stats
      : {}) as Record<string, string | number>,
  }));
}

export async function updateProfileStats(
  userId: string,
  stats: { matches: number; wins: number; rank: string }
): Promise<void> {
  await supabase.from('profiles').update({ stats }).eq('id', userId);
}
