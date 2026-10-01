import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator, AppState,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  fetchUnseenIncoming, subscribeToIncomingChallenges, markChallengeSeen, respondToChallenge,
  fetchChallenge, resultFor, isDemoOpponent, type Challenge,
} from '../lib/challenges';
import {
  markRead, markChallengeNotifsRead, fetchUnreadPopupNotifs, subscribeToPopupNotifs,
  type PopupNotif,
} from '../lib/notifications';
import { fetchRating, findRatingNear, type Rating } from '../lib/ratings';
import { fetchTeam } from '../lib/teams';
import { fetchTournament } from '../lib/tournaments';
import { fetchMatch } from '../lib/matches';
import { ackReady, fetchPendingReady, snoozeReady, toISODate, type EventKind, type PendingReady } from '../lib/matchday';
import type { Tournament } from '../data/mockData';
import { fetchRequest, declineRatingRequest } from '../lib/ratingRequests';
import { skillsFor, levelFor, levelColor, ntrpFor, badgeInfo, BADGE_RULES, type RatingTargetKind } from '../lib/ratingRules';
import { openConversation } from '../lib/chatService';
import { SPORT_EMOJI } from '../lib/sportProfile';
import BadgeChip from './BadgeChip';

// One place for every in-app popup, shown over any screen while signed in.
// Only one card is on screen at a time; the rest wait in a queue.
//
//  Challenges
//   • NEW challenge for you / your team → Accept / Decline / Decide later.
//     Shown once (challenges.opponent_seen_at).
//   • UPDATES on your challenges → accepted, declined, called off, result.
//  Ratings
//   • Someone ASKED you to rate them → Rate now / Not now / Later.
//   • Someone RATED you → shows the rating they gave (overall, skills, review).
//   • You earned a BADGE.
//  Events
//   • A tournament, league or paid match in your sport was created near you.
//   • READY FOR MATCH DAY? — an event / match you're in has enough players.
//     This one is a reminder: it comes from my_pending_ready() (not from a
//     notification being unread) and keeps coming back on app start /
//     foreground until you tap "I'm ready". "Remind me later" snoozes it
//     for 12 hours (or until match day).
//   • A result was recorded in an event / match you're in.
//
// Updates, rating requests, ratings and badges come from unread notifications
// (types in POPUP_TYPES, lib/notifications.ts); closing a card marks it read.
// Everything arrives live (Supabase Realtime) and is also picked up when the
// app starts or comes back to the foreground (last 7 days).

interface Target { kind: RatingTargetKind; id: string; name: string; sport: string }

type Item =
  | { type: 'incoming'; key: string; c: Challenge }
  | { type: 'update'; key: string; c: Challenge }
  | { type: 'rating_request'; key: string; notifId: string; requestId: string; requesterName: string; requesterUserId: string; note: string; target: Target }
  | { type: 'new_rating'; key: string; notifId: string; rating: Rating; target: Target; updated: boolean }
  | { type: 'new_badge'; key: string; notifId: string; badge: string; target: Target }
  | { type: 'nearby_event'; key: string; notifId: string; event: Tournament; distance: string }
  | { type: 'event_ready'; key: string; ready: PendingReady }
  | { type: 'match_result'; key: string; notifId: string; title: string; body: string; kind: EventKind; id: string };

type Outcome = null | 'accepted' | 'declined';
type Busy = null | 'accept' | 'decline' | 'later' | 'message';

const str = (v: unknown) => (typeof v === 'string' ? v : '');
/**
 * Who a rating / badge notification is about. Newer notifications say so
 * directly (rate_kind, rate_id, rate_name, sport); older ones only have
 * rating_player_id / team_id, plus the sport and tier in the text.
 */
async function targetFrom(n: PopupNotif): Promise<Target> {
  const d = n.data;
  const kind: RatingTargetKind = d.rate_kind === 'team' || (!d.rate_kind && typeof d.team_id === 'string') ? 'team' : 'player';
  const id = str(d.rate_id) || str(kind === 'team' ? d.team_id : d.rating_player_id);
  let name = str(d.rate_name);
  if (!name && kind === 'team' && id) name = (await fetchTeam(id))?.name ?? '';
  const sport = str(d.sport)
    || (n.title.match(/(?:New|Updated) (\w+) rating/)?.[1] ?? '')
    || (n.body.match(/ in (\w+)\.$/)?.[1] ?? '');
  return { kind, id, name, sport };
}

