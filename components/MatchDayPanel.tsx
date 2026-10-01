import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Modal, TextInput,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../lib/AuthContext';
import {
  ackReady, fetchReadyAcks, recordFinalScore, canRecordFinal, matchDayReached,
  type EventKind, type ReadyAck, type Outcome,
} from '../lib/matchday';

interface Props {
  kind: EventKind;                 // 'event' (Play to Earn) or 'match' (Organize Match)
  id: string;
  /** Am I in it (signed up, on a signed-up team, or the organiser)? */
  isParticipant: boolean;
  startsOn?: string | null;
  readyAt?: string | null;
  /** Pickup games: players record one final score (brackets record per game instead). */
  finalScore?: {
    allowed: boolean;
    score?: string | null;
    note?: string | null;
    summary?: string | null;     // "Aneeq won", "Draw", …
    completed: boolean;
    /** Exactly two players (e.g. a singles match): "I won" / "They won" instead of sides */
    oneVsOne?: boolean;
  };
  /** e.g. "8 players" — shown in the ready banner */
  lineup?: string;
  color?: string;
  onChanged?: () => void;
}

/**
 * Match-day section shared by the event page and Organize Match details:
 *  • "Ready for match day" — who has confirmed, and an "I'm ready" button
 *  • final score of a pickup game, or "Record final score" once allowed
 */
