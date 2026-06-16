import { supabase } from './supabase';

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  read: boolean;
  createdAt: string;
}

const TYPE_ICONS: Record<string, { icon: string; color: string }> = {
  booking_confirmed:   { icon: 'calendar-outline',    color: '#16a34a' },
  match_join:          { icon: 'football-outline',     color: '#3b82f6' },
  tournament_register: { icon: 'trophy-outline',       color: '#f59e0b' },
  new_follower:        { icon: 'person-add-outline',   color: '#8b5cf6' },
};

export function notifIcon(type: string): { icon: string; color: string } {
  return TYPE_ICONS[type] ?? { icon: 'notifications-outline', color: '#6b7280' };
}

function rowToNotif(row: Record<string, unknown>): AppNotification {
  return {
    id: row.id as string,
    type: row.type as string,
    title: row.title as string,
    body: (row.body as string) ?? '',
    data: (row.data as Record<string, unknown>) ?? {},
    read: (row.read as boolean) ?? false,
    createdAt: (row.created_at as string) ?? '',
  };
}

export async function fetchNotifications(userId: string): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error || !data) return [];
  return data.map((r) => rowToNotif(r as Record<string, unknown>));
}

export async function countUnread(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false);
  if (error) return 0;
  return count ?? 0;
}

export async function markRead(id: string): Promise<void> {
  await supabase.from('notifications').update({ read: true }).eq('id', id);
}

export async function markAllRead(userId: string): Promise<void> {
  await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false);
}

export async function createNotification(params: {
  userId: string;
  type: string;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
}): Promise<void> {
  await supabase.from('notifications').insert({
    user_id: params.userId,
    type: params.type,
    title: params.title,
    body: params.body ?? '',
    data: params.data ?? {},
    read: false,
  });
}