export default function InAppPopups({ userId }: { userId: string }) {
  const router = useRouter();
  const [queue, setQueue]       = useState<Item[]>([]);
  const [busy, setBusy]         = useState<Busy>(null);
  const [outcome, setOutcome]   = useState<Outcome>(null);
  const [confirmDecline, setConfirmDecline] = useState(false);
  const [error, setError]       = useState('');
  const [readyDone, setReadyDone] = useState(false);
  const handledIncoming = useRef(new Set<string>());
  const handledNotifs   = useRef(new Set<string>());
  const handledReady    = useRef(new Set<string>());   // confirmed / snoozed this session

  const enqueue = useCallback((items: Item[]) => {
    setQueue((prev) => {
      const next = [...prev];
      for (const it of items) {
        const i = next.findIndex((x) => x.key === it.key);
        if (it.type === 'incoming') {
          if (i === -1 && !handledIncoming.current.has(it.c.id)) next.push(it);
        } else if (i === -1) {
          next.push(it);
        } else if (it.type === 'update') {
          next[i] = it;   // newer state of the same challenge (e.g. called off before you answered)
        }
      }
      return next.length === prev.length && next.every((x, k) => x === prev[k]) ? prev : next;
    });
  }, []);

  // Ready events I haven't confirmed → reminder cards
  const checkReady = useCallback(() => {
    fetchPendingReady().then((list) => enqueue(list
      .filter((r) => !handledReady.current.has(`r:${r.kind}:${r.id}`))
      .map((r) => ({ type: 'event_ready' as const, key: `r:${r.kind}:${r.id}`, ready: r }))));
  }, [enqueue]);

  // A popup-type notification → load what the card needs and queue it
  const onNotif = useCallback(async (n: PopupNotif) => {
    if (handledNotifs.current.has(n.id)) return;
    handledNotifs.current.add(n.id);
    const d = n.data;

    if (n.type === 'challenge_update') {
      const id = str(d.challenge_id);
      const c = id ? await fetchChallenge(id) : null;
      if (!c || c.status === 'pending') return;
      // Demo opponents accept instantly — the Challenges screen already said so
      if (c.status === 'accepted' && c.challengerUserId === userId && await isDemoOpponent(c)) {
        markChallengeNotifsRead(userId, c.id).catch(() => {});
        return;
      }
      enqueue([{ type: 'update', key: `c:${c.id}`, c }]);
      return;
    }

    if (n.type === 'rating_request') {
      const req = await fetchRequest(str(d.rating_request_id));
      if (!req || req.status !== 'pending') { markRead(n.id).catch(() => {}); return; }
      enqueue([{
        type: 'rating_request', key: `n:${n.id}`, notifId: n.id, requestId: req.id,
        requesterName: req.requesterName, requesterUserId: req.requesterUserId, note: req.note,
        target: { kind: req.subjectKind, id: req.subjectId, name: req.subjectName, sport: req.sport },
      }]);
      return;
    }

    if (n.type === 'new_rating') {
      const target = await targetFrom(n);
      // Newer notifications point at the rating; older ones are matched by time
      const rating = (str(d.rating_id) && await fetchRating(str(d.rating_id)))
        || await findRatingNear(target.kind, target.id, n.createdAt);
      if (!rating) return;
      const updated = d.updated === true || n.title.includes('Updated');
      enqueue([{
        type: 'new_rating', key: `n:${n.id}`, notifId: n.id, rating, updated,
        target: { ...target, sport: target.sport || rating.sport },
      }]);
      return;
    }

    if (n.type === 'nearby_event') {
      const ev = await fetchTournament(str(d.tournament_id));
      // Only while you can still sign up
      if (!ev || (ev.status ?? 'active') !== 'active' || ev.participants >= ev.maxParticipants) {
        markRead(n.id).catch(() => {});
        return;
      }
      const distance = n.body.match(/(under 1|\d+) km away/)?.[0] ?? '';
      enqueue([{ type: 'nearby_event', key: `n:${n.id}`, notifId: n.id, event: ev, distance }]);
      return;
    }

    if (n.type === 'event_ready') {
      // The reminder list is the source of truth — just refresh it
      checkReady();
      return;
    }

    if (n.type === 'match_result') {
      const kind: EventKind = d.event_kind === 'match' || typeof d.match_id === 'string' ? 'match' : 'event';
      const id = str(kind === 'match' ? d.match_id : d.tournament_id);
      enqueue([{ type: 'match_result', key: `n:${n.id}`, notifId: n.id, title: n.title, body: n.body, kind, id }]);
      return;
    }

    if (n.type === 'new_badge') {
      const badge = str(d.badge) || (n.title.match(/(\w+) badge earned/)?.[1] ?? '').toLowerCase();
      if (!badgeInfo(badge)) return;
      enqueue([{ type: 'new_badge', key: `n:${n.id}`, notifId: n.id, badge, target: await targetFrom(n) }]);
    }
  }, [userId, enqueue, checkReady]);

  // Missed while away: on start and whenever the app comes back to the foreground
  useEffect(() => {
    const check = () => {
      fetchUnseenIncoming(userId).then((list) =>
        enqueue([...list].reverse().map((c) => ({ type: 'incoming' as const, key: `c:${c.id}`, c }))));
      fetchUnreadPopupNotifs(userId).then((list) => { list.forEach((n) => { onNotif(n); }); });
      checkReady();
    };
    check();
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') check(); });
    return () => sub.remove();
  }, [userId, enqueue, onNotif, checkReady]);

  // Live
  useEffect(() => subscribeToIncomingChallenges(userId, (c) => enqueue([{ type: 'incoming', key: `c:${c.id}`, c }])), [userId, enqueue]);
  useEffect(() => subscribeToPopupNotifs(userId, (n) => { onNotif(n); }), [userId, onNotif]);

  const item = queue[0];

  // The card on screen changed (e.g. called off while you were deciding)
  useEffect(() => {
    setConfirmDecline(false);
    setError('');
  }, [item?.key, item?.type === 'update' || item?.type === 'incoming' ? item.c.status : '']);

  const next = () => {
    if (item?.type === 'incoming') handledIncoming.current.add(item.c.id);
    setReadyDone(false);
    setQueue((prev) => prev.slice(1));
    setOutcome(null);
    setConfirmDecline(false);
    setError('');
    setBusy(null);
  };

  /** Close the current card and mark what it was about as read (a ready reminder is snoozed instead). */
  const close = () => {
    if (!item) return;
    if (item.type === 'incoming' || item.type === 'update') markChallengeNotifsRead(userId, item.c.id).catch(() => {});
    else if (item.type === 'event_ready') {
      handledReady.current.add(item.key);
      snoozeReady(item.ready.kind, item.ready.id).catch(() => {});
    } else markRead(item.notifId).catch(() => {});
    next();
  };

  const messageUser = async (otherUserId: string, name: string) => {
    setBusy('message');
    const res = await openConversation(otherUserId);
    setBusy(null);
    if (res.error !== undefined) { setError(res.error); return; }
    close();
    router.push({ pathname: '/chat', params: { id: res.id, name, initials: name.slice(0, 2).toUpperCase(), color: '#f97316' } });
  };

  const openRatings = (t: Target, rate?: boolean) => {
    close();
    router.push({ pathname: '/ratings', params: { kind: t.kind, id: t.id, name: t.name, ...(rate ? { rate: t.sport } : {}) } });
  };

  if (!item) return null;

  const more = queue.length - 1;
  const closeLabel = more > 0 ? 'Next' : 'Close';

  const wrap = (children: React.ReactNode, onRequestClose: () => void) => (
    <Modal visible transparent animationType="fade" onRequestClose={onRequestClose}>
      <View style={styles.overlay}>
        <View style={styles.card} accessibilityViewIsModal>{children}</View>
      </View>
    </Modal>
  );

  // ── Rating request ──────────────────────────────────────────
  if (item.type === 'rating_request') {
    const t = item.target;
    const teamAsk = t.kind === 'team';
    return wrap(
      <>
        <Badge icon="star-half" color="#16a34a" />
        <Text style={[styles.kicker, { color: '#16a34a' }]}>RATING REQUEST{more > 0 ? ` · ${more} more` : ''}</Text>
        <Text style={styles.title}>
          <Text style={styles.name}>{item.requesterName}</Text>
          {teamAsk ? ` asked you to rate ${t.name}` : ' asked you to rate their game'}
        </Text>
        <Text style={styles.sub}>
          {SPORT_EMOJI[t.sport] ?? '🏆'} {t.sport} · takes about a minute. Your honest rating helps them earn badges and helps others find the right game.
        </Text>
        {!!item.note && <View style={styles.quote}><Text style={styles.quoteText}>“{item.note}”</Text></View>}
        <View style={styles.row2}>
          <Btn kind="ghost" half label="Not now" onPress={() => { declineRatingRequest(item.requestId).catch(() => {}); close(); }} />
          <Btn kind="primary" half icon="star" label="Rate now" onPress={() => openRatings(t, true)} />
        </View>
        <TouchableOpacity style={styles.later} onPress={close}>
          <Text style={styles.laterText}>Later</Text>
        </TouchableOpacity>
      </>,
      close,
    );
  }

  // ── Someone rated you ───────────────────────────────────────
  if (item.type === 'new_rating') {
    const r = item.rating;
    const t = item.target;
    const lvl = levelFor(r.overall);
    const ntrp = ntrpFor(r.sport, r.overall);
    const labels = new Map(skillsFor(t.kind, r.sport).map((a) => [a.key, a.label]));
    const top = Object.entries(r.skills).sort((a, b) => b[1] - a[1]).slice(0, 4);
    return wrap(
      <>
        <Badge icon="star" color="#f59e0b" />
        <Text style={[styles.kicker, { color: '#d97706' }]}>{item.updated ? 'UPDATED RATING' : 'NEW RATING'}{more > 0 ? ` · ${more} more` : ''}</Text>
        <Text style={styles.title}>
          <Text style={styles.name}>{r.raterName}</Text>
          {r.raterTeamId ? ' (team)' : ''}{item.updated ? ' updated their rating of ' : ' rated '}
          {t.kind === 'team' ? (t.name || 'your team') : 'your'} {r.sport}{t.kind === 'team' ? '' : ' game'}
        </Text>

        <View style={styles.scoreBox}>
          <Text style={[styles.scoreNum, { color: levelColor(r.overall) }]}>{r.overall}</Text>
          <Text style={styles.scoreOf}>/10</Text>
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={styles.scoreLevel}>{lvl.name}{ntrp ? ` · NTRP ≈ ${ntrp}` : ''}</Text>
            <Text style={styles.scoreDesc} numberOfLines={2}>{lvl.description}</Text>
          </View>
        </View>

        {top.length > 0 && (
          <View style={styles.skills}>
            {top.map(([k, v]) => (
              <View key={k} style={styles.skillRow}>
                <Text style={styles.skillName} numberOfLines={1}>{labels.get(k) ?? k}</Text>
                <View style={styles.barBg}>
                  <View style={[styles.barFill, { width: `${v * 10}%` as any, backgroundColor: levelColor(v) }]} />
                </View>
                <Text style={styles.skillNum}>{v}</Text>
              </View>
            ))}
          </View>
        )}

        {(r.sportsmanship || r.reliability || r.playedTogether) ? (
          <View style={styles.chips}>
            {!!r.sportsmanship && <Text style={styles.chip}>★ {r.sportsmanship} Sportsmanship</Text>}
            {!!r.reliability && <Text style={styles.chip}>★ {r.reliability} Reliability</Text>}
            {r.playedTogether && <Text style={[styles.chip, styles.chipGreen]}>✓ Played together</Text>}
          </View>
        ) : null}

        {!!r.review && <View style={styles.quote}><Text style={styles.quoteText}>“{r.review}”</Text></View>}
        {!!error && <Text style={styles.error}>{error}</Text>}

        <View style={styles.row2}>
          <Btn kind="ghost" half icon="chatbubble-outline" label="Say thanks"
            onPress={() => messageUser(r.raterUserId, r.raterName)} disabled={!!busy} loading={busy === 'message'} />
          <Btn kind="primary" half label="All my ratings" onPress={() => openRatings(t)} />
        </View>
        <TouchableOpacity style={styles.later} onPress={close}>
          <Text style={styles.laterText}>{closeLabel}</Text>
        </TouchableOpacity>
      </>,
      close,
    );
  }

  // ── Badge earned ────────────────────────────────────────────
  if (item.type === 'new_badge') {
    const t = item.target;
    const b = badgeInfo(item.badge);
    return wrap(
      <>
        <Badge icon={b?.icon === 'diamond' ? 'diamond' : 'medal'} color={b?.color ?? '#a16207'} />
        <Text style={[styles.kicker, { color: b?.color ?? '#a16207' }]}>BADGE EARNED{more > 0 ? ` · ${more} more` : ''}</Text>
        <Text style={styles.title}>
          {t.kind === 'team' ? `${t.name} earned` : 'You earned'} {b?.name ?? 'a new'} in {t.sport}! 🏅
        </Text>
        <View style={{ marginTop: 14 }}><BadgeChip tier={item.badge} sport={t.sport} size="lg" /></View>
        <Text style={styles.sub}>
          At least {BADGE_RULES.minRaters} players now rate {t.kind === 'team' ? 'the team' : 'you'} {b?.min ?? ''}+ ({levelFor(b?.min ?? 5).name}) or better. It shows on {t.kind === 'team' ? 'the team page' : 'your profile'} for everyone to see.
        </Text>
        <View style={[styles.row2, { marginTop: 0 }]}>
          <Btn kind="ghost" half label="See ratings" onPress={() => openRatings(t)} />
          <Btn kind="primary" half label={more > 0 ? 'Next' : 'Awesome!'} onPress={close} />
        </View>
      </>,
      close,
    );
  }

  const openEvent = (kind: EventKind, id: string) => {
    close();
    if (kind === 'event') router.push({ pathname: '/tournament', params: { id } });
    else router.push('/(tabs)/myturf');
  };

  // ── Ready for match day? (reminder until confirmed) ─────────
  if (item.type === 'event_ready') {
    const r = item.ready;
    const isToday = !!r.startsOn && r.startsOn === toISODate(new Date());
    const confirm = async () => {
      setBusy('accept');
      setError('');
      const res = await ackReady(r.kind, r.id);
      setBusy(null);
      if (!res.ok) { setError(res.error ?? 'Could not confirm. Please try again.'); return; }
      handledReady.current.add(item.key);
      setReadyDone(true);
    };
    const view = () => {
      handledReady.current.add(item.key);
      snoozeReady(r.kind, r.id).catch(() => {});
      next();
      if (r.kind === 'event') router.push({ pathname: '/tournament', params: { id: r.id } });
      else router.push('/(tabs)/myturf');
    };
    return wrap(readyDone ? (
      <>
        <Badge icon="checkmark" color="#16a34a" />
        <Text style={styles.title}>You’re in! 🙌</Text>
        <Text style={styles.sub}>Everyone can see you’ve confirmed. See you on match day{r.when && r.when !== 'TBD' ? ` — ${r.when}` : ''}.</Text>
        <Btn kind="primary" label={more > 0 ? 'Next' : 'Done'} onPress={next} />
      </>
    ) : (
      <>
        <Badge icon="megaphone" color="#7c3aed" />
        <Text style={[styles.kicker, { color: '#7c3aed' }]}>
          {isToday ? 'IT’S MATCH DAY' : 'THE LINE-UP IS SET'}{more > 0 ? ` · ${more} more` : ''}
        </Text>
        <Text style={styles.readyTitle}>READY FOR{'\n'}MATCH DAY?</Text>
        <Text style={styles.eventName} numberOfLines={2}>{SPORT_EMOJI[r.sport] ?? '🏆'} {r.name}</Text>
        <View style={styles.details}>
          <Row icon="calendar-outline" text={r.when && r.when !== 'TBD' ? r.when : 'Date to be agreed'} />
          <Row icon="location-outline" text={r.where || 'Place to be agreed'} />
          <Row icon="people-outline" text={`${r.lineup} signed up`} />
        </View>
        {r.organiserCanStart && (
          <Text style={styles.footnote}>You’re the organiser — you can start the draw from the event page.</Text>
        )}
        {!!error && <Text style={styles.error}>{error}</Text>}
        <View style={{ alignSelf: 'stretch', gap: 10, marginTop: 16 }}>
          <Btn kind="primary" icon="checkmark-circle" label="I’m ready!" onPress={confirm} disabled={!!busy} loading={busy === 'accept'} />
          <View style={[styles.row2, { marginTop: 0 }]}>
            <Btn kind="ghost" half label={r.kind === 'event' ? 'View event' : 'My Turf'} onPress={view} disabled={!!busy} />
            <Btn kind="ghost" half label="Remind me later" onPress={close} disabled={!!busy} />
          </View>
        </View>
        <Text style={styles.footnote}>We’ll keep reminding you until you confirm.</Text>
      </>
    ), close);
  }

  // ── Result recorded ─────────────────────────────────────────
  if (item.type === 'match_result') {
    return wrap(
      <>
        <Badge icon="create" color="#f59e0b" />
        <Text style={[styles.kicker, { color: '#d97706' }]}>RESULT RECORDED{more > 0 ? ` · ${more} more` : ''}</Text>
        <Text style={styles.title}>{item.title.replace(/^📝\s*/, '')}</Text>
        <Text style={styles.sub}>{item.body}</Text>
        <Text style={[styles.footnote, { marginTop: 0 }]}>Something wrong? Players in the match can correct it.</Text>
        <View style={styles.row2}>
          <Btn kind="ghost" half label={item.kind === 'event' ? 'View event' : 'My Turf'} onPress={() => openEvent(item.kind, item.id)} />
          <Btn kind="primary" half label={closeLabel} onPress={close} />
        </View>
      </>,
      close,
    );
  }

  // ── New event near you ──────────────────────────────────────
  if (item.type === 'nearby_event') {
    const ev = item.event;
    const kind = ev.type === 'league' ? 'league' : ev.type === 'match' ? 'paid match' : 'tournament';
    const spotsLeft = Math.max(0, ev.maxParticipants - ev.participants);
    return wrap(
      <>
        <Badge icon="trophy" color="#7c3aed" />
        <Text style={[styles.kicker, { color: '#7c3aed' }]}>NEW NEAR YOU{more > 0 ? ` · ${more} more` : ''}</Text>
        <Text style={styles.title}>
          {SPORT_EMOJI[ev.sport] ?? ev.sportEmoji ?? '🏆'} New {ev.sport} {kind}{item.distance ? `, ${item.distance}` : ''}
        </Text>
        <Text style={styles.eventName} numberOfLines={2}>{ev.name}</Text>
        <View style={styles.details}>
          <Row icon="calendar-outline" text={ev.date && ev.date !== 'TBD' ? ev.date : 'Date to be announced'} />
          <Row icon="location-outline" text={ev.location || 'Location to be announced'} />
          <Row icon="people-outline" text={`${ev.participants}/${ev.maxParticipants} signed up · ${spotsLeft} spot${spotsLeft === 1 ? '' : 's'} left`} />
        </View>
        <View style={styles.chips}>
          <Text style={[styles.chip, styles.chipGreen]}>{ev.entryFee > 0 ? `CAD ${ev.entryFee} entry` : 'Free entry'}</Text>
          {ev.prizePool > 0 && <Text style={styles.chip}>🏆 CAD {ev.prizePool} prize</Text>}
          {!!ev.format && <Text style={[styles.chip, styles.chipGrey]}>{ev.format}</Text>}
        </View>
        <View style={styles.row2}>
          <Btn kind="ghost" half label="Not interested" onPress={close} />
          <Btn kind="primary" half icon="arrow-forward" label="View & join"
            onPress={() => { close(); router.push({ pathname: '/tournament', params: { id: ev.id } }); }} />
        </View>
        <Text style={styles.footnote}>Alerts for your sports within your chosen distance · Privacy & Security</Text>
      </>,
      close,
    );
  }

  // ── Challenges ──────────────────────────────────────────────
  const c = item.c;
  const isTeam = c.kind === 'team';
  const emoji = SPORT_EMOJI[c.sport] ?? '🏆';
  const amChallenger = c.challengerUserId === userId;
  const other = {
    name: amChallenger ? c.opponentName : c.challengerName,
    sideId: amChallenger ? c.opponentId : c.challengerId,
    userId: amChallenger ? c.opponentUserId : c.challengerUserId,
  };
  const firstName = other.name.split(' ')[0];
  const messageLabel = isTeam ? 'Message captain' : `Message ${firstName}`;

  const details = (
    <View style={styles.details}>
      <Row icon="trophy-outline" text={`${emoji} ${c.sport}${isTeam ? ` · ${c.challengerName} vs ${c.opponentName}` : ''}`} />
      <Row icon="calendar-outline" text={c.date && c.date !== 'TBD' ? c.date : 'Date to be agreed'} />
      <Row icon="location-outline" text={c.location || 'Place to be agreed'} />
    </View>
  );

  // New challenge for me
  if (item.type === 'incoming') {
    const respond = async (accept: boolean) => {
      setBusy(accept ? 'accept' : 'decline');
      setError('');
      const res = await respondToChallenge(c.id, accept);
      setBusy(null);
      if (!res.ok) { setError(res.error ?? 'Something went wrong. Please try again.'); return; }
      markChallengeNotifsRead(userId, c.id).catch(() => {});
      setOutcome(accept ? 'accepted' : 'declined');
    };
    const later = async () => {
      setBusy('later');
      await markChallengeSeen(c.id).catch(() => {});
      close();
    };

    return wrap(outcome === null ? (
      <>
        <Badge icon="flash" color="#f97316" />
        <Text style={styles.kicker}>{isTeam ? 'TEAM CHALLENGE' : 'NEW CHALLENGE'}{more > 0 ? ` · ${more} more waiting` : ''}</Text>
        <Text style={styles.title}>
          <Text style={styles.name}>{c.challengerName}</Text>
          {isTeam ? ` challenged ${c.opponentName}` : ' challenged you'}
        </Text>
        {details}
        {!!c.message && <View style={styles.quote}><Text style={styles.quoteText}>“{c.message}”</Text></View>}
        {!!error && <Text style={styles.error}>{error}</Text>}
        {confirmDecline ? (
          <View style={{ alignSelf: 'stretch' }}>
            <Text style={styles.confirmText}>Decline this challenge? {c.challengerName} will be told.</Text>
            <View style={styles.row2}>
              <Btn kind="ghost" half label="Keep it" onPress={() => setConfirmDecline(false)} disabled={!!busy} />
              <Btn kind="danger" half label="Yes, decline" onPress={() => respond(false)} disabled={!!busy} loading={busy === 'decline'} />
            </View>
          </View>
        ) : (
          <>
            <View style={styles.row2}>
              <Btn kind="ghost" half label="Decline" onPress={() => setConfirmDecline(true)} disabled={!!busy} />
              <Btn kind="primary" half icon="checkmark" label="Accept" onPress={() => respond(true)} disabled={!!busy} loading={busy === 'accept'} />
            </View>
            <TouchableOpacity style={styles.later} onPress={later} disabled={!!busy}>
              {busy === 'later' ? <ActivityIndicator color="#6b7280" /> : <Text style={styles.laterText}>Decide later</Text>}
            </TouchableOpacity>
          </>
        )}
      </>
    ) : (
      <>
        <Badge icon={outcome === 'accepted' ? 'checkmark' : 'close'} color={outcome === 'accepted' ? '#16a34a' : '#9ca3af'} />
        <Text style={styles.title}>{outcome === 'accepted' ? 'Challenge on! 🔥' : 'Challenge declined'}</Text>
        <Text style={styles.sub}>
          {outcome === 'accepted'
            ? `We’ve told ${c.challengerName}. Sort out the details together, then record the result in Challenges.`
            : `We’ve let ${c.challengerName} know.`}
        </Text>
        {!!error && <Text style={styles.error}>{error}</Text>}
        {outcome === 'accepted' ? (
          <View style={{ alignSelf: 'stretch', gap: 10 }}>
            <Btn kind="primary" icon="chatbubble-outline" label={`Message ${c.challengerName.split(' ')[0]}`}
              onPress={() => messageUser(c.challengerUserId, c.challengerName)} disabled={!!busy} loading={busy === 'message'} />
            <View style={[styles.row2, { marginTop: 0 }]}>
              <Btn kind="ghost" half label="My challenges" onPress={() => { close(); router.push('/challenges'); }} />
              <Btn kind="ghost" half label={more > 0 ? 'Next' : 'Done'} onPress={next} />
            </View>
          </View>
        ) : (
          <Btn kind="ghost" label={closeLabel} onPress={next} />
        )}
      </>
    ), outcome ? next : later);
  }

  // Update on one of my challenges
  let badge: { icon: React.ComponentProps<typeof Ionicons>['name']; color: string };
  let kicker: string;
  let title: string;
  let sub: string;
  let actions: React.ReactNode;

  switch (c.status) {
    case 'accepted':
      badge = { icon: 'checkmark', color: '#16a34a' };
      kicker = 'CHALLENGE ACCEPTED';
      title = isTeam ? `${other.name} accepted ${c.challengerName}’s challenge! 🔥` : `${other.name} accepted your challenge! 🔥`;
      sub = 'Game on. Sort out the details together, then record the result in Challenges.';
      actions = (
        <View style={{ alignSelf: 'stretch', gap: 10, marginTop: 16 }}>
          <Btn kind="primary" icon="chatbubble-outline" label={messageLabel}
            onPress={() => messageUser(other.userId, other.name)} disabled={!!busy} loading={busy === 'message'} />
          <View style={[styles.row2, { marginTop: 0 }]}>
            <Btn kind="ghost" half label="My challenges" onPress={() => { close(); router.push('/challenges'); }} />
            <Btn kind="ghost" half label={closeLabel} onPress={close} />
          </View>
        </View>
      );
      break;
    case 'declined':
      badge = { icon: 'close', color: '#9ca3af' };
      kicker = 'CHALLENGE DECLINED';
      title = `${other.name} declined your challenge`;
      sub = 'No worries — there are plenty of players looking for a game. Try challenging someone else.';
      actions = (
        <View style={styles.row2}>
          <Btn kind="ghost" half label="Challenge someone" onPress={() => { close(); router.push('/challenges'); }} />
          <Btn kind="primary" half label={closeLabel} onPress={close} />
        </View>
      );
      break;
    case 'cancelled':
      badge = { icon: 'ban', color: '#ef4444' };
      kicker = 'CHALLENGE CALLED OFF';
      title = 'Challenge called off';
      sub = `${other.name} called off the ${c.sport} challenge.`;
      actions = (
        <View style={styles.row2}>
          <Btn kind="ghost" half icon="chatbubble-outline" label={isTeam ? 'Message captain' : `Ask ${firstName}`}
            onPress={() => messageUser(other.userId, other.name)} disabled={!!busy} loading={busy === 'message'} />
          <Btn kind="primary" half label={closeLabel} onPress={close} />
        </View>
      );
      break;
    default: { // completed
      const res = resultFor(c, userId);
      badge = { icon: 'trophy', color: res === 'won' ? '#f59e0b' : '#6b7280' };
      kicker = 'RESULT RECORDED';
      title = res === 'won' ? 'You won! 🏆' : res === 'draw' ? 'It’s a draw 🤝' : `${other.name} won this one`;
      sub = `${other.name} recorded the result${c.score ? ` (${c.score})` : ''}. Good game!`;
      const t: Target = isTeam
        ? { kind: 'team', id: other.sideId, name: other.name, sport: c.sport }
        : { kind: 'player', id: other.userId, name: other.name, sport: c.sport };
      actions = (
        <View style={styles.row2}>
          <Btn kind="ghost" half icon="star-outline" label={`Rate ${isTeam ? 'them' : firstName}`} onPress={() => openRatings(t, true)} />
          <Btn kind="primary" half label={closeLabel} onPress={close} />
        </View>
      );
    }
  }

  return wrap(
    <>
      <Badge icon={badge.icon} color={badge.color} />
      <Text style={[styles.kicker, { color: badge.color }]}>{kicker}{more > 0 ? ` · ${more} more` : ''}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={[styles.sub, { marginBottom: 0 }]}>{sub}</Text>
      {details}
      {!!error && <Text style={styles.error}>{error}</Text>}
      {actions}
    </>,
    close,
  );
}

