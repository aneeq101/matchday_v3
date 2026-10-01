import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, Platform, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useAuth } from '../lib/AuthContext';
import { fetchMatchHistory, rivalsFrom, type HistoryItem, type Rival, type HistoryOutcome } from '../lib/history';
import { SPORT_EMOJI } from '../lib/sportProfile';

// Every recorded game for a player — challenges, tournament / league games,
// pickup games — with a head-to-head record against each opponent and a
// Rematch button to settle the score.
// /match-history?userId=<uuid>&name=<display name>[&sport=<sport>]

const OUTCOME: Record<HistoryOutcome, { label: string; short: string; color: string; bg: string }> = {
  won:    { label: 'Won',    short: 'W', color: '#fff', bg: '#16a34a' },
  lost:   { label: 'Lost',   short: 'L', color: '#fff', bg: '#ef4444' },
  draw:   { label: 'Draw',   short: 'D', color: '#fff', bg: '#f59e0b' },
  played: { label: 'Played', short: '•', color: '#374151', bg: '#e5e7eb' },
};

const SOURCE_LABEL: Record<HistoryItem['source'], string> = {
  challenge: 'Challenge',
  event_game: 'Tournament',
  event_match: 'Pickup match',
  pickup: 'Pickup game',
};

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function monthOf(iso: string | null): string {
  if (!iso) return 'Undated';
  return new Date(iso).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function standing(r: Rival, isMe: boolean, name: string): string {
  const who = isMe ? 'You' : name.split(' ')[0];
  if (r.wins > r.losses) return `${who} lead${isMe ? '' : 's'} ${r.wins}–${r.losses}`;
  if (r.losses > r.wins) return `${who} trail${isMe ? '' : 's'} ${r.wins}–${r.losses}`;
  return `All square ${r.wins}–${r.losses}`;
}

export default function MatchHistoryScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ userId?: string; name?: string; sport?: string }>();
  const userId = params.userId ?? user?.id ?? '';
  const name = params.name ?? 'Player';
  const isMe = !!user && user.id === userId;

  const [items, setItems]       = useState<HistoryItem[]>([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sport, setSport]       = useState<string>(params.sport ?? 'All');

  const load = useCallback(async () => {
    if (!userId) return;
    setItems(await fetchMatchHistory(userId));
    setLoading(false);
  }, [userId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const sports = useMemo(() => [...new Set(items.map((i) => i.sport))], [items]);
  const shown = sport === 'All' ? items : items.filter((i) => i.sport === sport);
  const rivals = useMemo(() => rivalsFrom(shown).slice(0, 6), [shown]);
  const record = useMemo(() => ({
    played: shown.length,
    won: shown.filter((i) => i.outcome === 'won').length,
    lost: shown.filter((i) => i.outcome === 'lost').length,
    draw: shown.filter((i) => i.outcome === 'draw').length,
  }), [shown]);

  const grouped = useMemo(() => {
    const out: [string, HistoryItem[]][] = [];
    for (const i of shown) {
      const m = monthOf(i.playedAt);
      const g = out.find(([k]) => k === m);
      if (g) g[1].push(i); else out.push([m, [i]]);
    }
    return out;
  }, [shown]);

  const rematch = (kind: 'player' | 'team', id: string, oppName: string, s: string) =>
    router.push({ pathname: '/challenges', params: { kind, opponentId: id, opponentName: oppName, sport: s } });

  const openItem = (i: HistoryItem) => {
    if (i.eventId) router.push({ pathname: '/tournament', params: { id: i.eventId } });
    else if (isMe && i.source === 'challenge') router.push('/challenges');
    else if (isMe && i.source === 'pickup') router.push('/(tabs)/myturf');
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#16a34a" />
      <SafeAreaView style={styles.header} edges={['top']}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} accessibilityLabel="Back">
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{isMe ? 'My Match History' : `${name} · Matches`}</Text>
      </SafeAreaView>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#16a34a" /></View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.body}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor="#16a34a" />}
        >
          {items.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="time-outline" size={44} color="#d1d5db" />
              <Text style={styles.emptyTitle}>No recorded games yet</Text>
              <Text style={styles.emptyText}>
                {isMe
                  ? 'Challenge a player, join a tournament or a pickup game — once the score is recorded it shows up here and counts towards your stats.'
                  : `${name} hasn’t played any recorded games yet.`}
              </Text>
              {isMe && (
                <TouchableOpacity style={styles.primary} onPress={() => router.push('/challenges')}>
                  <Ionicons name="flash" size={16} color="#fff" />
                  <Text style={styles.primaryText}>Challenge someone</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <>
              {/* Sport filter */}
              {sports.length > 1 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                  {['All', ...sports].map((s) => (
                    <TouchableOpacity key={s} style={[styles.chip, sport === s && styles.chipOn]} onPress={() => setSport(s)}>
                      <Text style={[styles.chipText, sport === s && styles.chipTextOn]}>
                        {s === 'All' ? 'All sports' : `${SPORT_EMOJI[s] ?? '🏆'} ${s}`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              {/* Record */}
              <View style={styles.recordCard}>
                {([['won', record.won], ['lost', record.lost], ['draw', record.draw]] as const).map(([o, n]) => (
                  <View key={o} style={styles.recordCell}>
                    <Text style={[styles.recordNum, { color: OUTCOME[o].bg }]}>{n}</Text>
                    <Text style={styles.recordLbl}>{OUTCOME[o].label}</Text>
                  </View>
                ))}
                <View style={styles.recordCell}>
                  <Text style={styles.recordNum}>{record.played}</Text>
                  <Text style={styles.recordLbl}>Played</Text>
                </View>
              </View>
              <Text style={styles.verifiedNote}>
                <Ionicons name="shield-checkmark" size={12} color="#16a34a" /> Verified from recorded results — included in {isMe ? 'your' : 'their'} profile stats.
              </Text>

              {/* Head-to-head */}
              {rivals.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>Head-to-head</Text>
                  <View style={styles.card}>
                    {rivals.map((r, idx) => (
                      <View key={r.key} style={[styles.rivalRow, idx > 0 && styles.divider]}>
                        <View style={[styles.avatar, { backgroundColor: r.kind === 'team' ? '#8b5cf6' : '#0ea5e9' }]}>
                          {r.kind === 'team'
                            ? <Ionicons name="people" size={16} color="#fff" />
                            : <Text style={styles.avatarText}>{r.name.slice(0, 2).toUpperCase()}</Text>}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.rivalName} numberOfLines={1}>{r.name}</Text>
                          <Text style={styles.rivalMeta}>
                            {SPORT_EMOJI[r.sport] ?? '🏆'} {r.played} game{r.played === 1 ? '' : 's'} · {standing(r, isMe, name)}
                            {r.draws ? ` (${r.draws} draw${r.draws === 1 ? '' : 's'})` : ''}
                          </Text>
                        </View>
                        {isMe && (
                          <TouchableOpacity style={styles.rematchBtn} onPress={() => rematch(r.kind, r.id, r.name, r.sport)}>
                            <Ionicons name="flash" size={14} color="#fff" />
                            <Text style={styles.rematchText}>{r.losses > r.wins ? 'Settle it' : 'Rematch'}</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    ))}
                  </View>
                </>
              )}

              {!isMe && (
                <TouchableOpacity style={[styles.primary, { alignSelf: 'stretch', marginTop: 14 }]}
                  onPress={() => rematch('player', userId, name, sport === 'All' ? '' : sport)}>
                  <Ionicons name="flash" size={16} color="#fff" />
                  <Text style={styles.primaryText}>Challenge {name.split(' ')[0]}</Text>
                </TouchableOpacity>
              )}

              {/* Games */}
              {grouped.map(([month, list]) => (
                <View key={month}>
                  <Text style={styles.sectionTitle}>{month}</Text>
                  <View style={styles.card}>
                    {list.map((i, idx) => {
                      const o = OUTCOME[i.outcome];
                      const canRematch = isMe && i.oppKind !== 'group' && !!i.oppId;
                      return (
                        <TouchableOpacity key={i.key} style={[styles.gameRow, idx > 0 && styles.divider]} onPress={() => openItem(i)} activeOpacity={0.7}>
                          <View style={[styles.outcome, { backgroundColor: o.bg }]}>
                            <Text style={[styles.outcomeText, { color: o.color }]}>{o.short}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.gameTitle} numberOfLines={1}>
                              {i.oppKind === 'group' ? (i.eventName ?? 'Pickup game') : `vs ${i.oppName}`}
                            </Text>
                            <Text style={styles.gameMeta} numberOfLines={1}>
                              {SPORT_EMOJI[i.sport] ?? '🏆'} {SOURCE_LABEL[i.source]}
                              {i.eventName && i.oppKind !== 'group' ? ` · ${i.eventName}` : ''}
                              {i.mySideName && i.oppKind === 'team' ? ` · as ${i.mySideName}` : ''}
                            </Text>
                            <Text style={styles.gameDate}>{fmtDate(i.playedAt)}</Text>
                          </View>
                          <View style={{ alignItems: 'flex-end', gap: 6 }}>
                            {!!i.score && <Text style={styles.score}>{i.score}</Text>}
                            {canRematch && (
                              <TouchableOpacity onPress={() => rematch(i.oppKind as 'player' | 'team', i.oppId!, i.oppName, i.sport)} hitSlop={6}>
                                <Text style={styles.rematchLink}>Rematch ›</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ))}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f3f4f6' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    backgroundColor: '#16a34a', flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingTop: Platform.OS === 'android' ? 8 : 4, paddingBottom: 12, gap: 10,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, color: '#fff', fontSize: 18, fontWeight: '700' },
  body: { padding: 16, paddingBottom: 40 },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 40, paddingHorizontal: 20 },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: '#111827' },
  emptyText: { fontSize: 14, color: '#6b7280', textAlign: 'center', lineHeight: 20 },
  primary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#f97316', paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12, marginTop: 6,
  },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  chips: { gap: 8, paddingBottom: 12 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff' },
  chipOn: { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  chipTextOn: { color: '#fff' },
  recordCard: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#e5e7eb', paddingVertical: 14 },
  recordCell: { flex: 1, alignItems: 'center' },
  recordNum: { fontSize: 24, fontWeight: '900', color: '#111827' },
  recordLbl: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  verifiedNote: { fontSize: 11, color: '#6b7280', textAlign: 'center', marginTop: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#111827', marginTop: 20, marginBottom: 8 },
  card: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#e5e7eb' },
  divider: { borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  rivalRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  rivalName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  rivalMeta: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  rematchBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#f97316', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  rematchText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  gameRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  outcome: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  outcomeText: { fontWeight: '900', fontSize: 14 },
  gameTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  gameMeta: { fontSize: 12, color: '#6b7280', marginTop: 1 },
  gameDate: { fontSize: 11, color: '#9ca3af', marginTop: 1 },
  score: { fontSize: 14, fontWeight: '800', color: '#111827' },
  rematchLink: { fontSize: 12, fontWeight: '800', color: '#f97316' },
});
