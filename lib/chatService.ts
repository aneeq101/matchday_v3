import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { CONVERSATIONS, CHAT_MESSAGES, type Conversation, type Message } from '../data/mockData';

// IDs '1'–'4' are mock demo conversations that use local data
export function isMockConvId(id: string): boolean {
  return ['1', '2', '3', '4'].includes(id);
}

function relativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diffMs / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (m < 1) return 'Now';
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  if (d < 7) return `${d}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function dbToMessage(row: Record<string, unknown>, currentUserId: string): Message {
  return {
    id: row.id as string,
    conversationId: row.conversation_id as string,
    text: row.text as string,
    sent: row.sender_id === currentUserId,
    time: formatTime(row.created_at as string),
  };
}

// ── Conversations ─────────────────────────────────────────────
// Uses SECURITY DEFINER RPCs (patch_conv_functions.sql) to bypass
// the RLS cross-participant join problem cleanly.

export async function fetchConversations(userId: string): Promise<{
  real: Conversation[];
  mock: Conversation[];
}> {
  const { data: rows, error } = await supabase.rpc('get_my_conversations');

  if (error || !rows?.length) return { real: [], mock: CONVERSATIONS };

  const real: Conversation[] = [];
  for (const row of rows as Record<string, unknown>[]) {
    const otherId = row.other_user_id as string;

    const { data: profile } = await supabase
      .from('profiles')
      .select('name, initials, avatar_color, gender')
      .eq('id', otherId)
      .single();

    real.push({
      id: row.id as string,
      playerId: otherId,
      playerName: (profile?.name as string) ?? 'Player',
      initials: (profile?.initials as string) ?? 'P',
      avatarColor: (profile?.avatar_color as string) ?? '#16a34a',
      gender: ((profile?.gender as string) ?? 'male') as 'male' | 'female',
      lastMessage: (row.last_message_text as string) ?? '',
      timestamp: relativeTime(row.last_message_at as string),
      unread: false,
    });
  }

  return { real, mock: real.length ? [] : CONVERSATIONS };
}

export async function getOrCreateConversation(
  _userId: string,
  otherUserId: string
): Promise<string | null> {
  // The RPC runs as SECURITY DEFINER, so it can join across participant
  // rows without the self-referential RLS problem.
  const { data, error } = await supabase.rpc('get_or_create_conversation', {
    other_user_id: otherUserId,
  });

  if (error || !data) return null;

  return data as string;
}

// ── Messages ──────────────────────────────────────────────────

export async function fetchMessages(
  conversationId: string,
  currentUserId: string
): Promise<Message[]> {
  if (isMockConvId(conversationId)) return CHAT_MESSAGES[conversationId] ?? [];

  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error || !data) return [];
  return data.map((row: Record<string, unknown>) => dbToMessage(row, currentUserId));
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  senderName: string,
  text: string
): Promise<Message | null> {
  const { data, error } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, sender_id: senderId, sender_name: senderName, text })
    .select()
    .single();

  if (error || !data) return null;
  return dbToMessage(data as Record<string, unknown>, senderId);
}

export function subscribeToMessages(
  conversationId: string,
  currentUserId: string,
  onMessage: (msg: Message) => void
): RealtimeChannel {
  return supabase
    .channel(`messages:${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => onMessage(dbToMessage(payload.new as Record<string, unknown>, currentUserId))
    )
    .subscribe();
}