function Badge({ icon, color }: { icon: React.ComponentProps<typeof Ionicons>['name']; color: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: color }]}>
      <Ionicons name={icon} size={28} color="#fff" />
    </View>
  );
}

function Btn({ kind, label, onPress, icon, half, disabled, loading }: {
  kind: 'primary' | 'ghost' | 'danger';
  label: string;
  onPress: () => void;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  half?: boolean;
  disabled?: boolean;
  loading?: boolean;
}) {
  const dark = kind !== 'ghost';
  return (
    <TouchableOpacity
      style={[styles.btn, half && { flex: 1 }, kind === 'primary' ? styles.btnPrimary : kind === 'danger' ? styles.btnDanger : styles.btnGhost]}
      onPress={onPress}
      disabled={disabled}
    >
      {loading ? <ActivityIndicator color={dark ? '#fff' : '#374151'} /> : (
        <>
          {icon && <Ionicons name={icon} size={17} color={dark ? '#fff' : '#374151'} />}
          <Text style={dark ? styles.btnText : styles.btnGhostText} numberOfLines={1}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

function Row({ icon, text }: { icon: React.ComponentProps<typeof Ionicons>['name']; text: string }) {
  return (
    <View style={styles.detailRow}>
      <Ionicons name={icon} size={16} color="#6b7280" />
      <Text style={styles.detailText} numberOfLines={2}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: {
    width: '100%', maxWidth: 400, backgroundColor: '#fff', borderRadius: 22,
    paddingHorizontal: 20, paddingTop: 44, paddingBottom: 16, alignItems: 'center',
  },
  badge: {
    position: 'absolute', top: -30, width: 60, height: 60, borderRadius: 30,
    alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: '#fff',
  },
  kicker: { fontSize: 11, fontWeight: '800', color: '#ea580c', letterSpacing: 0.8, marginBottom: 6, textAlign: 'center' },
  title: { fontSize: 20, fontWeight: '700', color: '#111827', textAlign: 'center', lineHeight: 26 },
  name: { fontWeight: '900' },
  sub: { fontSize: 14, color: '#6b7280', textAlign: 'center', lineHeight: 20, marginTop: 8, marginBottom: 16 },
  details: { alignSelf: 'stretch', backgroundColor: '#f9fafb', borderRadius: 14, padding: 12, gap: 8, marginTop: 14 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailText: { flex: 1, fontSize: 14, color: '#374151', fontWeight: '600' },
  quote: { alignSelf: 'stretch', backgroundColor: '#fff7ed', borderRadius: 12, padding: 12, marginTop: 10 },
  quoteText: { fontSize: 14, color: '#9a3412', fontStyle: 'italic', lineHeight: 20 },
  scoreBox: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch',
    backgroundColor: '#f9fafb', borderRadius: 14, padding: 12, marginTop: 14,
  },
  scoreNum: { fontSize: 40, fontWeight: '900' },
  scoreOf: { fontSize: 15, fontWeight: '700', color: '#9ca3af', alignSelf: 'flex-end', marginBottom: 8, marginLeft: 2 },
  scoreLevel: { fontSize: 15, fontWeight: '800', color: '#111827' },
  scoreDesc: { fontSize: 12, color: '#6b7280', marginTop: 2, lineHeight: 16 },
  skills: { alignSelf: 'stretch', gap: 7, marginTop: 12 },
  skillRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  skillName: { width: 110, fontSize: 12, fontWeight: '600', color: '#374151' },
  barBg: { flex: 1, height: 8, borderRadius: 4, backgroundColor: '#f3f4f6', overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4 },
  skillNum: { width: 22, fontSize: 12, fontWeight: '800', color: '#111827', textAlign: 'right' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: 12 },
  chip: {
    fontSize: 12, fontWeight: '600', color: '#92400e', backgroundColor: '#fef3c7',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, overflow: 'hidden',
  },
  chipGreen: { color: '#166534', backgroundColor: '#dcfce7' },
  chipGrey: { color: '#374151', backgroundColor: '#f3f4f6' },
  eventName: { fontSize: 16, fontWeight: '800', color: '#4c1d95', textAlign: 'center', marginTop: 6 },
  readyTitle: { fontSize: 28, fontWeight: '900', color: '#111827', textAlign: 'center', lineHeight: 32, letterSpacing: 0.5 },
  footnote: { fontSize: 11, color: '#9ca3af', textAlign: 'center', marginTop: 10 },
  error: { color: '#dc2626', fontSize: 13, fontWeight: '600', textAlign: 'center', marginTop: 10 },
  confirmText: { fontSize: 14, color: '#374151', textAlign: 'center', marginTop: 16 },
  row2: { flexDirection: 'row', gap: 10, alignSelf: 'stretch', marginTop: 16 },
  btn: {
    flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, paddingHorizontal: 10, borderRadius: 14, minHeight: 50,
  },
  btnPrimary: { backgroundColor: '#16a34a' },
  btnDanger: { backgroundColor: '#ef4444' },
  btnGhost: { backgroundColor: '#f3f4f6' },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  btnGhostText: { color: '#374151', fontSize: 15, fontWeight: '700' },
  later: { paddingVertical: 12, marginTop: 4, minHeight: 44, justifyContent: 'center' },
  laterText: { color: '#6b7280', fontSize: 14, fontWeight: '600' },
});
