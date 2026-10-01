import { supabase } from './supabase';
import type { RatingTargetKind } from './ratingRules';

// "Vouch for my game": ask people you've played with to rate you (or your
// team). Database side: lib/db/patch_rating_requests.sql. The rating they give
// is a normal rating, so it counts toward badges under the usual rules.

export interface RatingSuggestion {
  id: string;
  name: string;
  initials: string;
  avatarColor: string;
  reason: 'played' | 'teammate' | 'follows' | 'search';
  alreadyRated: boolean;
  requested: boolean;     // asked in the last 30 days (or still pending)
}

export interface IncomingRequest {
  id: string;
  requesterUserId: string;
  subjectKind: RatingTargetKind;
  subjectId: string;
  subjectName: string;
  sport: string;
  note: string;
}

export const MAX_PER_REQUEST = 10;

function friendlyError(message?: string): string {
  const m = message ?? '';
  if (m.includes('DAILY_LIMIT')) return 'You’ve sent the maximum number of requests for today. Try again tomorrow.';
  if (m.includes('TOO_MANY')) return `You can ask up to ${MAX_PER_REQUEST} people at a time.`;
  if (m.includes('NOT_CAPTAIN')) return 'Only the team captain can ask for team ratings.';
  if (m.includes('NOTE_TOO_LONG')) return 'Your note is too long (200 characters max).';
  if (m.includes('NO_RATERS')) return 'Pick at least one person to ask.';
  return 'Something went wrong. Please try again.';
}

export async function fetchSuggestions(kind: RatingTargetKind, subjectId: string, sport: string): Promise<RatingSuggestion[]> {
  const { data, error } = await supabase.rpc('rating_request_suggestions', {
    p_subject_kind: kind, p_subject_id: subjectId, p_sport: sport,
  });
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    name: (r.name as string) ?? 'Player',
    initials: (r.initials as string) ?? '',
    avatarColor: (r.avatar_color as string) ?? '#16a34a',
    reason: (r.reason as RatingSuggestion['reason']) ?? 'follows',
    alreadyRated: !!r.already_rated,
    requested: !!r.requested,
  }));
}

export async function requestRatings(params: {
  kind: RatingTargetKind;
  subjectId: string;
  sport: string;
  raterIds: string[];
  note: string;
}): Promise<{ ok: boolean; sent?: number; skipped?: number; error?: string }> {
  const { data, error } = await supabase.rpc('request_ratings', {
    p_subject_kind: params.kind,
    p_subject_id: params.subjectId,
    p_sport: params.sport,
    p_rater_ids: params.raterIds,
    p_note: params.note.trim(),
  });
  if (error) return { ok: false, error: friendlyError(error.message) };
  const d = (data ?? {}) as { sent?: number; skipped?: number };
  return { ok: true, sent: d.sent ?? 0, skipped: d.skipped ?? 0 };
}

/** A pending request asking this user to rate a player/team (for the "X asked you" banner). */
export async function fetchIncomingRequest(userId: string, subjectId: string, sport?: string): Promise<IncomingRequest | null> {
  let q = supabase
    .from('rating_requests')
    .select('*')
    .eq('rater_user_id', userId)
    .eq('subject_id', subjectId)
    .eq('status', 'pending');
  if (sport) q = q.eq('sport', sport);
  const { data, error } = await q.order('created_at', { ascending: false }).limit(1);
  if (error || !data?.length) return null;
  const r = data[0] as Record<string, unknown>;
  return {
    id: r.id as string,
    requesterUserId: r.requester_user_id as string,
    subjectKind: (r.subject_kind as RatingTargetKind) ?? 'player',
    subjectId: r.subject_id as string,
    subjectName: (r.subject_name as string) ?? '',
    sport: r.sport as string,
    note: (r.note as string) ?? '',
  };
}

/** "Not now" — the asker isn't told. */
export async function declineRatingRequest(id: string): Promise<void> {
  await supabase.rpc('decline_rating_request', { p_id: id });
}
