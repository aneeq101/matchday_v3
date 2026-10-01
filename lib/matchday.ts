import { supabase } from './supabase';

// "Ready for match day?" confirmations and final scores for pickup games.
// Database side: lib/db/patch_matchday.sql.
//   kind 'event' = a Play to Earn event (tournaments table)
//   kind 'match' = an Organize Match game (matches table)

export type EventKind = 'event' | 'match';

export interface ReadyAck { userId: string; name: string }

/** Who won, from the recorder's point of view. */
export type Outcome = 'won' | 'lost' | 'draw';

/** A ready event / match I haven't confirmed yet (the reminder popup). */
export interface PendingReady {
  kind: EventKind;
  id: string;
  name: string;
  sport: string;
  when: string;
  where: string;
  lineup: string;
  startsOn: string | null;
  organiserCanStart: boolean;
}

function friendlyError(message?: string): string {
  const m = message ?? '';
  if (m.includes('TOO_EARLY')) return 'You can record the score once match day arrives.';
  if (m.includes('SCORE_REQUIRED')) return 'Enter the final score.';
  if (m.includes('OUTCOME_REQUIRED')) return 'Choose who won.';
  if (m.includes('NOT_ALLOWED') || m.includes('NOT_IN_EVENT')) return 'Only players in this match can do that.';
  if (m.includes('CANCELLED')) return 'This match was cancelled.';
  return 'Something went wrong. Please try again.';
}

/** Local calendar date as YYYY-MM-DD (what the database stores in starts_on). */
export function toISODate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Has match day arrived? (starts_on is YYYY-MM-DD; today counts.) */
export function matchDayReached(startsOn?: string | null): boolean {
  return !!startsOn && startsOn <= toISODate(new Date());
}

/**
 * Can players record the final score of a pickup game yet?
 * Once match day arrives — or, with no date set, once the line-up is full.
 */
export function canRecordFinal(startsOn?: string | null, readyAt?: string | null): boolean {
  return startsOn ? matchDayReached(startsOn) : !!readyAt;
}

export async function ackReady(kind: EventKind, id: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.rpc('ack_ready', { p_kind: kind, p_id: id });
  return error ? { ok: false, error: friendlyError(error.message) } : { ok: true };
}

/** Ready events / matches I'm in but haven't confirmed (not snoozed), soonest first. */
export async function fetchPendingReady(): Promise<PendingReady[]> {
  const { data, error } = await supabase.rpc('my_pending_ready');
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map((r) => ({
    kind: r.kind === 'match' ? 'match' : 'event',
    id: r.id as string,
    name: (r.name as string) ?? '',
    sport: (r.sport as string) ?? '',
    when: (r.when_text as string) ?? '',
    where: (r.location as string) ?? '',
    lineup: (r.lineup as string) ?? '',
    startsOn: (r.starts_on as string) ?? null,
    organiserCanStart: !!r.organiser_can_start,
  }));
}

/** "Remind me later" — hidden for 12 hours (or until match day if sooner). */
export async function snoozeReady(kind: EventKind, id: string): Promise<void> {
  await supabase.rpc('snooze_ready', { p_kind: kind, p_id: id });
}

/** Who has confirmed they're ready, in the order they confirmed. */
export async function fetchReadyAcks(kind: EventKind, id: string): Promise<ReadyAck[]> {
  const { data, error } = await supabase
    .from('event_ready_acks')
    .select('user_id, acked_at')
    .eq('kind', kind)
    .eq('event_id', id)
    .order('acked_at', { ascending: true });
  if (error || !data?.length) return [];
  const ids = data.map((r: { user_id: string }) => r.user_id);
  const { data: profiles } = await supabase.from('profiles').select('id, name').in('id', ids);
  const names = new Map(((profiles ?? []) as { id: string; name: string }[]).map((p) => [p.id, p.name]));
  return ids.map((u) => ({ userId: u, name: names.get(u) ?? 'Player' }));
}

/** Final score for a pickup game — event (type 'match') or Organize Match game. */
export async function recordFinalScore(
  kind: EventKind,
  id: string,
  score: string,
  note: string,
  outcome: Outcome,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.rpc(kind === 'event' ? 'record_event_result' : 'record_pickup_result', {
    p_id: id, p_score: score.trim(), p_note: note.trim(), p_outcome: outcome,
  });
  return error ? { ok: false, error: friendlyError(error.message) } : { ok: true };
}
