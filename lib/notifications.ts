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
  new_message:         { icon: 'chatbubble-outline',   color: '#16a34a' },
  team_invite:         { icon: 'people-outline',       color: '#8b5cf6' },
  team_join:           { icon: 'people-outline',       color: '#8b5cf6' },
  tournament_started:  { icon: 'git-network-outline',  color: '#8b5cf6' },
  challenge:           { icon: 'flash-outline',        color: '#f97316' },
  challenge_update:    { icon: 'flash-outline',        color: '#f97316' },
  new_rating:          { icon: 'star-outline',         color: '#f59e0b' },
  new_badge:           { icon: 'medal-outline',        color: '#a16207' },
  rating_request:      { icon: 'star-half-outline',    color: '#16a34a' },
  nearby_event:        { icon: 'location-outline',     color: '#16a34a' },
  event_ready:         { icon: 'megaphone-outline',    color: '#7c3aed' },
  match_result:        { icon: 'create-outline',       color: '#f59e0b' },
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

/** Mark the notifications about one challenge as read (after it was handled in the popup). */
export async function markChallengeNotifsRead(userId: string, challengeId: string): Promise<void> {
  await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('data->>challenge_id', challengeId)
    .eq('read', false);
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

// ── In-app popups (components/InAppPopups.tsx) ──
// These notification types also pop up over the app while it's open (or the
// next time it's opened, for the last 7 days). Closing a popup marks it read.
//   challenge_update  accepted / declined / called off / result recorded
//   rating_request    someone asked you to rate them
//   new_rating        someone rated you (data.rating_id)
//   new_badge         you earned a badge
//   nearby_event      new tournament / league / paid match near you in your sport
//   event_ready       an event / match you're in has enough players — "Ready for match day?"
//   match_result      someone recorded a result in an event / match you're in

export const POPUP_TYPES = [
  'challenge_update', 'rating_request', 'new_rating', 'new_badge', 'nearby_event', 'event_ready', 'match_result',
] as const;
export type PopupType = typeof POPUP_TYPES[number];

export interface PopupNotif {
  id: string;
  type: PopupType;
  title: string;
  body: string;
  data: Record<string, unknown>;
  createdAt: string;
}

function toPopup(row: Record<string, unknown>): PopupNotif | null {
  if (!(POPUP_TYPES as readonly string[]).includes(row.type as string)) return null;
  return {
    id: row.id as string,
    type: row.type as PopupType,
    title: (row.title as string) ?? '',
    body: (row.body as string) ?? '',
    data: (row.data as Record<string, unknown>) ?? {},
    createdAt: (row.created_at as string) ?? '',
  };
}

/** Unread popup-type notifications from the last 7 days, oldest first. */
export async function fetchUnreadPopupNotifs(userId: string): Promise<PopupNotif[]> {
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const { data, error } = await supabase
    .from('notifications')
    .select('id, type, title, body, data, created_at')
    .eq('user_id', userId)
    .in('type', POPUP_TYPES as unknown as string[])
    .eq('read', false)
    .gte('created_at', since)
    .order('created_at', { ascending: true })
    .limit(30);
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(toPopup).filter((x): x is PopupNotif => !!x);
}

/** Live: calls onNotif for each new popup-type notification. Returns an unsubscribe function. */
export function subscribeToPopupNotifs(userId: string, onNotif: (n: PopupNotif) => void): () => void {
  const channel = supabase
    .channel(`popup-notifs:${userId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
      (payload) => {
        const n = toPopup(payload.new as Record<string, unknown>);
        if (n) onNotif(n);
      },
    )
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}
