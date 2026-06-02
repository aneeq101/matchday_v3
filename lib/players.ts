import { supabase } from './supabase';
import { PLAYERS, type Player, type Sport } from '../data/mockData';

function dbToPlayer(row: Record<string, unknown>): Player {
  const sports: Sport[] = ((row.profile_sports as Record<string, unknown>[]) ?? []).map(
    (s) => ({
      name: s.sport as string,
      skill: s.skill as 'Beginner' | 'Intermediate' | 'Advanced',
      emoji: (s.emoji as string) ?? '',
    })
  );
  const raw = row.stats;
  const stats =
    typeof raw === 'string'
      ? JSON.parse(raw)
      : (raw as { matches: number; wins: number; rank: string }) ?? {
          matches: 0,
          wins: 0,
          rank: 'Bronze',
        };
  return {
    id: row.id as string,
    name: row.name as string,
    initials: (row.initials as string) ?? (row.name as string).slice(0, 2).toUpperCase(),
    gender: ((row.gender as string) ?? 'male') as 'male' | 'female',
    area: (row.area as string) ?? '',
    distance: '',
    bio: (row.bio as string) ?? '',
    sports,
    privacy: ((row.privacy as string) ?? 'public') as 'public' | 'private',
    joinDate: (row.join_date as string) ?? '',
    stats,
    avatarColor: (row.avatar_color as string) ?? '#16a34a',
    offsetKm: { dx: 0, dy: 0 },
  };
}

export async function fetchPlayers(): Promise<Player[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*, profile_sports(*)')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error || !data?.length) return PLAYERS;
  return data.map(dbToPlayer);
}
