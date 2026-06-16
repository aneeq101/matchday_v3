import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
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

export function dbToPost(row: Record<string, unknown>): Post {
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
    mediaUrl: (row.media_url as string) ?? undefined,
    mediaType: (row.media_type as 'image' | 'video') ?? undefined,
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

export async function uploadPostMedia(
  userId: string,
  uri: string,
  type: 'image' | 'video',
  mimeType?: string
): Promise<string | null> {
  const contentType = mimeType ?? (type === 'image' ? 'image/jpeg' : 'video/mp4');
  const ext = contentType.split('/')[1]?.replace('quicktime', 'mov') ?? (type === 'image' ? 'jpg' : 'mp4');
  const path = `${userId}/${Date.now()}.${ext}`;

  try {
    // Videos can be 100 MB+ — loading into an ArrayBuffer OOMs on Android.
    // Use FileSystem.uploadAsync for native video: it streams the file directly.
    if (type === 'video' && Platform.OS !== 'web') {
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
      const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token ?? anonKey;

      const uploadUrl = `${supabaseUrl}/storage/v1/object/post-media/${path}`;
      const result = await FileSystem.uploadAsync(uploadUrl, uri, {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': contentType,
          'x-upsert': 'false',
        },
      });

      if (result.status < 200 || result.status >= 300) {
        console.error('[uploadPostMedia] video upload failed:', result.status, result.body);
        return null;
      }

      const { data } = supabase.storage.from('post-media').getPublicUrl(path);
      return data.publicUrl;
    }

    // Images are small — ArrayBuffer is fine on all platforms including web.
    const response = await fetch(uri);
    const arrayBuffer = await response.arrayBuffer();

    const { error } = await supabase.storage
      .from('post-media')
      .upload(path, arrayBuffer, { contentType, upsert: false });

    if (error) {
      console.error('[uploadPostMedia] storage error:', error.message);
      return null;
    }

    const { data } = supabase.storage.from('post-media').getPublicUrl(path);
    return data.publicUrl;
  } catch (err) {
    console.error('[uploadPostMedia] error:', err);
    return null;
  }
}

export async function createPost(params: {
  userId: string | null;
  userName: string;
  userInitials: string;
  userColor: string;
  text: string;
  lookingFor: string;
  sports: { name: string; skill: string; emoji: string }[];
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
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
      media_url: params.mediaUrl ?? null,
      media_type: params.mediaType ?? null,
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
): Promise<boolean> {
  if (isCurrentlyLiked) {
    const { error } = await supabase
      .from('post_likes')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', userId);
    return !error;
  } else {
    const { error } = await supabase
      .from('post_likes')
      .insert({ post_id: postId, user_id: userId });
    return !error;
  }
}
