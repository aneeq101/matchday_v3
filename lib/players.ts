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

/**
 * Real players within radiusKm of the given point, nearest first (PostGIS, server-side).
 * Returns null if the RPC isn't available so callers can fall back.
 */
export async function fetchNearbyPlayers(
  lat: number,
  lng: number,
  radiusKm: number,
): Promise<Player[] | null> {
  const { data: near, error } = await supabase.rpc('nearby_players', {
    lat, lng, radius_km: radiusKm,
  });
  if (error) {
    console.warn('[fetchNearbyPlayers]', error.message);
    return null;
  }
  const rows = (near ?? []) as { id: string; distance_km: number }[];
  if (!rows.length) return [];

  const { data, error: pErr } = await supabase
    .from('profiles')
    .select('*, profile_sports(*)')
    .in('id', rows.map((r) => r.id));
  if (pErr || !data) return null;

  const dist = new Map(rows.map((r) => [r.id, r.distance_km]));
  return data
    .map((row) => ({ ...dbToPlayer(row as Record<string, unknown>), distanceKm: dist.get((row as { id: string }).id) }))
    .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
}
