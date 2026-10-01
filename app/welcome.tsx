import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../lib/AuthContext';
import { addSport, removeSport } from '../lib/profile';
import { markWelcomeSeen } from '../lib/onboarding';
import { PROFILE_SPORTS, SPORT_EMOJI, type SkillLevel } from '../lib/sportProfile';
import SportDetailsEditor from '../components/SportDetailsEditor';

// First-run welcome: 1) pick your sports  2) optional details per sport  3) done.
// Every step can be skipped; sports are saved as soon as they're picked, so
// leaving half-way never loses anything. Opened automatically once (see
// lib/onboarding.ts) and from the Profile tab's "Set up my sports".

type Step = { kind: 'pick' } | { kind: 'sport'; index: number } | { kind: 'done' };
interface SportAnswers { skill: SkillLevel; details: Record<string, string> }

export default function WelcomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const firstName = String(user?.user_metadata?.full_name || user?.user_metadata?.name || '').split(' ')[0];

  const [step, setStep]         = useState<Step>({ kind: 'pick' });
  const [picked, setPicked]     = useState<string[]>([]);
  const [answers, setAnswers]   = useState<Record<string, SportAnswers>>({});
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');
  const [savedIds, setSavedIds] = useState<Record<string, string>>({});   // sports saved during this flow

  // Seen once = never shown automatically again, however the user leaves
  useEffect(() => { markWelcomeSeen().catch(() => {}); }, []);

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  };

  const save = async (sport: string) => {
    if (!user) return false;
    const a = answers[sport] ?? { skill: 'Intermediate', details: {} };
    const res = await addSport({ userId: user.id, sport, skill: a.skill, emoji: SPORT_EMOJI[sport] ?? '🏆', details: a.details });
    return !!res;
  };

  const togglePick = (s: string) =>
    setPicked((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  // Step 1 → save the picked sports straight away (sensible default level)
  const continueFromPick = async () => {
    if (!picked.length) return;
    setSaving(true);
    setError('');
    const init: Record<string, SportAnswers> = {};
    picked.forEach((s) => { init[s] = answers[s] ?? { skill: 'Intermediate', details: {} }; });
    setAnswers(init);
    // Went back and un-picked something saved a moment ago → take it off again
    await Promise.all(Object.entries(savedIds)
      .filter(([sport, id]) => !picked.includes(sport) && !id.startsWith('pending-'))
      .map(([, id]) => removeSport(id)));
    const results = await Promise.all(picked.map((s) =>
      user ? addSport({ userId: user.id, sport: s, skill: init[s].skill, emoji: SPORT_EMOJI[s] ?? '🏆', details: init[s].details }) : null));
    const ids: Record<string, string> = {};
    results.forEach((r) => { if (r) ids[r.name] = r.id; });
    setSavedIds(ids);
    setSaving(false);
    if (results.some((r) => !r)) {
      setError('Couldn’t save everything — check your connection. You can carry on and add sports later from your Profile.');
    }
    setStep({ kind: 'sport', index: 0 });
  };

  const nextFromSport = async (index: number, keep: boolean) => {
    if (keep) {
      setSaving(true);
      const ok = await save(picked[index]);
      setSaving(false);
      setError(ok ? '' : 'Couldn’t save that — you can update it later from your Profile.');
    }
    setStep(index + 1 < picked.length ? { kind: 'sport', index: index + 1 } : { kind: 'done' });
  };

  const totalSteps = picked.length + 2;
  const stepNo = step.kind === 'pick' ? 1 : step.kind === 'sport' ? step.index + 2 : totalSteps;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        {/* Top bar: back · progress · skip */}
        <View style={styles.topBar}>
          {step.kind === 'sport' ? (
            <TouchableOpacity
              onPress={() => setStep(step.index === 0 ? { kind: 'pick' } : { kind: 'sport', index: step.index - 1 })}
              accessibilityLabel="Back"
              hitSlop={10}
            >
              <Ionicons name="chevron-back" size={24} color="#374151" />
            </TouchableOpacity>
          ) : <View style={{ width: 24 }} />}
          <View style={styles.progressBg}>
            <View style={[styles.progressFill, { width: `${(stepNo / Math.max(totalSteps, 3)) * 100}%` as any }]} />
          </View>
          {step.kind !== 'done' ? (
            <TouchableOpacity onPress={close} hitSlop={10} accessibilityLabel="Skip setup">
              <Text style={styles.skipTop}>Skip</Text>
            </TouchableOpacity>
          ) : <View style={{ width: 32 }} />}
        </View>

        {step.kind === 'pick' && (
          <>
            <ScrollView contentContainerStyle={styles.body}>
              <Text style={styles.wave}>👋</Text>
              <Text style={styles.title}>Welcome to MatchDay{firstName ? `, ${firstName}` : ''}!</Text>
              <Text style={styles.subtitle}>Which sports do you play? Pick as many as you like — you can change this any time.</Text>
              <View style={styles.grid}>
                {PROFILE_SPORTS.map((s) => {
                  const on = picked.includes(s);
                  return (
                    <TouchableOpacity
                      key={s}
                      style={[styles.tile, on && styles.tileOn]}
                      onPress={() => togglePick(s)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: on }}
                      accessibilityLabel={s}
                    >
                      {on && (
                        <View style={styles.tick}><Ionicons name="checkmark" size={14} color="#fff" /></View>
                      )}
                      <Text style={styles.tileEmoji}>{SPORT_EMOJI[s]}</Text>
                      <Text style={[styles.tileName, on && { color: '#166534' }]}>{s}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
            <View style={styles.footer}>
              <TouchableOpacity
                style={[styles.primary, !picked.length && styles.primaryOff]}
                onPress={continueFromPick}
                disabled={!picked.length || saving}
              >
                {saving ? <ActivityIndicator color="#fff" /> : (
                  <Text style={styles.primaryText}>
                    {picked.length ? `Continue with ${picked.length} sport${picked.length === 1 ? '' : 's'}` : 'Pick at least one sport'}
                  </Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity onPress={close} style={styles.secondary}>
                <Text style={styles.secondaryText}>Skip for now — I’ll explore first</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {step.kind === 'sport' && (() => {
          const sport = picked[step.index];
          const a = answers[sport] ?? { skill: 'Intermediate' as SkillLevel, details: {} };
          const last = step.index === picked.length - 1;
          return (
            <>
              <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
                <Text style={styles.sportCount}>
                  {picked.length > 1 ? `Sport ${step.index + 1} of ${picked.length}` : 'Almost done'}
                </Text>
                <Text style={styles.title}>{SPORT_EMOJI[sport]} {sport}</Text>
                <Text style={styles.subtitle}>
                  Tell other players a bit about your game. All optional — answer what you like.
                </Text>
                {!!error && <Text style={styles.error}>{error}</Text>}
                <SportDetailsEditor
                  sport={sport}
                  skill={a.skill}
                  details={a.details}
                  onChange={(skill, details) => setAnswers((prev) => ({ ...prev, [sport]: { skill, details } }))}
                />
              </ScrollView>
              <View style={styles.footer}>
                <TouchableOpacity style={styles.primary} onPress={() => nextFromSport(step.index, true)} disabled={saving}>
                  {saving ? <ActivityIndicator color="#fff" /> : (
                    <Text style={styles.primaryText}>{last ? 'Save & finish' : 'Save & next'}</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => nextFromSport(step.index, false)} style={styles.secondary} disabled={saving}>
                  <Text style={styles.secondaryText}>Skip details for {sport}</Text>
                </TouchableOpacity>
              </View>
            </>
          );
        })()}

        {step.kind === 'done' && (
          <>
            <ScrollView contentContainerStyle={[styles.body, { alignItems: 'center' }]}>
              <Text style={styles.wave}>🎉</Text>
              <Text style={[styles.title, { textAlign: 'center' }]}>You’re all set!</Text>
              <View style={styles.pickedRow}>
                {picked.map((s) => (
                  <View key={s} style={styles.pickedChip}>
                    <Text>{SPORT_EMOJI[s]}</Text>
                    <Text style={styles.pickedText}>{s}</Text>
                  </View>
                ))}
              </View>
              {!!error && <Text style={styles.error}>{error}</Text>}
              <View style={styles.tips}>
                <Tip icon="people" title="Find players near you" body="The Hood shows players around you who play the same sports." />
                <Tip icon="trophy" title="Join tournaments & leagues" body="We’ll let you know when events for your sports pop up nearby." />
                <Tip icon="star" title="Rate players after you play" body="Ratings from other players earn you Bronze to Diamond badges." />
              </View>
              <Text style={styles.later}>You can edit your sports any time from your Profile.</Text>
            </ScrollView>
            <View style={styles.footer}>
              <TouchableOpacity style={styles.primary} onPress={close}>
                <Text style={styles.primaryText}>Let’s play</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </SafeAreaView>
    </View>
  );
}

function Tip({ icon, title, body }: { icon: React.ComponentProps<typeof Ionicons>['name']; title: string; body: string }) {
  return (
    <View style={styles.tip}>
      <View style={styles.tipIcon}><Ionicons name={icon} size={20} color="#16a34a" /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.tipTitle}>{title}</Text>
        <Text style={styles.tipBody}>{body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  topBar: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 16, paddingVertical: 10,
    width: '100%', maxWidth: 560, alignSelf: 'center',
  },
  progressBg: { flex: 1, height: 6, borderRadius: 3, backgroundColor: '#f3f4f6', overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: '#16a34a' },
  skipTop: { fontSize: 15, fontWeight: '600', color: '#6b7280' },
  body: { padding: 20, paddingBottom: 24, width: '100%', maxWidth: 560, alignSelf: 'center' },
  wave: { fontSize: 44, marginBottom: 6 },
  title: { fontSize: 26, fontWeight: '800', color: '#111827' },
  subtitle: { fontSize: 15, color: '#6b7280', lineHeight: 21, marginTop: 6, marginBottom: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: {
    width: '47%', flexGrow: 1, alignItems: 'center', paddingVertical: 20, borderRadius: 18,
    borderWidth: 2, borderColor: '#e5e7eb', backgroundColor: '#f9fafb',
  },
  tileOn: { borderColor: '#16a34a', backgroundColor: '#f0fdf4' },
  tick: {
    position: 'absolute', top: 10, right: 10, width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#16a34a', alignItems: 'center', justifyContent: 'center',
  },
  tileEmoji: { fontSize: 36 },
  tileName: { fontSize: 15, fontWeight: '700', color: '#374151', marginTop: 6 },
  sportCount: { fontSize: 13, fontWeight: '700', color: '#16a34a', marginBottom: 4 },
  footer: {
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 8, gap: 4,
    borderTopWidth: 1, borderTopColor: '#f3f4f6',
    width: '100%', maxWidth: 560, alignSelf: 'center',
  },
  primary: { backgroundColor: '#16a34a', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  primaryOff: { backgroundColor: '#86efac' },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  secondary: { alignItems: 'center', paddingVertical: 12 },
  secondaryText: { color: '#6b7280', fontSize: 14, fontWeight: '600' },
  error: {
    color: '#b45309', backgroundColor: '#fffbeb', borderRadius: 10, padding: 10,
    fontSize: 13, marginBottom: 14, alignSelf: 'stretch',
  },
  pickedRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 14, marginBottom: 20 },
  pickedChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#f0fdf4', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6,
  },
  pickedText: { fontSize: 13, fontWeight: '700', color: '#166534' },
  tips: { alignSelf: 'stretch', gap: 12 },
  tip: {
    flexDirection: 'row', gap: 12, alignItems: 'center',
    backgroundColor: '#f9fafb', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#f3f4f6',
  },
  tipIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#dcfce7', alignItems: 'center', justifyContent: 'center' },
  tipTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  tipBody: { fontSize: 13, color: '#6b7280', marginTop: 2, lineHeight: 18 },
  later: { fontSize: 13, color: '#9ca3af', marginTop: 18, textAlign: 'center' },
});
