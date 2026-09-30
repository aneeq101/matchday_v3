import { supabase } from './supabase';

export interface SupportTicket {
  id: string;
  category: string;
  message: string;
  status: string;
  createdAt: string;
}

export async function submitSupportTicket(params: {
  userId: string;
  email: string;
  category: string;
  message: string;
}): Promise<boolean> {
  const { error } = await supabase.from('support_tickets').insert({
    user_id: params.userId,
    email: params.email,
    category: params.category,
    message: params.message.trim(),
  });
  return !error;
}

export async function fetchMyTickets(userId: string): Promise<SupportTicket[]> {
  const { data, error } = await supabase
    .from('support_tickets')
    .select('id, category, message, status, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    category: r.category as string,
    message: r.message as string,
    status: r.status as string,
    createdAt: r.created_at as string,
  }));
}
