import { supabase } from './supabase';
import type { Sport } from '../data/mockData';

export interface ProfileSport extends Sport {
  id: string;
  details: Record<string, string>;
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
  const { data, error } = await supabase
    .from('profile_sports')
    .select('*')
    .eq('profile_id', userId)
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

export async function updateProfileStats(
  userId: string,
  stats: { matches: number; wins: number; rank: string }
): Promise<void> {
  await supabase.from('profiles').update({ stats }).eq('id', userId);
}
