import { supabase } from './supabase';
import { POSTS, type Post } from '../data/mockData';

function relativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diffMs / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  if (d < 7) return `${d}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function dbToPost(row: Record<string, unknown>): Post {
  return {
    id: row.id as string,
    playerId: (row.author_id as string) ?? 'demo',
    playerName: row.author_name as string,
    initials: row.author_initials as string,
    avatarColor: (row.author_avatar_color as string) ?? '#16a34a',
    time: relativeTime(row.created_at as string),
    text: (row.text as string) ?? '',
    sports: Array.isArray(row.sports)
      ? row.sports
      : JSON.parse((row.sports as string) ?? '[]'),
    lookingFor: (row.looking_for as string) ?? '',
    likes: (row.likes_count as number) ?? 0,
    comments: (row.comments_count as number) ?? 0,
  };
}

export async function fetchPosts(): Promise<Post[]> {
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error || !data?.length) return POSTS;
  return data.map(dbToPost);
}

export async function createPost(params: {
  userId: string | null;
  userName: string;
  userInitials: string;
  userColor: string;
  text: string;
  lookingFor: string;
  sports: { name: string; skill: string; emoji: string }[];
}): Promise<Post | null> {
  const { data, error } = await supabase
    .from('posts')
    .insert({
      author_id: params.userId,
      author_name: params.userName,
      author_initials: params.userInitials,
      author_avatar_color: params.userColor,
      text: params.text,
      looking_for: params.lookingFor,
      sports: params.sports,
    })
    .select()
    .single();
  if (error || !data) return null;
  return dbToPost(data as Record<string, unknown>);
}

export async function fetchLikedPostIds(userId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from('post_likes')
    .select('post_id')
    .eq('user_id', userId);
  return new Set((data ?? []).map((r: Record<string, string>) => r.post_id));
}

export async function toggleLike(
  postId: string,
  userId: string,
  isCurrentlyLiked: boolean
): Promise<void> {
  if (isCurrentlyLiked) {
    await supabase
      .from('post_likes')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', userId);
  } else {
    await supabase.from('post_likes').insert({ post_id: postId, user_id: userId });
  }
}
