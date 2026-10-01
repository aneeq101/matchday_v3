import { supabase } from './supabase';

// Challenge matches: a player challenges a player, or a captain challenges
// another team. All changes go through database functions
// (lib/db/patch_brackets_challenges.sql), which also send the notifications.
// Demo players/teams accept instantly so the flow can be tried end to end.

export type ChallengeKind = 'player' | 'team';
export type ChallengeStatus = 'pending' | 'accepted' | 'declined' | 'cancelled' | 'completed';

export interface Challenge {
  id: string;
  kind: ChallengeKind;
  sport: string;
  challengerId: string;
  challengerName: string;
  challengerUserId: string;
  opponentId: string;
  opponentName: string;
  opponentUserId: string;
  date: string;
  location: string;
  message: string;
  status: ChallengeStatus;
  winnerId: string | null;
  isDraw: boolean;
  score: string;
  createdAt: string;
}

function rowToChallenge(r: Record<string, unknown>): Challenge {
  return {
    id: r.id as string,
    kind: ((r.kind as ChallengeKind) ?? 'player'),
    sport: (r.sport as string) ?? '',
    challengerId: r.challenger_id as string,
    challengerName: (r.challenger_name as string) ?? '',
    challengerUserId: r.challenger_user_id as string,
    opponentId: r.opponent_id as string,
    opponentName: (r.opponent_name as string) ?? '',
    opponentUserId: r.opponent_user_id as string,
    date: (r.proposed_date as string) ?? 'TBD',
    location: (r.location as string) ?? '',
    message: (r.message as string) ?? '',
    status: ((r.status as ChallengeStatus) ?? 'pending'),
    winnerId: (r.winner_id as string) ?? null,
    isDraw: (r.is_draw as boolean) ?? false,
    score: (r.score as string) ?? '',
    createdAt: (r.created_at as string) ?? '',
  };
}

function friendlyError(message?: string): string {
  const m = message ?? '';
  if (m.includes('ALREADY_CHALLENGED')) return 'You already have an open challenge with them.';
  if (m.includes('CANNOT_CHALLENGE_SELF')) return 'You can’t challenge yourself or your own team.';
  if (m.includes('NOT_CAPTAIN')) return 'Only the team captain can send team challenges.';
  if (m.includes('OPPONENT_NOT_FOUND')) return 'That opponent couldn’t be found.';
  if (m.includes('NOT_PENDING') || m.includes('NOT_ACTIVE') || m.includes('NOT_ACCEPTED')) {
    return 'This challenge has changed — pull down to refresh.';
  }
  return 'Something went wrong. Please try again.';
}

/** From this user's point of view: which side am I on? */
export function mySide(c: Challenge, userId: string): { id: string; name: string; otherName: string; otherId: string } {
  return c.challengerUserId === userId
    ? { id: c.challengerId, name: c.challengerName, otherId: c.opponentId, otherName: c.opponentName }
    : { id: c.opponentId, name: c.opponentName, otherId: c.challengerId, otherName: c.challengerName };
}

export function resultFor(c: Challenge, userId: string): 'won' | 'lost' | 'draw' | null {
  if (c.status !== 'completed') return null;
  if (c.isDraw) return 'draw';
  return c.winnerId === mySide(c, userId).id ? 'won' : 'lost';
}

export async function fetchMyChallenges(userId: string): Promise<Challenge[]> {
  const { data, error } = await supabase
    .from('challenges')
    .select('*')
    .or(`challenger_user_id.eq.${userId},opponent_user_id.eq.${userId}`)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error || !data) return [];
  return data.map((r) => rowToChallenge(r as Record<string, unknown>));
}

export async function createChallenge(params: {
  kind: ChallengeKind;
  sport: string;
  challengerTeamId?: string | null;
  opponentId: string;
  date: string;
  location: string;
  message: string;
}): Promise<{ ok: boolean; accepted?: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('create_challenge', {
    p_kind: params.kind,
    p_sport: params.sport,
    p_challenger_team: params.challengerTeamId ?? null,
    p_opponent_id: params.opponentId,
    p_date: params.date,
    p_location: params.location.trim(),
    p_message: params.message.trim(),
  });
  if (error) return { ok: false, error: friendlyError(error.message) };
  return { ok: true, accepted: (data as { status?: string } | null)?.status === 'accepted' };
}

export async function respondToChallenge(id: string, accept: boolean): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.rpc('respond_challenge', { p_id: id, p_accept: accept });
  return error ? { ok: false, error: friendlyError(error.message) } : { ok: true };
}

export async function cancelChallenge(id: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.rpc('cancel_challenge', { p_id: id });
  return error ? { ok: false, error: friendlyError(error.message) } : { ok: true };
}

export async function recordChallengeResult(
  id: string,
  winnerId: string | null,
  isDraw: boolean,
  score: string,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.rpc('record_challenge_result', {
    p_id: id, p_winner_id: winnerId, p_is_draw: isDraw, p_score: score.trim(),
  });
  return error ? { ok: false, error: friendlyError(error.message) } : { ok: true };
}

// ── Incoming-challenge popup (components/InAppPopups.tsx) ──
// A challenge pops up for the person who has to answer it while it is
// pending and they haven't seen it yet (opponent_seen_at, see
// lib/db/patch_challenge_popup.sql).

/** Pending challenges waiting for this user that haven't popped up yet (newest first, last 7 days). */
export async function fetchUnseenIncoming(userId: string): Promise<Challenge[]> {
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const { data, error } = await supabase
    .from('challenges')
    .select('*')
    .eq('opponent_user_id', userId)
    .eq('status', 'pending')
    .is('opponent_seen_at', null)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(10);
  if (error || !data) return [];
  return data.map((r) => rowToChallenge(r as Record<string, unknown>));
}

/** "Decide later": stop it popping up again (it stays in Challenges). */
export async function markChallengeSeen(id: string): Promise<void> {
  await supabase.rpc('mark_challenge_seen', { p_id: id });
}

/** Calls onNew whenever a new challenge for this user is created. Returns an unsubscribe function. */
export function subscribeToIncomingChallenges(userId: string, onNew: (c: Challenge) => void): () => void {
  const channel = supabase
    .channel(`incoming-challenges:${userId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'challenges', filter: `opponent_user_id=eq.${userId}` },
      (payload) => {
        const c = rowToChallenge(payload.new as Record<string, unknown>);
        if (c.status === 'pending') onNew(c);
      },
    )
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

export async function fetchChallenge(id: string): Promise<Challenge | null> {
  const { data, error } = await supabase.from('challenges').select('*').eq('id', id).maybeSingle();
  if (error || !data) return null;
  return rowToChallenge(data as Record<string, unknown>);
}

/** Demo opponents accept instantly (the Challenges screen already says so) — no popup needed. */
export async function isDemoOpponent(c: Challenge): Promise<boolean> {
  const { data } = await supabase.from('profiles').select('is_demo').eq('id', c.opponentUserId).maybeSingle();
  return !!(data as { is_demo?: boolean } | null)?.is_demo;
}
