import { supabase } from './supabase';

export interface FollowUser {
  id: string;
  name: string;
  initials: string;
  avatarColor: string;
  avatarUrl?: string;
}

export async function followUser(followerId: string, followingId: string): Promise<boolean> {
  const { error } = await supabase
    .from('follows')
    .insert({ follower_id: followerId, following_id: followingId });
  return !error;
}

export async function unfollowUser(followerId: string, followingId: string): Promise<boolean> {
  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', followerId)
    .eq('following_id', followingId);
  return !error;
}

export async function isFollowing(followerId: string, followingId: string): Promise<boolean> {
  const { data } = await supabase
    .from('follows')
    .select('follower_id')
    .eq('follower_id', followerId)
    .eq('following_id', followingId)
    .maybeSingle();
  return !!data;
}

async function idsToProfiles(ids: string[]): Promise<FollowUser[]> {
  if (!ids.length) return [];
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, initials, avatar_color, avatar_url')
    .in('id', ids);
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map((p) => ({
    id: p.id as string,
    name: (p.name as string) ?? 'Player',
    initials: (p.initials as string) ?? '?',
    avatarColor: (p.avatar_color as string) ?? '#16a34a',
    avatarUrl: (p.avatar_url as string) ?? undefined,
  }));
}

export async function fetchFollowers(userId: string): Promise<FollowUser[]> {
  const { data, error } = await supabase
    .from('follows')
    .select('follower_id')
    .eq('following_id', userId);
  if (error || !data) return [];
  return idsToProfiles(data.map((r: Record<string, unknown>) => r.follower_id as string));
}

export async function fetchFollowing(userId: string): Promise<FollowUser[]> {
  const { data, error } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', userId);
  if (error || !data) return [];
  return idsToProfiles(data.map((r: Record<string, unknown>) => r.following_id as string));
}

export async function fetchFollowCounts(userId: string): Promise<{ followers: number; following: number }> {
  const [f1, f2] = await Promise.all([
    supabase.from('follows').select('follower_id', { count: 'exact', head: true }).eq('following_id', userId),
    supabase.from('follows').select('following_id', { count: 'exact', head: true }).eq('follower_id', userId),
  ]);
  return { followers: f1.count ?? 0, following: f2.count ?? 0 };
}
