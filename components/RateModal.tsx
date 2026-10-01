import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, TextInput, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../lib/AuthContext';
import { fetchCaptainTeams, type Team } from '../lib/teams';
import { fetchMyRating, submitRating } from '../lib/ratings';
import {
  RATING_LEVELS, CONDUCT_FIELDS, REVIEW_MAX, BADGE_RULES,
  groupedSkills, levelFor, levelColor, ntrpFor, suggestedOverall, badgeInfo,
  type RatingTargetKind, type BadgeTier,
} from '../lib/ratingRules';
import BadgeChip from './BadgeChip';

interface Props {
  visible: boolean;
  targetKind: RatingTargetKind;
  targetId: string;
  targetName: string;
  /** Sports that can be rated — a team passes just its own sport. */
  sports: string[];
  initialSport?: string;
  onClose: () => void;
  onSaved?: () => void;
}

const SCALE = RATING_LEVELS.map((l) => l.value);

export default function RateModal({
  visible, targetKind, targetId, targetName, sports, initialSport, onClose, onSaved,
}: Props) {
  const { user } = useAuth();
  const [sport, setSport]       = useState(initialSport ?? sports[0] ?? '');
  const [teams, setTeams]       = useState<Team[]>([]);
  const [asTeam, setAsTeam]     = useState<string | null>(null);
  const [overall, setOverall]   = useState<number | null>(null);
  const [skills, setSkills]     = useState<Record<string, number>>({});
  const [conduct, setConduct]   = useState<{ sportsmanship: number | null; reliability: number | null }>({ sportsmanship: null, reliability: null });
  const [review, setReview]     = useState('');
  const [isEdit, setIsEdit]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');
  const [done, setDone]         = useState<null | { badge: BadgeTier | null; badgeUp: boolean }>(null);

  // Reset when opened
  useEffect(() => {
    if (!visible) return;
    setSport(initialSport && sports.includes(initialSport) ? initialSport : sports[0] ?? '');
    setAsTeam(null);
    setDone(null);
    setError('');
  }, [visible]);

  // Teams I captain in this sport (I can rate on their behalf), never the team being rated
  useEffect(() => {
    if (!visible || !user || !sport) return;
    fetchCaptainTeams(user.id, sport).then((t) => {
      const list = t.filter((x) => x.id !== targetId);
      setTeams(list);
      if (asTeam && !list.some((x) => x.id === asTeam)) setAsTeam(null);
    });
  }, [visible, user?.id, sport]);

  // Pre-fill with an earlier rating from the same rater
  useEffect(() => {
    if (!visible || !user || !sport) return;
    let stale = false;
    setLoading(true);
    fetchMyRating(targetKind, targetId, sport, user.id, asTeam).then((r) => {
      if (stale) return;
      setIsEdit(!!r);
      setOverall(r?.overall ?? null);
      setSkills(r?.skills ?? {});
      setConduct({ sportsmanship: r?.sportsmanship ?? null, reliability: r?.reliability ?? null });
      setReview(r?.review ?? '');
      setLoading(false);
    });
    return () => { stale = true; };
  }, [visible, user?.id, sport, asTeam, targetId]);

  const groups = groupedSkills(targetKind, sport);
  const suggestion = suggestedOverall(skills);
  const level = overall ? levelFor(overall) : null;
  const ntrp = overall ? ntrpFor(sport, overall) : null;

  const setSkill = (key: string, v: number) =>
    setSkills((prev) => {
      const next = { ...prev };
      if (next[key] === v) delete next[key]; else next[key] = v;   // tap again to skip
      return next;
    });

  const save = async () => {
    if (!overall) { setError('Pick an overall level (1–10) first.'); return; }
    setError('');
    setSaving(true);
    const res = await submitRating({
      asTeamId: asTeam, targetKind, targetId, sport, overall, skills,
      sportsmanship: conduct.sportsmanship, reliability: conduct.reliability, review,
    });
    setSaving(false);
    if (!res.ok) { setError(res.error ?? 'Could not save. Please try again.'); return; }
    setDone({ badge: res.badge ?? null, badgeUp: !!res.badgeUp });
    onSaved?.();
  };

  const raterLabel = asTeam ? teams.find((t) => t.id === asTeam)?.name ?? 'your team' : 'you';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.sheet}>
          <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
            <View style={styles.header}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title} numberOfLines={1}>Rate {targetName}</Text>
                <Text style={styles.subtitle}>{isEdit ? 'Updating your earlier rating' : 'Be honest — ratings decide badges'}</Text>
              </View>
              <TouchableOpacity onPress={onClose} accessibilityLabel="Close">
                <Ionicons name="close" size={24} color="#111827" />
              </TouchableOpacity>
            </View>

            {done ? (
              <View style={styles.doneBox}>
                <Ionicons name="checkmark-circle" size={56} color="#16a34a" />
                <Text style={styles.doneTitle}>{isEdit ? 'Rating updated' : 'Rating saved'}</Text>
                <Text style={styles.doneBody}>Thanks — this helps everyone find the right level of game.</Text>
                {done.badgeUp && done.badge && (
                  <View style={styles.doneBadge}>
                    <BadgeChip tier={done.badge} sport={sport} size="lg" />
                    <Text style={styles.doneBody}>
                      {targetName} just earned the {badgeInfo(done.badge)?.name} badge!
                    </Text>
                  </View>
                )}
                <TouchableOpacity style={styles.saveBtn} onPress={onClose}>
                  <Text style={styles.saveText}>Done</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
                  {/* Sport */}
                  {sports.length > 1 && (
                    <>
                      <Text style={styles.label}>Sport</Text>
                      <View style={styles.pillRow}>
                        {sports.map((s) => (
                          <TouchableOpacity key={s} style={[styles.pill, sport === s && styles.pillOn]} onPress={() => setSport(s)}>
                            <Text style={[styles.pillText, sport === s && styles.pillTextOn]}>{s}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </>
                  )}

                  {/* Rate as */}
                  {teams.length > 0 && (
                    <>
                      <Text style={styles.label}>Rate as</Text>
                      <View style={styles.pillRow}>
                        <TouchableOpacity style={[styles.pill, !asTeam && styles.pillOn]} onPress={() => setAsTeam(null)}>
                          <Ionicons name="person" size={13} color={!asTeam ? '#fff' : '#374151'} />
                          <Text style={[styles.pillText, !asTeam && styles.pillTextOn]}>Myself</Text>
                        </TouchableOpacity>
                        {teams.map((t) => (
                          <TouchableOpacity key={t.id} style={[styles.pill, asTeam === t.id && styles.pillOn]} onPress={() => setAsTeam(t.id)}>
                            <Ionicons name="people" size={13} color={asTeam === t.id ? '#fff' : '#374151'} />
                            <Text style={[styles.pillText, asTeam === t.id && styles.pillTextOn]}>{t.name}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </>
                  )}

                  {loading ? (
                    <ActivityIndicator color="#16a34a" style={{ marginVertical: 30 }} />
                  ) : (
                    <>
                      {/* Overall */}
                      <Text style={styles.label}>Overall level <Text style={styles.req}>*</Text></Text>
                      <ScaleRow value={overall} onPick={(v) => setOverall(v === overall ? null : v)} big />
                      <View style={styles.levelBox}>
                        {level ? (
                          <>
                            <Text style={[styles.levelName, { color: levelColor(level.value) }]}>
                              {level.value} · {level.name}{ntrp ? `  (≈ NTRP ${ntrp})` : ''}
                            </Text>
                            <Text style={styles.levelDesc}>{level.description}</Text>
                          </>
                        ) : (
                          <Text style={styles.levelDesc}>
                            Compare them to everyone who plays {sport}, not just your group. 5 = solid social-club player, 7 = strong league player, 9 = provincial / semi-pro.
                          </Text>
                        )}
                        {suggestion !== null && suggestion !== overall && (
                          <TouchableOpacity onPress={() => setOverall(suggestion)}>
                            <Text style={styles.suggest}>Average of the skills you rated: {suggestion} — tap to use</Text>
                          </TouchableOpacity>
                        )}
                      </View>

                      {/* Skills */}
                      {groups.map(([group, attrs]) => (
                        <View key={group} style={styles.group}>
                          <Text style={styles.groupTitle}>{group}</Text>
                          {attrs.map((a) => (
                            <View key={a.key} style={styles.skillRow}>
                              <View style={styles.skillHead}>
                                <Text style={styles.skillLabel}>{a.label}</Text>
                                <Text style={[styles.skillValue, { color: skills[a.key] ? levelColor(skills[a.key]) : '#9ca3af' }]}>
                                  {skills[a.key] ? `${skills[a.key]} · ${levelFor(skills[a.key]).name}` : 'Not rated'}
                                </Text>
                              </View>
                              <Text style={styles.skillHint}>{a.hint}</Text>
                              <ScaleRow value={skills[a.key] ?? null} onPick={(v) => setSkill(a.key, v)} />
                            </View>
                          ))}
                        </View>
                      ))}
                      <Text style={styles.note}>Only rate skills you’ve actually seen. Tap a number again to clear it.</Text>

                      {/* Conduct */}
                      <View style={styles.group}>
                        <Text style={styles.groupTitle}>Conduct</Text>
                        {CONDUCT_FIELDS.map((f) => (
                          <View key={f.key} style={styles.conductRow}>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.skillLabel}>{f.label}</Text>
                              <Text style={styles.skillHint}>{f.hint}</Text>
                            </View>
                            <View style={styles.stars}>
                              {[1, 2, 3, 4, 5].map((n) => (
                                <TouchableOpacity
                                  key={n}
                                  onPress={() => setConduct((c) => ({ ...c, [f.key]: c[f.key] === n ? null : n }))}
                                  accessibilityLabel={`${f.label} ${n} of 5`}
                                  hitSlop={4}
                                >
                                  <Ionicons
                                    name={(conduct[f.key] ?? 0) >= n ? 'star' : 'star-outline'}
                                    size={24}
                                    color={(conduct[f.key] ?? 0) >= n ? '#f59e0b' : '#d1d5db'}
                                  />
                                </TouchableOpacity>
                              ))}
                            </View>
                          </View>
                        ))}
                      </View>

                      {/* Review */}
                      <Text style={styles.label}>Review <Text style={styles.optional}>(optional)</Text></Text>
                      <TextInput
                        style={styles.reviewInput}
                        value={review}
                        onChangeText={(t) => setReview(t.slice(0, REVIEW_MAX))}
                        placeholder={`What's ${targetName} like to play ${targetKind === 'team' ? 'against' : 'with or against'}?`}
                        placeholderTextColor="#9ca3af"
                        multiline
                        maxLength={REVIEW_MAX}
                      />
                      <Text style={styles.counter}>{review.length}/{REVIEW_MAX}</Text>

                      <View style={styles.infoBox}>
                        <Ionicons name="information-circle-outline" size={16} color="#6b7280" />
                        <Text style={styles.infoText}>
                          Your name{asTeam ? ' (as the team)' : ''} is shown with the rating. A badge needs at least {BADGE_RULES.minRaters} different people rating at that level, and they must be at least half of everyone who rated.
                        </Text>
                      </View>
                    </>
                  )}
                </ScrollView>

                <View style={styles.footer}>
                  {!!error && <Text style={styles.error}>{error}</Text>}
                  <TouchableOpacity
                    style={[styles.saveBtn, (!overall || saving) && styles.saveOff]}
                    onPress={save}
                    disabled={saving || loading}
                  >
                    {saving ? <ActivityIndicator color="#fff" /> : (
                      <Text style={styles.saveText}>
                        {isEdit ? 'Update Rating' : 'Submit Rating'}{asTeam ? ` as ${raterLabel}` : ''}
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

/** 1–10 row of tappable numbers. */
function ScaleRow({ value, onPick, big }: { value: number | null; onPick: (v: number) => void; big?: boolean }) {
  return (
    <View style={styles.scale}>
      {SCALE.map((n) => {
        const on = value !== null && n <= value;
        const exact = value === n;
        return (
          <TouchableOpacity
            key={n}
            style={[
              styles.scaleCell,
              big && styles.scaleCellBig,
              on && { backgroundColor: levelColor(value!), borderColor: levelColor(value!) },
              exact && styles.scaleExact,
            ]}
            onPress={() => onPick(n)}
            accessibilityLabel={`${n} — ${levelFor(n).name}`}
          >
            <Text style={[styles.scaleText, big && styles.scaleTextBig, on && { color: '#fff' }]}>{n}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { height: '92%', backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  title: { fontSize: 18, fontWeight: '800', color: '#111827' },
  subtitle: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  body: { padding: 16, paddingBottom: 24 },
  label: { fontSize: 14, fontWeight: '700', color: '#111827', marginTop: 14, marginBottom: 8 },
  req: { color: '#ef4444' },
  optional: { color: '#9ca3af', fontWeight: '500' },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16,
    borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#f9fafb',
  },
  pillOn: { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  pillText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  pillTextOn: { color: '#fff' },
  scale: { flexDirection: 'row', gap: 4 },
  scaleCell: {
    flex: 1, height: 30, borderRadius: 6, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#f9fafb',
  },
  scaleCellBig: { height: 40, borderRadius: 8 },
  scaleExact: { transform: [{ scale: 1.08 }] },
  scaleText: { fontSize: 12, fontWeight: '700', color: '#6b7280' },
  scaleTextBig: { fontSize: 15 },
  levelBox: { backgroundColor: '#f9fafb', borderRadius: 10, padding: 12, marginTop: 10, gap: 4 },
  levelName: { fontSize: 15, fontWeight: '800' },
  levelDesc: { fontSize: 13, color: '#4b5563', lineHeight: 18 },
  suggest: { fontSize: 12, color: '#16a34a', fontWeight: '700', marginTop: 4 },
  group: { marginTop: 18 },
  groupTitle: {
    fontSize: 12, fontWeight: '800', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6,
  },
  skillRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  skillHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  skillLabel: { fontSize: 14, fontWeight: '700', color: '#111827' },
  skillValue: { fontSize: 12, fontWeight: '700' },
  skillHint: { fontSize: 12, color: '#6b7280', marginTop: 1, marginBottom: 6 },
  note: { fontSize: 12, color: '#9ca3af', marginTop: 8 },
  conductRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  stars: { flexDirection: 'row', gap: 2 },
  reviewInput: {
    minHeight: 90, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 12,
    fontSize: 14, color: '#111827', textAlignVertical: 'top', backgroundColor: '#f9fafb',
  },
  counter: { fontSize: 11, color: '#9ca3af', textAlign: 'right', marginTop: 4 },
  infoBox: { flexDirection: 'row', gap: 8, backgroundColor: '#f3f4f6', borderRadius: 10, padding: 10, marginTop: 12 },
  infoText: { flex: 1, fontSize: 12, color: '#6b7280', lineHeight: 17 },
  footer: { padding: 16, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f3f4f6', gap: 8 },
  error: { color: '#dc2626', fontSize: 13, fontWeight: '600', textAlign: 'center' },
  saveBtn: { backgroundColor: '#16a34a', paddingVertical: 14, borderRadius: 12, alignItems: 'center', alignSelf: 'stretch' },
  saveOff: { backgroundColor: '#86efac' },
  saveText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  doneBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 },
  doneTitle: { fontSize: 20, fontWeight: '800', color: '#111827' },
  doneBody: { fontSize: 14, color: '#6b7280', textAlign: 'center' },
  doneBadge: { alignItems: 'center', gap: 8, marginVertical: 10 },
});
