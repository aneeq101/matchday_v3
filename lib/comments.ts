import { supabase } from './supabase';

export interface Comment {
  id: string;
  postId: string;
  authorId: string | null;
  authorName: string;
  authorInitials: string;
  authorAvatarColor: string;
  authorAvatarUrl?: string;
  text: string;
  time: string;
  isOwn: boolean;
}

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

function dbToComment(row: Record<string, unknown>, currentUserId: string): Comment {
  return {
    id: row.id as string,
    postId: row.post_id as string,
    authorId: (row.author_id as string) ?? null,
    authorName: (row.author_name as string) ?? 'Player',
    authorInitials: (row.author_initials as string) ?? 'P',
    authorAvatarColor: (row.author_avatar_color as string) ?? '#16a34a',
    authorAvatarUrl: (row.author_avatar_url as string) ?? undefined,
    text: row.text as string,
    time: relativeTime(row.created_at as string),
    isOwn: row.author_id === currentUserId,
  };
}

export async function fetchComments(postId: string, currentUserId: string): Promise<Comment[]> {
  const { data, error } = await supabase
    .from('post_comments')
    .select('*')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });

  if (error || !data) return [];
  return data.map((row: Record<string, unknown>) => dbToComment(row, currentUserId));
}

export async function addComment(params: {
  postId: string;
  userId: string | null;
  userName: string;
  userInitials: string;
  userColor: string;
  userAvatarUrl?: string;
  text: string;
}): Promise<Comment | null> {
  const { data, error } = await supabase
    .from('post_comments')
    .insert({
      post_id: params.postId,
      author_id: params.userId,
      author_name: params.userName,
      author_initials: params.userInitials,
      author_avatar_color: params.userColor,
      author_avatar_url: params.userAvatarUrl ?? null,
      text: params.text,
    })
    .select()
    .single();

  if (error || !data) return null;
  return dbToComment(data as Record<string, unknown>, params.userId ?? '');
}

export async function deleteComment(commentId: string): Promise<boolean> {
  const { error } = await supabase.from('post_comments').delete().eq('id', commentId);
  return !error;
}
