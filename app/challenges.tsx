import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, ActivityIndicator,
  Platform, Modal, TextInput, RefreshControl, KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useAuth } from '../lib/AuthContext';
import {
  fetchMyChallenges, respondToChallenge, cancelChallenge, recordChallengeResult,
  mySide, resultFor, type Challenge, type ChallengeKind,
} from '../lib/challenges';
import ChallengeModal, { type ChallengeTarget } from '../components/ChallengeModal';

const ORANGE = '#f97316';
const SPORT_EMOJI: Record<string, string> = {
  Football: '⚽', Cricket: '🏏', Tennis: '🎾', Basketball: '🏀', Badminton: '🏸', Baseball: '⚾',
};

export default function ChallengesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  // Opened from a profile / team page with an opponent pre-filled
  const params = useLocalSearchParams<{ kind?: string; opponentId?: string; opponentName?: string; sport?: string }>();

  const [items, setItems]           = useState<Challenge[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab]               = useState<'active' | 'history'>('active');
  const [busyId, setBusyId]         = useState<string | null>(null);
  const [notice, setNotice]         = useState<{ text: string; error?: boolean } | null>(null);
  const [showNew, setShowNew]       = useState(false);
  const [target, setTarget]         = useState<ChallengeTarget | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<Challenge | null>(null);

  const [resultFor_, setResultFor] = useState<Challenge | null>(null);
  const [pick, setPick]             = useState<string | 'draw' | null>(null);
  const [score, setScore]           = useState('');
  const [resultError, setResultError] = useState('');
  const [saving, setSaving]         = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setItems(await fetchMyChallenges(user.id));
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    if (params.opponentId && params.opponentName) {
      setTarget({
        kind: (params.kind as ChallengeKind) === 'team' ? 'team' : 'player',
        id: params.opponentId,
        name: params.opponentName,
        sport: params.sport || undefined,
      });
      setShowNew(true);
      router.setParams({ opponentId: undefined, opponentName: undefined, kind: undefined, sport: undefined });
    }
  }, [params.opponentId, params.opponentName, params.kind, params.sport, router]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const me = user?.id ?? '';
  const all = items ?? [];
  const incoming = all.filter((c) => c.status === 'pending' && c.opponentUserId === me);
  const upcoming = all.filter((c) => c.status === 'accepted');
  const waiting  = all.filter((c) => c.status === 'pending' && c.challengerUserId === me);
  const history  = all.filter((c) => ['completed', 'declined', 'cancelled'].includes(c.status));
  const record = all.reduce(
    (acc, c) => {
      const r = resultFor(c, me);
      if (r === 'won') acc.w++; else if (r === 'lost') acc.l++; else if (r === 'draw') acc.d++;
      return acc;
    },
    { w: 0, l: 0, d: 0 },
  );

  const respond = async (c: Challenge, accept: boolean) => {
    setBusyId(c.id);
    const res = await respondToChallenge(c.id, accept);
    setBusyId(null);
    if (!res.ok) { setNotice({ text: res.error ?? 'Please try again.', error: true }); return; }
    setNotice({ text: accept ? 'Challenge accepted — game on! Record the result after you play.' : 'Challenge declined.' });
    load();
  };

  const doCancel = async () => {
    const c = confirmCancel;
    if (!c) return;
    setBusyId(c.id);
    const res = await cancelChallenge(c.id);
    setBusyId(null);
    setConfirmCancel(null);
    if (!res.ok) { setNotice({ text: res.error ?? 'Please try again.', error: true }); return; }
    setNotice({ text: 'Challenge cancelled.' });
    load();
  };

  const openResult = (c: Challenge) => {
    setResultFor(c);
    setPick(null);
    setScore('');
    setResultError('');
  };

  const saveResult = async () => {
    const c = resultFor_;
    if (!c || saving) return;
    if (!pick) { setResultError('Choose who won, or Draw.'); return; }
    setSaving(true);
    const res = await recordChallengeResult(c.id, pick === 'draw' ? null : pick, pick === 'draw', score);
    setSaving(false);
    if (!res.ok) { setResultError(res.error ?? 'Could not save.'); return; }
    setResultFor(null);
    const r = pick === 'draw' ? 'It’s a draw!' : pick === mySide(c, me).id ? 'Nice win! 🏆' : 'Result saved. Better luck next time!';
    setNotice({ text: r });
    setTab('history');
    load();
  };

  const newChallenge = () => { setTarget(null); setShowNew(true); };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={ORANGE} />
      <SafeAreaView style={styles.header} edges={['top']}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Challenges</Text>
        <TouchableOpacity style={styles.headerBtn} onPress={newChallenge}>
          <Ionicons name="add" size={18} color={ORANGE} />
          <Text style={styles.headerBtnText}>New</Text>
        </TouchableOpacity>
      </SafeAreaView>

      {items === null ? (
        <View style={styles.center}><ActivityIndicator size="large" color={ORANGE} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.body}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ORANGE} />}
        >
          {/* Record */}
          <View style={styles.recordCard}>
            <Text style={styles.recordTitle}>Your challenge record</Text>
            <View style={styles.recordRow}>
              <Stat value={record.w} label="Won" color="#16a34a" />
              <Stat value={record.d} label="Drawn" color="#6b7280" />
              <Stat value={record.l} label="Lost" color="#ef4444" />
            </View>
          </View>

          {!!notice && (
            <View style={[styles.notice, notice.error && styles.noticeError]}>
              <Ionicons name={notice.error ? 'alert-circle' : 'checkmark-circle'} size={18} color={notice.error ? '#dc2626' : '#16a34a'} />
              <Text style={[styles.noticeText, notice.error && { color: '#b91c1c' }]}>{notice.text}</Text>
              <TouchableOpacity onPress={() => setNotice(null)}><Ionicons name="close" size={16} color="#9ca3af" /></TouchableOpacity>
            </View>
          )}

          <View style={styles.tabs}>
            <TouchableOpacity style={[styles.tab, tab === 'active' && styles.tabActive]} onPress={() => setTab('active')}>
              <Text style={[styles.tabText, tab === 'active' && styles.tabTextActive]}>
                Active{incoming.length ? ` · ${incoming.length} new` : ''}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.tab, tab === 'history' && styles.tabActive]} onPress={() => setTab('history')}>
              <Text style={[styles.tabText, tab === 'history' && styles.tabTextActive]}>History</Text>
            </TouchableOpacity>
          </View>

          {tab === 'active' ? (
            incoming.length + upcoming.length + waiting.length === 0 ? (
              <View style={styles.empty}>
                <Text style={{ fontSize: 44 }}>⚔️</Text>
                <Text style={styles.emptyTitle}>No active challenges</Text>
                <Text style={styles.emptySub}>
                  Challenge a player — or, as a team captain, another team — to a competitive match.
                </Text>
                <TouchableOpacity style={styles.bigBtn} onPress={newChallenge}>
                  <Ionicons name="flash" size={18} color="#fff" />
                  <Text style={styles.bigBtnText}>Send a Challenge</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <Section title="Needs your answer" items={incoming} render={(c) => (
                  <ChallengeCard key={c.id} c={c} me={me}>
                    <View style={styles.actions}>
                      <TouchableOpacity style={styles.declineBtn} onPress={() => respond(c, false)} disabled={busyId === c.id}>
                        <Text style={styles.declineText}>Decline</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.acceptBtn} onPress={() => respond(c, true)} disabled={busyId === c.id}>
                        {busyId === c.id ? <ActivityIndicator color="#fff" /> : <Text style={styles.acceptText}>Accept</Text>}
                      </TouchableOpacity>
                    </View>
                  </ChallengeCard>
                )} />
                <Section title="Game on" items={upcoming} render={(c) => (
                  <ChallengeCard key={c.id} c={c} me={me}>
                    <View style={styles.actions}>
                      <TouchableOpacity style={styles.declineBtn} onPress={() => setConfirmCancel(c)}>
                        <Text style={styles.declineText}>Call off</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.acceptBtn} onPress={() => openResult(c)}>
                        <Text style={styles.acceptText}>Record Result</Text>
                      </TouchableOpacity>
                    </View>
                  </ChallengeCard>
                )} />
                <Section title="Waiting for reply" items={waiting} render={(c) => (
                  <ChallengeCard key={c.id} c={c} me={me}>
                    <View style={styles.actions}>
                      <Text style={styles.waitingText}>Sent — waiting for {c.opponentName}</Text>
                      <TouchableOpacity onPress={() => setConfirmCancel(c)}>
                        <Text style={styles.linkDanger}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  </ChallengeCard>
                )} />
              </>
            )
          ) : history.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="time-outline" size={40} color="#d1d5db" />
              <Text style={styles.emptySub}>Finished challenges will show here.</Text>
            </View>
          ) : (
            history.map((c) => <ChallengeCard key={c.id} c={c} me={me} />)
          )}
        </ScrollView>
      )}

      <ChallengeModal
        visible={showNew}
        target={target}
        onClose={() => setShowNew(false)}
        onSent={(msg) => { setShowNew(false); setNotice({ text: msg }); setTab('active'); load(); }}
      />

      {/* Record result */}
      <Modal visible={!!resultFor_} animationType="slide" transparent onRequestClose={() => setResultFor(null)}>
        <KeyboardAvoidingView style={styles.sheetOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <SafeAreaView style={styles.sheet} edges={['bottom']}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>How did it go?</Text>
              <TouchableOpacity onPress={() => setResultFor(null)}><Ionicons name="close" size={24} color="#111827" /></TouchableOpacity>
            </View>
            {resultFor_ && (
              <View style={{ padding: 16 }}>
                {[
                  { id: resultFor_.challengerId, name: resultFor_.challengerName },
                  { id: resultFor_.opponentId, name: resultFor_.opponentName },
                ].map((s) => (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.option, pick === s.id && { borderColor: '#16a34a', backgroundColor: '#f0fdf4' }]}
                    onPress={() => setPick(s.id)}
                  >
                    <Ionicons name={pick === s.id ? 'radio-button-on' : 'radio-button-off'} size={20} color={pick === s.id ? '#16a34a' : '#9ca3af'} />
                    <Text style={styles.optionText}>{s.name} won</Text>
                    {pick === s.id && <Ionicons name="trophy" size={16} color="#f59e0b" />}
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={[styles.option, pick === 'draw' && { borderColor: '#3b82f6', backgroundColor: '#eff6ff' }]}
                  onPress={() => setPick('draw')}
                >
                  <Ionicons name={pick === 'draw' ? 'radio-button-on' : 'radio-button-off'} size={20} color={pick === 'draw' ? '#3b82f6' : '#9ca3af'} />
                  <Text style={styles.optionText}>It was a draw</Text>
                </TouchableOpacity>
                <Text style={styles.label}>Score (optional)</Text>
                <TextInput
                  style={styles.input}
                  value={score}
                  onChangeText={setScore}
                  placeholder="e.g. 6-4 6-3 or 3-1"
                  placeholderTextColor="#9ca3af"
                  maxLength={40}
                />
                <Text style={styles.hint}>Both sides will see the result.</Text>
                {!!resultError && <Text style={styles.error}>{resultError}</Text>}
                <TouchableOpacity style={[styles.bigBtn, { backgroundColor: '#16a34a' }]} onPress={saveResult} disabled={saving}>
                  {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.bigBtnText}>Save Result</Text>}
                </TouchableOpacity>
              </View>
            )}
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Confirm cancel */}
      <Modal visible={!!confirmCancel} animationType="fade" transparent onRequestClose={() => setConfirmCancel(null)}>
        <View style={styles.centerOverlay}>
          <View style={styles.alertBox}>
            <Text style={styles.alertTitle}>Cancel this challenge?</Text>
            <Text style={styles.alertBody}>
              {confirmCancel ? `${confirmCancel.challengerName} vs ${confirmCancel.opponentName} will be called off. They'll be notified.` : ''}
            </Text>
            <View style={{ flexDirection: 'row', gap: 10, width: '100%' }}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setConfirmCancel(null)}>
                <Text style={styles.cancelText}>Keep it</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={doCancel} disabled={!!busyId}>
                {busyId ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmText}>Call off</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Section({ title, items, render }: { title: string; items: Challenge[]; render: (c: Challenge) => React.ReactNode }) {
  if (items.length === 0) return null;
  return (
    <>
      <Text style={styles.sectionTitle}>{title}</Text>
      {items.map(render)}
    </>
  );
}

