import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, TextInput, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../lib/AuthContext';
import { fetchPlayers } from '../lib/players';
import {
  fetchSuggestions, requestRatings, MAX_PER_REQUEST, type RatingSuggestion,
} from '../lib/ratingRequests';
import { BADGE_RULES, type RatingTargetKind } from '../lib/ratingRules';
import { SPORT_EMOJI } from '../lib/sportProfile';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Props {
  visible: boolean;
  kind: RatingTargetKind;
  subjectId: string;
  subjectName: string;
  /** Sports you can ask about (your sports, or the team's sport) */
  sports: string[];
  initialSport?: string;
  onClose: () => void;
}

const REASON_LABEL: Record<RatingSuggestion['reason'], string> = {
  played: 'Played together',
  teammate: 'Teammate',
  follows: 'Connected',
  search: '',
};

/** Pick people you've played with and ask them to rate your game (or your team). */
export default function AskRatingsModal({ visible, kind, subjectId, subjectName, sports, initialSport, onClose }: Props) {
  const { user } = useAuth();
  const [sport, setSport]           = useState(initialSport ?? sports[0] ?? '');
  const [suggestions, setSuggestions] = useState<RatingSuggestion[]>([]);
  const [everyone, setEveryone]     = useState<RatingSuggestion[] | null>(null);
  const [selected, setSelected]     = useState<string[]>([]);
  const [search, setSearch]         = useState('');
  const [note, setNote]             = useState('');
  const [loading, setLoading]       = useState(false);
  const [sending, setSending]       = useState(false);
  const [error, setError]           = useState('');
  const [result, setResult]         = useState<null | { sent: number; skipped: number }>(null);

  useEffect(() => {
    if (!visible) return;
    setSport(initialSport && sports.includes(initialSport) ? initialSport : sports[0] ?? '');
    setSelected([]); setSearch(''); setNote(''); setError(''); setResult(null);
  }, [visible]);

  useEffect(() => {
    if (!visible || !sport) return;
    let stale = false;
    setLoading(true);
    fetchSuggestions(kind, subjectId, sport).then((s) => {
      if (stale) return;
      setSuggestions(s);
      setSelected([]);
      setLoading(false);
    });
    return () => { stale = true; };
  }, [visible, sport, kind, subjectId]);

  // Anyone else: loaded only when the user starts searching
  useEffect(() => {
    if (!visible || search.trim().length < 2 || everyone) return;
    fetchPlayers().then((all) => setEveryone(
      all
        .filter((p) => UUID_RE.test(p.id) && p.id !== user?.id)
        .map((p) => ({
          id: p.id, name: p.name, initials: p.initials, avatarColor: p.avatarColor,
          reason: 'search' as const, alreadyRated: false, requested: false,
        })),
    ));
  }, [visible, search, everyone, user?.id]);

  const q = search.trim().toLowerCase();
  const list = useMemo(() => {
    if (q.length < 2) return suggestions;
    const known = new Map(suggestions.map((s) => [s.id, s]));
    const fromAll = (everyone ?? []).filter((p) => !known.has(p.id));
    return [...suggestions, ...fromAll].filter((p) => p.name.toLowerCase().includes(q));
  }, [q, suggestions, everyone]);

  const toggle = (p: RatingSuggestion) => {
    if (p.requested) return;
    setError('');
    setSelected((prev) => {
      if (prev.includes(p.id)) return prev.filter((x) => x !== p.id);
      if (prev.length >= MAX_PER_REQUEST) { setError(`You can ask up to ${MAX_PER_REQUEST} people at a time.`); return prev; }
      return [...prev, p.id];
    });
  };

  const send = async () => {
    if (!selected.length) return;
    setSending(true);
    setError('');
    const res = await requestRatings({ kind, subjectId, sport, raterIds: selected, note });
    setSending(false);
    if (!res.ok) { setError(res.error ?? 'Could not send. Please try again.'); return; }
    setResult({ sent: res.sent ?? 0, skipped: res.skipped ?? 0 });
  };

  const subject = kind === 'team' ? subjectName : 'your';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.sheet}>
          <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
            <View style={styles.header}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>Ask for ratings</Text>
                <Text style={styles.subtitle}>Get people who’ve played {kind === 'team' ? 'you' : 'with you'} to vouch for {subject === 'your' ? 'your game' : subject}</Text>
              </View>
              <TouchableOpacity onPress={onClose} accessibilityLabel="Close">
                <Ionicons name="close" size={24} color="#111827" />
              </TouchableOpacity>
            </View>

            {result ? (
              <View style={styles.done}>
                <Ionicons name={result.sent ? 'paper-plane' : 'information-circle'} size={48} color={result.sent ? '#16a34a' : '#9ca3af'} />
                <Text style={styles.doneTitle}>
                  {result.sent ? `Asked ${result.sent} ${result.sent === 1 ? 'person' : 'people'}` : 'Nobody new to ask'}
                </Text>
                <Text style={styles.doneBody}>
                  {result.sent
                    ? `They’ll get a notification. You’ll hear from us when they rate ${kind === 'team' ? subjectName : 'you'}.`
                    : 'Everyone you picked was already asked recently.'}
                  {result.skipped ? ` ${result.skipped} skipped (already asked in the last 30 days, or can’t be asked).` : ''}
                </Text>
                <TouchableOpacity style={styles.primary} onPress={onClose}>
                  <Text style={styles.primaryText}>Done</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
                  <View style={styles.info}>
                    <Ionicons name="shield-checkmark-outline" size={18} color="#16a34a" />
                    <Text style={styles.infoText}>
                      Honest ratings from real opponents and teammates build trust and earn badges. A badge needs at least {BADGE_RULES.minRaters} people rating you at that level.
                    </Text>
                  </View>

                  {sports.length > 1 && (
                    <View style={styles.pills}>
                      {sports.map((s) => (
                        <TouchableOpacity key={s} style={[styles.pill, sport === s && styles.pillOn]} onPress={() => setSport(s)}>
                          <Text style={[styles.pillText, sport === s && styles.pillTextOn]}>{SPORT_EMOJI[s] ?? '🏆'} {s}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  <View style={styles.searchBox}>
                    <Ionicons name="search" size={17} color="#9ca3af" />
                    <TextInput
                      style={styles.searchInput}
                      value={search}
                      onChangeText={setSearch}
                      placeholder="Search for someone else"
                      placeholderTextColor="#9ca3af"
                    />
                  </View>

                  {loading ? (
                    <ActivityIndicator color="#16a34a" style={{ marginVertical: 24 }} />
                  ) : list.length === 0 ? (
                    <Text style={styles.empty}>
                      {q.length >= 2
                        ? 'No players found.'
                        : 'No one to suggest yet — play a challenge or join a team, or search for someone above.'}
                    </Text>
                  ) : (
                    <View style={styles.list}>
                      {list.map((p) => {
                        const on = selected.includes(p.id);
                        return (
                          <TouchableOpacity
                            key={p.id}
                            style={[styles.row, p.requested && { opacity: 0.5 }]}
                            onPress={() => toggle(p)}
                            disabled={p.requested}
                            accessibilityRole="checkbox"
                            accessibilityState={{ checked: on, disabled: p.requested }}
                          >
                            <View style={[styles.avatar, { backgroundColor: p.avatarColor }]}>
                              <Text style={styles.avatarText}>{p.initials || p.name.slice(0, 2).toUpperCase()}</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.name}>{p.name}</Text>
                              <Text style={styles.meta}>
                                {[
                                  REASON_LABEL[p.reason],
                                  p.requested ? 'Already asked' : p.alreadyRated ? 'Rated you before — can update' : '',
                                ].filter(Boolean).join(' · ')}
                              </Text>
                            </View>
                            <Ionicons
                              name={on ? 'checkbox' : 'square-outline'}
                              size={24}
                              color={on ? '#16a34a' : '#d1d5db'}
                            />
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}

                  <Text style={styles.label}>Add a note <Text style={styles.optional}>(optional)</Text></Text>
                  <TextInput
                    style={styles.note}
                    value={note}
                    onChangeText={(t) => setNote(t.slice(0, 200))}
                    placeholder="e.g. Great match on Saturday — would love your rating!"
                    placeholderTextColor="#9ca3af"
                    multiline
                    maxLength={200}
                  />
                </ScrollView>

                <View style={styles.footer}>
                  {!!error && <Text style={styles.error}>{error}</Text>}
                  <TouchableOpacity
                    style={[styles.primary, (!selected.length || sending) && styles.primaryOff]}
                    onPress={send}
                    disabled={!selected.length || sending}
                  >
                    {sending ? <ActivityIndicator color="#fff" /> : (
                      <Text style={styles.primaryText}>
                        {selected.length ? `Ask ${selected.length} ${selected.length === 1 ? 'person' : 'people'}` : 'Pick who to ask'}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </SafeAreaView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { height: '90%', backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  title: { fontSize: 18, fontWeight: '800', color: '#111827' },
  subtitle: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  body: { padding: 16, paddingBottom: 24 },
  info: { flexDirection: 'row', gap: 8, backgroundColor: '#f0fdf4', borderRadius: 12, padding: 12, marginBottom: 14 },
  infoText: { flex: 1, fontSize: 12, color: '#166534', lineHeight: 17 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  pill: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#f9fafb' },
  pillOn: { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  pillText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  pillTextOn: { color: '#fff' },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#f3f4f6', borderRadius: 10, paddingHorizontal: 12, marginBottom: 8,
  },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 15, color: '#111827' },
  empty: { color: '#9ca3af', fontSize: 13, textAlign: 'center', marginVertical: 20, lineHeight: 19 },
  list: { marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '700' },
  name: { fontSize: 15, fontWeight: '600', color: '#111827' },
  meta: { fontSize: 12, color: '#6b7280', marginTop: 1 },
  label: { fontSize: 14, fontWeight: '700', color: '#111827', marginTop: 16, marginBottom: 8 },
  optional: { color: '#9ca3af', fontWeight: '500' },
  note: {
    minHeight: 70, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 12,
    fontSize: 14, color: '#111827', textAlignVertical: 'top', backgroundColor: '#f9fafb',
  },
  footer: { padding: 16, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f3f4f6', gap: 8 },
  error: { color: '#dc2626', fontSize: 13, fontWeight: '600', textAlign: 'center' },
  primary: { backgroundColor: '#16a34a', paddingVertical: 14, borderRadius: 12, alignItems: 'center', alignSelf: 'stretch' },
  primaryOff: { backgroundColor: '#86efac' },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  done: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 },
  doneTitle: { fontSize: 20, fontWeight: '800', color: '#111827' },
  doneBody: { fontSize: 14, color: '#6b7280', textAlign: 'center', lineHeight: 20, marginBottom: 10 },
});