export default function MatchDayPanel({
  kind, id, isParticipant, startsOn, readyAt, finalScore, lineup, color = '#16a34a', onChanged,
}: Props) {
  const { user } = useAuth();
  const [acks, setAcks]         = useState<ReadyAck[]>([]);
  const [acking, setAcking]     = useState(false);
  const [showScore, setShowScore] = useState(false);
  const [score, setScore]       = useState('');
  const [note, setNote]         = useState('');
  const [outcome, setOutcome]   = useState<Outcome | null>(null);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  const load = useCallback(() => {
    if (readyAt) fetchReadyAcks(kind, id).then(setAcks);
  }, [kind, id, readyAt]);
  useEffect(() => { load(); }, [load]);

  const iAcked = !!user && acks.some((a) => a.userId === user.id);
  const done = !!finalScore?.completed;

  const ack = async () => {
    setAcking(true);
    const res = await ackReady(kind, id);
    setAcking(false);
    if (res.ok) load();
  };

  const saveScore = async () => {
    if (!outcome) { setError('Choose who won.'); return; }
    if (!score.trim()) { setError('Enter the final score, e.g. 5–3 or 6-4 6-2.'); return; }
    setSaving(true);
    setError('');
    const res = await recordFinalScore(kind, id, score, note, outcome);
    setSaving(false);
    if (!res.ok) { setError(res.error ?? 'Could not save.'); return; }
    setShowScore(false);
    onChanged?.();
  };

  const canScore = !!finalScore?.allowed && isParticipant && canRecordFinal(startsOn, readyAt);
  const scoreLater = !!finalScore?.allowed && isParticipant && !done && !canScore;

  if (!readyAt && !done && !canScore && !scoreLater) return null;

  return (
    <View style={{ gap: 10, marginBottom: 14 }}>
      {/* Final score */}
      {done && (
        <View style={[styles.card, styles.resultCard]}>
          <Ionicons name="trophy" size={22} color="#f59e0b" />
          <View style={{ flex: 1 }}>
            <Text style={styles.resultLabel}>Final score</Text>
            <Text style={styles.resultScore}>{finalScore?.score}</Text>
            {!!finalScore?.summary && <Text style={styles.resultSummary}>{finalScore.summary}</Text>}
            {!!finalScore?.note && <Text style={styles.resultNote}>“{finalScore.note}”</Text>}
          </View>
          {isParticipant && (
            <TouchableOpacity onPress={() => { setScore(finalScore?.score ?? ''); setNote(finalScore?.note ?? ''); setOutcome(null); setError(''); setShowScore(true); }} hitSlop={8}>
              <Text style={[styles.link, { color }]}>Edit</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Ready for match day */}
      {!!readyAt && !done && (
        <View style={[styles.card, { borderColor: color + '55' }]}>
          <View style={styles.readyHead}>
            <Text style={{ fontSize: 22 }}>📣</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.readyTitle}>Ready for match day</Text>
              <Text style={styles.readySub}>
                {lineup ? `${lineup} in · ` : ''}{acks.length} confirmed{matchDayReached(startsOn) ? ' · it’s match day!' : ''}
              </Text>
            </View>
            {isParticipant && (iAcked ? (
              <View style={styles.ackedPill}>
                <Ionicons name="checkmark-circle" size={15} color="#16a34a" />
                <Text style={styles.ackedText}>You’re in</Text>
              </View>
            ) : (
              <TouchableOpacity style={[styles.ackBtn, { backgroundColor: color }]} onPress={ack} disabled={acking}>
                {acking ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.ackText}>I’m ready</Text>}
              </TouchableOpacity>
            ))}
          </View>
          {acks.length > 0 && (
            <View style={styles.names}>
              {acks.map((a) => (
                <View key={a.userId} style={styles.nameChip}>
                  <Ionicons name="checkmark" size={12} color="#16a34a" />
                  <Text style={styles.nameText}>{a.userId === user?.id ? 'You' : a.name}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Record the final score */}
      {canScore && !done && (
        <TouchableOpacity
          style={[styles.recordBtn, { backgroundColor: color }]}
          onPress={() => { setScore(''); setNote(''); setOutcome(null); setError(''); setShowScore(true); }}
        >
          <Ionicons name="create-outline" size={18} color="#fff" />
          <Text style={styles.recordText}>Record final score</Text>
        </TouchableOpacity>
      )}
      {scoreLater && (
        <Text style={styles.hint}>
          <Ionicons name="information-circle-outline" size={13} color="#6b7280" />
          {' '}You can record the final score {startsOn ? 'from match day' : 'once the line-up is full'}.
        </Text>
      )}

      <Modal visible={showScore} transparent animationType="fade" onRequestClose={() => setShowScore(false)}>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Final score</Text>
            <Text style={styles.modalSub}>Everyone in the match gets an alert with the result.</Text>
            <Text style={styles.q}>Who won?</Text>
            <View style={styles.outcomes}>
              {([
                ['won', finalScore?.oneVsOne ? 'I won' : 'My side won', 'trophy'],
                ['lost', finalScore?.oneVsOne ? 'They won' : 'Other side won', 'flag'],
                ['draw', 'Draw', 'git-compare'],
              ] as const).map(([o, label, icon]) => {
                const on = outcome === o;
                return (
                  <TouchableOpacity
                    key={o}
                    style={[styles.outcome, on && { backgroundColor: color, borderColor: color }]}
                    onPress={() => { setOutcome(o); setError(''); }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                  >
                    <Ionicons name={icon} size={18} color={on ? '#fff' : '#6b7280'} />
                    <Text style={[styles.outcomeText, on && { color: '#fff' }]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={styles.q}>Score</Text>
            <TextInput
              style={styles.input}
              value={score}
              onChangeText={(v) => setScore(v.slice(0, 60))}
              placeholder="e.g. Bibs 5 – 3 Skins, or 6-4 6-2"
              placeholderTextColor="#9ca3af"
              autoFocus
            />
            <TextInput
              style={[styles.input, { minHeight: 70, textAlignVertical: 'top' }]}
              value={note}
              onChangeText={(v) => setNote(v.slice(0, 200))}
              placeholder="Anything to add? (optional) — man of the match, highlights…"
              placeholderTextColor="#9ca3af"
              multiline
            />
            {!!error && <Text style={styles.error}>{error}</Text>}
            <View style={styles.row}>
              <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={() => setShowScore(false)} disabled={saving}>
                <Text style={styles.btnGhostText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, { backgroundColor: color }]} onPress={saveScore} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Save score</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#e5e7eb', padding: 14 },
  resultCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderColor: '#fde68a', backgroundColor: '#fffbeb' },
  resultLabel: { fontSize: 12, fontWeight: '700', color: '#92400e', textTransform: 'uppercase', letterSpacing: 0.5 },
  resultScore: { fontSize: 20, fontWeight: '900', color: '#111827', marginTop: 2 },
  resultNote: { fontSize: 13, color: '#6b7280', fontStyle: 'italic', marginTop: 4 },
  resultSummary: { fontSize: 14, fontWeight: '700', color: '#92400e', marginTop: 2 },
  q: { fontSize: 14, fontWeight: '700', color: '#111827', marginTop: 4 },
  outcomes: { flexDirection: 'row', gap: 8 },
  outcome: {
    flex: 1, alignItems: 'center', gap: 4, paddingVertical: 12, borderRadius: 12,
    borderWidth: 1.5, borderColor: '#e5e7eb', backgroundColor: '#f9fafb',
  },
  outcomeText: { fontSize: 12, fontWeight: '700', color: '#374151', textAlign: 'center' },
  link: { fontWeight: '700', fontSize: 14 },
  readyHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  readyTitle: { fontSize: 15, fontWeight: '800', color: '#111827' },
  readySub: { fontSize: 12, color: '#6b7280', marginTop: 1 },
  ackBtn: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12, minWidth: 92, alignItems: 'center' },
  ackText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  ackedPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#dcfce7', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  ackedText: { color: '#166534', fontWeight: '700', fontSize: 12 },
  names: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  nameChip: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#f0fdf4', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  nameText: { fontSize: 12, color: '#166534', fontWeight: '600' },
  recordBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12 },
  recordText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  hint: { fontSize: 12, color: '#6b7280', textAlign: 'center' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modal: { width: '100%', maxWidth: 400, backgroundColor: '#fff', borderRadius: 20, padding: 20, gap: 10 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
  modalSub: { fontSize: 13, color: '#6b7280', marginTop: -6 },
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 12, fontSize: 15, color: '#111827', backgroundColor: '#f9fafb' },
  error: { color: '#dc2626', fontSize: 13, fontWeight: '600' },
  row: { flexDirection: 'row', gap: 10, marginTop: 4 },
  btn: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center' },
  btnGhost: { backgroundColor: '#f3f4f6' },
  btnText: { color: '#fff', fontWeight: '800' },
  btnGhostText: { color: '#374151', fontWeight: '700' },
});
