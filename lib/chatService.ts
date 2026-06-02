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

export async function fetchConversations(userId: string): Promise<{
  real: Conversation[];
  mock: Conversation[];
}> {
  const { data: participantRows } = await supabase
    .from('conversation_participants')
    .select('conversation_id')
    .eq('user_id', userId);

  const convIds = (participantRows ?? []).map(
    (p: Record<string, string>) => p.conversation_id
  );

  if (!convIds.length) return { real: [], mock: CONVERSATIONS };

  const { data: convs } = await supabase
    .from('conversations')
    .select('*, conversation_participants(user_id)')
    .in('id', convIds)
    .order('last_message_at', { ascending: false });

  if (!convs?.length) return { real: [], mock: CONVERSATIONS };

  const real: Conversation[] = [];
  for (const conv of convs as Record<string, unknown>[]) {
    const participants = conv.conversation_participants as { user_id: string }[];
    const otherId = participants.find((p) => p.user_id !== userId)?.user_id;
    if (!otherId) continue;

    const { data: profile } = await supabase
      .from('profiles')
      .select('name, initials, avatar_color, gender')
      .eq('id', otherId)
      .single();

    real.push({
      id: conv.id as string,
      playerId: otherId,
      playerName: (profile?.name as string) ?? 'Player',
      initials: (profile?.initials as string) ?? 'P',
      avatarColor: (profile?.avatar_color as string) ?? '#16a34a',
      gender: ((profile?.gender as string) ?? 'male') as 'male' | 'female',
      lastMessage: (conv.last_message_text as string) ?? '',
      timestamp: relativeTime(conv.last_message_at as string),
      unread: false,
    });
  }

  return { real, mock: real.length ? [] : CONVERSATIONS };
}

export async function getOrCreateConversation(
  userId: string,
  otherUserId: string
): Promise<string | null> {
  // Look for an existing shared conversation
  const { data: mine } = await supabase
    .from('conversation_participants')
    .select('conversation_id')
    .eq('user_id', userId);

  const myIds = (mine ?? []).map((c: Record<string, string>) => c.conversation_id);

  if (myIds.length) {
    const { data: shared } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', otherUserId)
      .in('conversation_id', myIds)
      .limit(1);

    if (shared?.length) return (shared[0] as Record<string, string>).conversation_id;
  }

  const { data: conv } = await supabase
    .from('conversations')
    .insert({})
    .select()
    .single();

  if (!conv) return null;

  await supabase.from('conversation_participants').insert([
    { conversation_id: (conv as Record<string, string>).id, user_id: userId },
    { conversation_id: (conv as Record<string, string>).id, user_id: otherUserId },
  ]);

  return (conv as Record<string, string>).id;
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
