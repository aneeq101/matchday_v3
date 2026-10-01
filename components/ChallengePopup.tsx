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
  markChallengeNotifsRead, fetchUnreadChallengeUpdates, subscribeToChallengeUpdates,
  type ChallengeUpdateNotif,
} from '../lib/notifications';
import { openConversation } from '../lib/chatService';
import { SPORT_EMOJI } from '../lib/sportProfile';

// Challenge popups over any screen while signed in:
//  • NEW challenge for you / your team → Accept / Decline / Decide later.
//    Shown once (challenges.opponent_seen_at).
//  • UPDATES on your challenges → accepted, declined, called off, result recorded.
//    Driven by unread 'challenge_update' notifications; closing marks them read.
// Both arrive live (Supabase Realtime) and are also picked up when the app
// starts or comes back to the foreground. One card at a time; several updates
// on the same challenge collapse into one card showing its latest state.

type Item =
  | { type: 'incoming'; c: Challenge }
  | { type: 'update'; c: Challenge };

type Outcome = null | 'accepted' | 'declined';
type Busy = null | 'accept' | 'decline' | 'later' | 'message';

export default function ChallengePopup({ userId }: { userId: string }) {
  const router = useRouter();
  const [queue, setQueue]       = useState<Item[]>([]);
  const [busy, setBusy]         = useState<Busy>(null);
  const [outcome, setOutcome]   = useState<Outcome>(null);
  const [confirmDecline, setConfirmDecline] = useState(false);
  const [error, setError]       = useState('');
  const handledIncoming = useRef(new Set<string>());
  const handledNotifs   = useRef(new Set<string>());

  const enqueue = useCallback((items: Item[]) => {
    setQueue((prev) => {
      let next = [...prev];
      for (const it of items) {
        const i = next.findIndex((x) => x.c.id === it.c.id);
        if (it.type === 'incoming') {
          if (i === -1 && !handledIncoming.current.has(it.c.id)) next.push(it);
        } else if (i === -1) {
          next.push(it);
        } else {
          next[i] = it;   // newer state of the same challenge (e.g. called off before you answered)
        }
      }
      return next.length === prev.length && next.every((x, k) => x === prev[k]) ? prev : next;
    });
  }, []);

  // A challenge_update notification → look up the challenge and queue a card
  const onUpdateNotif = useCallback(async (n: ChallengeUpdateNotif) => {
    if (handledNotifs.current.has(n.id)) return;
    handledNotifs.current.add(n.id);
    const c = await fetchChallenge(n.challengeId);
    if (!c || c.status === 'pending') return;
    // Demo opponents accept instantly — the Challenges screen already said so
    if (c.status === 'accepted' && c.challengerUserId === userId && await isDemoOpponent(c)) {
      markChallengeNotifsRead(userId, c.id).catch(() => {});
      return;
    }
    enqueue([{ type: 'update', c }]);
  }, [userId, enqueue]);

  // Missed while away: on start and whenever the app comes back to the foreground
  useEffect(() => {
    const check = () => {
      fetchUnseenIncoming(userId).then((list) => enqueue([...list].reverse().map((c) => ({ type: 'incoming' as const, c }))));
      fetchUnreadChallengeUpdates(userId).then((list) => list.forEach((n) => onUpdateNotif(n)));
    };
    check();
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') check(); });
    return () => sub.remove();
  }, [userId, enqueue, onUpdateNotif]);

  // Live
  useEffect(() => subscribeToIncomingChallenges(userId, (c) => enqueue([{ type: 'incoming', c }])), [userId, enqueue]);
  useEffect(() => subscribeToChallengeUpdates(userId, (n) => { onUpdateNotif(n); }), [userId, onUpdateNotif]);

  const item = queue[0];

  // The card on screen changed (e.g. called off while you were deciding)
  useEffect(() => { setConfirmDecline(false); setError(''); }, [item?.type, item?.c.id, item?.c.status]);

  const next = () => {
    if (item?.type === 'incoming') handledIncoming.current.add(item.c.id);
    setQueue((prev) => prev.slice(1));
    setOutcome(null);
    setConfirmDecline(false);
    setError('');
    setBusy(null);
  };

  const closeAndMarkRead = () => {
    if (item) markChallengeNotifsRead(userId, item.c.id).catch(() => {});
    next();
  };

  const respond = async (accept: boolean) => {
    if (!item) return;
    setBusy(accept ? 'accept' : 'decline');
    setError('');
    const res = await respondToChallenge(item.c.id, accept);
    setBusy(null);
    if (!res.ok) { setError(res.error ?? 'Something went wrong. Please try again.'); return; }
    markChallengeNotifsRead(userId, item.c.id).catch(() => {});
    setOutcome(accept ? 'accepted' : 'declined');
  };

  const later = async () => {
    if (!item) return;
    setBusy('later');
    await markChallengeSeen(item.c.id).catch(() => {});
    closeAndMarkRead();
  };

  const messageUser = async (otherUserId: string, name: string) => {
    setBusy('message');
    const res = await openConversation(otherUserId);
    setBusy(null);
    if (res.error !== undefined) { setError(res.error); return; }
    closeAndMarkRead();
    router.push({ pathname: '/chat', params: { id: res.id, name, initials: name.slice(0, 2).toUpperCase(), color: '#f97316' } });
  };

  const goTo = (path: '/challenges') => { closeAndMarkRead(); router.push(path); };

  if (!item) return null;

  const c = item.c;
  const isTeam = c.kind === 'team';
  const emoji = SPORT_EMOJI[c.sport] ?? '🏆';
  const more = queue.length - 1;
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

  const closeLabel = more > 0 ? 'Next' : 'Close';

  // ── New challenge for me ────────────────────────────────────
  if (item.type === 'incoming') {
    return (
      <Modal visible transparent animationType="fade" onRequestClose={outcome ? next : later}>
        <View style={styles.overlay}>
          <View style={styles.card} accessibilityViewIsModal>
            {outcome === null ? (
              <>
                <Badge icon="flash" color="#f97316" />
                <Text style={styles.kicker}>
                  {isTeam ? 'TEAM CHALLENGE' : 'NEW CHALLENGE'}{more > 0 ? ` · ${more} more waiting` : ''}
                </Text>
                <Text style={styles.title}>
                  <Text style={styles.name}>{c.challengerName}</Text>
                  {isTeam ? ` challenged ${c.opponentName}` : ' challenged you'}
                </Text>
                {details}
                {!!c.message && (
                  <View style={styles.quote}><Text style={styles.quoteText}>“{c.message}”</Text></View>
                )}
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
                      <Btn kind="ghost" half label="My challenges" onPress={() => goTo('/challenges')} />
                      <Btn kind="ghost" half label={more > 0 ? 'Next' : 'Done'} onPress={next} />
                    </View>
                  </View>
                ) : (
                  <Btn kind="ghost" label={closeLabel} onPress={next} />
                )}
              </>
            )}
          </View>
        </View>
      </Modal>
    );
  }

  // ── Update on one of my challenges ──────────────────────────
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
            <Btn kind="ghost" half label="My challenges" onPress={() => goTo('/challenges')} />
            <Btn kind="ghost" half label={closeLabel} onPress={closeAndMarkRead} />
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
          <Btn kind="ghost" half label="Challenge someone" onPress={() => goTo('/challenges')} />
          <Btn kind="primary" half label={closeLabel} onPress={closeAndMarkRead} />
        </View>
      );
      break;
    case 'cancelled':
      badge = { icon: 'ban', color: '#ef4444' };
      kicker = 'CHALLENGE CALLED OFF';
      title = 'Challenge called off';
      sub = `${other.name} called off the ${c.sport} challenge.`;
      actions = (
        <View style={{ alignSelf: 'stretch', gap: 10, marginTop: 16 }}>
          <View style={[styles.row2, { marginTop: 0 }]}>
            <Btn kind="ghost" half icon="chatbubble-outline" label={isTeam ? 'Message captain' : `Ask ${firstName}`}
              onPress={() => messageUser(other.userId, other.name)} disabled={!!busy} loading={busy === 'message'} />
            <Btn kind="primary" half label={closeLabel} onPress={closeAndMarkRead} />
          </View>
        </View>
      );
      break;
    default: { // completed
      const r = resultFor(c, userId);
      badge = { icon: 'trophy', color: r === 'won' ? '#f59e0b' : '#6b7280' };
      kicker = 'RESULT RECORDED';
      title = r === 'won' ? 'You won! 🏆' : r === 'draw' ? 'It’s a draw 🤝' : `${other.name} won this one`;
      sub = `${other.name} recorded the result${c.score ? ` (${c.score})` : ''}. Good game!`;
      const rateParams = isTeam
        ? { kind: 'team', id: other.sideId, name: other.name, rate: c.sport }
        : { kind: 'player', id: other.userId, name: other.name, rate: c.sport };
      actions = (
        <View style={styles.row2}>
          <Btn kind="ghost" half icon="star-outline" label={`Rate ${isTeam ? 'them' : firstName}`}
            onPress={() => { closeAndMarkRead(); router.push({ pathname: '/ratings', params: rateParams }); }} />
          <Btn kind="primary" half label={closeLabel} onPress={closeAndMarkRead} />
        </View>
      );
    }
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={closeAndMarkRead}>
      <View style={styles.overlay}>
        <View style={styles.card} accessibilityViewIsModal>
          <Badge icon={badge.icon} color={badge.color} />
          <Text style={[styles.kicker, { color: badge.color }]}>{kicker}{more > 0 ? ` · ${more} more` : ''}</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={[styles.sub, { marginBottom: 0 }]}>{sub}</Text>
          {details}
          {!!error && <Text style={styles.error}>{error}</Text>}
          {actions}
        </View>
      </View>
    </Modal>
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
