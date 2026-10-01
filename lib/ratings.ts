import { supabase } from './supabase';
import type { BadgeTier, RatingTargetKind } from './ratingRules';

// Skill ratings, reviews and badges. Writes go through submit_rating()
// (lib/db/patch_ratings.sql), which validates, works out "played together"
// and sends the notifications. Badges are calculated by rating_summary().

export interface RatingSummary {
  sport: string;
  raters: number;
  avgOverall: number;
  badge: BadgeTier | null;
  tierCounts: Partial<Record<BadgeTier, number>>;
  skills: Record<string, number>;
  sportsmanship: number | null;
  reliability: number | null;
  verified: number;
  reviews: number;
}

export interface Rating {
  id: string;
  raterUserId: string;
  raterTeamId: string | null;
  raterName: string;
  raterInitials: string;
  raterColor: string;
  sport: string;
  overall: number;
  skills: Record<string, number>;
  sportsmanship: number | null;
  reliability: number | null;
  review: string;
  playedTogether: boolean;
  updatedAt: string;
}

const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

function rowToSummary(r: Record<string, unknown>): RatingSummary {
  const skills: Record<string, number> = {};
  Object.entries((r.skills as Record<string, unknown>) ?? {}).forEach(([k, v]) => { skills[k] = Number(v); });
  return {
    sport: r.sport as string,
    raters: Number(r.raters ?? 0),
    avgOverall: Number(r.avg_overall ?? 0),
    badge: (r.badge as BadgeTier) ?? null,
    tierCounts: (r.tier_counts as RatingSummary['tierCounts']) ?? {},
    skills,
    sportsmanship: num(r.sportsmanship),
    reliability: num(r.reliability),
    verified: Number(r.verified ?? 0),
    reviews: Number(r.reviews ?? 0),
  };
}

function friendlyError(message?: string): string {
  const m = message ?? '';
  if (m.includes('CANNOT_RATE_SELF')) return 'You can’t rate yourself.';
  if (m.includes('CANNOT_RATE_OWN')) return 'You can’t rate your own team or your own teammates on its behalf.';
  if (m.includes('NOT_CAPTAIN')) return 'Only the team captain can rate on behalf of the team.';
  if (m.includes('SPORT_MISMATCH')) return 'Your team plays a different sport.';
  if (m.includes('TARGET_NOT_FOUND')) return 'That player or team couldn’t be found.';
  if (m.includes('INVALID_SPORT')) return 'Ratings aren’t available for that sport yet.';
  if (m.includes('REVIEW_TOO_LONG')) return 'Your review is too long (500 characters max).';
  if (m.includes('INVALID_RATING')) return 'Please pick an overall level from 1 to 10.';
  return 'Something went wrong. Please try again.';
}

/** Per-sport averages + badge for a player or team (most-rated sport first). */
export async function fetchRatingSummary(kind: RatingTargetKind, id: string): Promise<RatingSummary[]> {
  const { data, error } = await supabase.rpc('rating_summary', { p_kind: kind, p_id: id });
  if (error || !data) {
    if (error) console.warn('[fetchRatingSummary]', error.message);
    return [];
  }
  return (data as Record<string, unknown>[]).map(rowToSummary);
}

/** Individual ratings / reviews, newest first. */
export async function fetchRatings(
  kind: RatingTargetKind,
  id: string,
  opts: { sport?: string; limit?: number } = {},
): Promise<Rating[]> {
  let q = supabase
    .from('ratings')
    .select('*')
    .eq(kind === 'team' ? 'target_team' : 'target_player', id);
  if (opts.sport) q = q.eq('sport', opts.sport);
  const { data, error } = await q.order('updated_at', { ascending: false }).limit(opts.limit ?? 100);
  if (error || !data) return [];

  const rows = data as Record<string, unknown>[];
  const ids = [...new Set(rows.map((r) => r.rater_user_id as string))];
  const { data: profiles } = ids.length
    ? await supabase.from('profiles').select('id, initials, avatar_color').in('id', ids)
    : { data: [] };
  const byId = new Map(((profiles ?? []) as Record<string, unknown>[]).map((p) => [p.id as string, p]));

  return rows.map((r) => {
    const name = (r.rater_name as string) || 'Player';
    const p = byId.get(r.rater_user_id as string);
    const skills: Record<string, number> = {};
    Object.entries((r.skills as Record<string, unknown>) ?? {}).forEach(([k, v]) => { skills[k] = Number(v); });
    return {
      id: r.id as string,
      raterUserId: r.rater_user_id as string,
      raterTeamId: (r.rater_team as string) ?? null,
      raterName: name,
      raterInitials: r.rater_team ? name.slice(0, 2).toUpperCase() : ((p?.initials as string) || name.slice(0, 2).toUpperCase()),
      raterColor: r.rater_team ? '#8b5cf6' : ((p?.avatar_color as string) ?? '#16a34a'),
      sport: r.sport as string,
      overall: Number(r.overall),
      skills,
      sportsmanship: num(r.sportsmanship),
      reliability: num(r.reliability),
      review: (r.review as string) ?? '',
      playedTogether: !!r.played_together,
      updatedAt: (r.updated_at as string) ?? '',
    };
  });
}

/** The rating this user (or one of their teams) already gave — to pre-fill the form. */
export async function fetchMyRating(
  kind: RatingTargetKind,
  targetId: string,
  sport: string,
  userId: string,
  asTeamId: string | null,
): Promise<Rating | null> {
  const all = await fetchRatings(kind, targetId, { sport });
  return all.find((r) => (asTeamId ? r.raterTeamId === asTeamId : r.raterUserId === userId && !r.raterTeamId)) ?? null;
}

export async function submitRating(params: {
  asTeamId: string | null;
  targetKind: RatingTargetKind;
  targetId: string;
  sport: string;
  overall: number;
  skills: Record<string, number>;
  sportsmanship: number | null;
  reliability: number | null;
  review: string;
}): Promise<{ ok: boolean; error?: string; badge?: BadgeTier | null; badgeUp?: boolean; isNew?: boolean }> {
  const { data, error } = await supabase.rpc('submit_rating', {
    p_as_team: params.asTeamId,
    p_target_kind: params.targetKind,
    p_target_id: params.targetId,
    p_sport: params.sport,
    p_overall: params.overall,
    p_skills: params.skills,
    p_sportsmanship: params.sportsmanship,
    p_reliability: params.reliability,
    p_review: params.review.trim(),
  });
  if (error) return { ok: false, error: friendlyError(error.message) };
  const d = (data ?? {}) as { badge?: BadgeTier | null; badge_up?: boolean; is_new?: boolean };
  return { ok: true, badge: d.badge ?? null, badgeUp: !!d.badge_up, isNew: !!d.is_new };
}

export async function deleteRating(id: string): Promise<boolean> {
  const { error } = await supabase.from('ratings').delete().eq('id', id);
  return !error;
}