function Stat({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const STATUS_LABEL: Record<string, { text: string; color: string; bg: string }> = {
  pending:   { text: 'Pending',   color: '#b45309', bg: '#fef3c7' },
  accepted:  { text: 'Accepted',  color: '#1d4ed8', bg: '#dbeafe' },
  declined:  { text: 'Declined',  color: '#6b7280', bg: '#f3f4f6' },
  cancelled: { text: 'Called off', color: '#6b7280', bg: '#f3f4f6' },
  completed: { text: 'Played',    color: '#15803d', bg: '#dcfce7' },
};

function ChallengeCard({ c, me, children }: { c: Challenge; me: string; children?: React.ReactNode }) {
  const side = mySide(c, me);
  const r = resultFor(c, me);
  const st = STATUS_LABEL[c.status] ?? STATUS_LABEL.pending;
  const fromMe = c.challengerUserId === me;
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <Text style={{ fontSize: 26 }}>{SPORT_EMOJI[c.sport] ?? '🏆'}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardSub}>
            {c.sport} · {c.kind === 'team' ? 'Team challenge' : '1-on-1'} · {fromMe ? 'you challenged' : 'challenged you'}
          </Text>
          <Text style={styles.vs} numberOfLines={2}>
            <Text style={styles.vsMine}>{side.name}</Text>
            <Text style={styles.vsText}>  vs  </Text>
            {side.otherName}
          </Text>
        </View>
        {r ? (
          <View style={[styles.statusPill, { backgroundColor: r === 'won' ? '#dcfce7' : r === 'lost' ? '#fee2e2' : '#f3f4f6' }]}>
            <Text style={[styles.statusText, { color: r === 'won' ? '#15803d' : r === 'lost' ? '#b91c1c' : '#374151' }]}>
              {r === 'won' ? 'Won' : r === 'lost' ? 'Lost' : 'Draw'}
            </Text>
          </View>
        ) : (
          <View style={[styles.statusPill, { backgroundColor: st.bg }]}>
            <Text style={[styles.statusText, { color: st.color }]}>{st.text}</Text>
          </View>
        )}
      </View>
      <View style={styles.metaRow}>
        <Ionicons name="calendar-outline" size={13} color="#6b7280" />
        <Text style={styles.metaText}>{c.date}</Text>
        {!!c.location && (
          <>
            <Ionicons name="location-outline" size={13} color="#6b7280" style={{ marginLeft: 8 }} />
            <Text style={styles.metaText} numberOfLines={1}>{c.location}</Text>
          </>
        )}
      </View>
      {!!c.score && <Text style={styles.score}>Score: {c.score}</Text>}
      {!!c.message && <Text style={styles.message}>“{c.message}”</Text>}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f3f4f6' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    backgroundColor: ORANGE, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingTop: Platform.OS === 'android' ? 8 : 4, paddingBottom: 12, gap: 10,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, color: '#fff', fontSize: 18, fontWeight: '700' },
  headerBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  headerBtnText: { color: ORANGE, fontWeight: '700' },
  body: { padding: 16, paddingBottom: 40 },
  recordCard: { backgroundColor: '#fff', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 12 },
  recordTitle: { fontSize: 13, fontWeight: '700', color: '#6b7280', marginBottom: 8 },
  recordRow: { flexDirection: 'row' },
  statValue: { fontSize: 24, fontWeight: '800' },
  statLabel: { fontSize: 12, color: '#6b7280' },
  notice: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#f0fdf4', borderRadius: 10,
    padding: 10, marginBottom: 12, borderWidth: 1, borderColor: '#bbf7d0',
  },
  noticeError: { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
  noticeText: { flex: 1, color: '#15803d', fontSize: 13, fontWeight: '600' },
  tabs: { flexDirection: 'row', backgroundColor: '#e5e7eb', borderRadius: 10, padding: 3, marginBottom: 12 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  tabActive: { backgroundColor: ORANGE },
  tabText: { color: '#4b5563', fontWeight: '700', fontSize: 13 },
  tabTextActive: { color: '#fff' },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 8, marginTop: 4 },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 30, paddingHorizontal: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  emptySub: { fontSize: 13, color: '#6b7280', textAlign: 'center', lineHeight: 19, marginBottom: 6 },
  bigBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, alignSelf: 'stretch',
    backgroundColor: ORANGE, paddingVertical: 14, borderRadius: 12,
  },
  bigBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardSub: { fontSize: 11, color: '#6b7280', fontWeight: '600' },
  vs: { fontSize: 15, color: '#111827', fontWeight: '600', marginTop: 2 },
  vsMine: { fontWeight: '800' },
  vsText: { color: ORANGE, fontWeight: '800' },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10 },
  metaText: { fontSize: 12, color: '#6b7280', flexShrink: 1 },
  score: { fontSize: 13, color: '#111827', fontWeight: '700', marginTop: 6 },
  message: { fontSize: 13, color: '#4b5563', fontStyle: 'italic', marginTop: 6 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  declineBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#e5e7eb' },
  declineText: { color: '#6b7280', fontWeight: '700' },
  acceptBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', backgroundColor: ORANGE },
  acceptText: { color: '#fff', fontWeight: '700' },
  waitingText: { flex: 1, color: '#6b7280', fontSize: 12 },
  linkDanger: { color: '#ef4444', fontWeight: '700' },
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%' },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderColor: '#e5e7eb',
    borderRadius: 12, padding: 14, marginBottom: 8,
  },
  optionText: { flex: 1, fontSize: 15, fontWeight: '600', color: '#111827' },
  label: { fontWeight: '700', color: '#111827', fontSize: 14, marginBottom: 8, marginTop: 6 },
  input: {
    backgroundColor: '#f9fafb', borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb',
    paddingHorizontal: 12, paddingVertical: 11, fontSize: 15, color: '#111827', marginBottom: 6,
  },
  hint: { color: '#6b7280', fontSize: 12, marginBottom: 10 },
  error: { color: '#dc2626', fontSize: 13, marginBottom: 10 },
  centerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  alertBox: { backgroundColor: '#fff', borderRadius: 20, padding: 24, width: '85%', maxWidth: 360, alignItems: 'center' },
  alertTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 6 },
  alertBody: { fontSize: 14, color: '#6b7280', textAlign: 'center', marginBottom: 18, lineHeight: 20 },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#e5e7eb' },
  cancelText: { color: '#6b7280', fontWeight: '600' },
  confirmBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', backgroundColor: '#ef4444' },
  confirmText: { color: '#fff', fontWeight: '700' },
});
