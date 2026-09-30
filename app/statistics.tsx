import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, ActivityIndicator, Platform, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../lib/AuthContext';
import { fetchStatistics, type StatisticsData } from '../lib/statistics';
import { SPORT_STAT_FIELDS } from '../lib/sportStats';

const SPORT_EMOJI: Record<string, string> = {
  Football: '⚽', Cricket: '🏏', Tennis: '🎾', Basketball: '🏀',
  Hockey: '🏑', Badminton: '🏸', Baseball: '⚾',
};

export default function StatisticsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [data, setData]             = useState<StatisticsData | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setData(await fetchStatistics(user.id));
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const sports  = data?.sports ?? [];
  const played  = sports.reduce((s, p) => s + p.matches, 0);
  const wins    = sports.reduce((s, p) => s + p.wins, 0);
  const losses  = sports.reduce((s, p) => s + p.losses, 0);
  const winRate = played > 0 ? Math.round((wins / played) * 100) : 0;
  const a = data?.activity;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#16a34a" />
      <SafeAreaView style={styles.header} edges={['top']}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Statistics</Text>
      </SafeAreaView>

      {!data ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#16a34a" /></View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.body}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#16a34a" />}
        >
          {/* Overview */}
          <View style={styles.overview}>
            <Big value={played} label="Played" />
            <Big value={wins} label="Won" color="#16a34a" />
            <Big value={losses} label="Lost" color="#ef4444" />
            <Big value={played > 0 ? `${winRate}%` : '—'} label="Win Rate" color="#16a34a" />
          </View>

          {/* Activity on MatchDay */}
          <Text style={styles.sectionTitle}>Activity</Text>
          <View style={styles.activityGrid}>
            <Tile icon="calendar-outline"  color="#16a34a" value={a!.bookings}          label="Bookings" />
            <Tile icon="time-outline"      color="#0ea5e9" value={a!.hoursBooked}       label="Hours Booked" />
            <Tile icon="football-outline"  color="#3b82f6" value={a!.matchesOrganized}  label="Matches Organized" />
            <Tile icon="enter-outline"     color="#6366f1" value={a!.matchesJoined}     label="Matches Joined" />
            <Tile icon="trophy-outline"    color="#f59e0b" value={a!.tournaments}       label="Tournaments" />
            <Tile icon="people-outline"    color="#8b5cf6" value={a!.teams}             label="Teams" />
            <Tile icon="heart-outline"     color="#ec4899" value={a!.followers}         label="Followers" />
            <Tile icon="person-add-outline" color="#14b8a6" value={a!.following}        label="Following" />
          </View>

          {/* Per sport */}
          <Text style={styles.sectionTitle}>By Sport</Text>
          {sports.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="stats-chart-outline" size={36} color="#d1d5db" />
              <Text style={styles.emptyText}>No sport stats recorded yet</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/(tabs)/profile')}>
                <Text style={styles.emptyBtnText}>Record stats on your Profile</Text>
              </TouchableOpacity>
            </View>
          ) : (
            sports.map((s) => {
              const rate = s.matches > 0 ? Math.round((s.wins / s.matches) * 100) : 0;
              const fields = (SPORT_STAT_FIELDS[s.sport] ?? []).filter((f) => s.sportStats[f.key] !== undefined);
              return (
                <View key={s.sport} style={styles.sportCard}>
                  <View style={styles.sportHeader}>
                    <Text style={{ fontSize: 22 }}>{SPORT_EMOJI[s.sport] ?? '🏆'}</Text>
                    <Text style={styles.sportName}>{s.sport}</Text>
                    <Text style={styles.sportRecord}>
                      {s.wins}W · {s.losses}L{s.draws > 0 ? ` · ${s.draws}D` : ''}
                    </Text>
                  </View>
                  <View style={styles.barRow}>
                    <View style={styles.barBg}>
                      <View style={[styles.barFill, { width: `${rate}%` as `${number}%` }]} />
                    </View>
                    <Text style={styles.barPct}>{rate}%</Text>
                  </View>
                  <Text style={styles.barLabel}>{s.matches} matches played</Text>
                  {fields.length > 0 && (
                    <View style={styles.fieldGrid}>
                      {fields.map((f) => (
                        <View key={f.key} style={styles.fieldCell}>
                          <Text style={styles.fieldValue}>{String(s.sportStats[f.key])}</Text>
                          <Text style={styles.fieldLabel}>{f.label}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })
          )}

          {sports.length > 0 && (
            <TouchableOpacity style={styles.linkBtn} onPress={() => router.push('/(tabs)/profile')}>
              <Ionicons name="create-outline" size={16} color="#16a34a" />
              <Text style={styles.linkText}>Update your stats on the Profile tab</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}
    </View>
  );
}

function Big({ value, label, color }: { value: number | string; label: string; color?: string }) {
  return (
    <View style={styles.bigItem}>
      <Text style={[styles.bigValue, color ? { color } : null]}>{value}</Text>
      <Text style={styles.bigLabel}>{label}</Text>
    </View>
  );
}

function Tile({ icon, color, value, label }: {
  icon: React.ComponentProps<typeof Ionicons>['name']; color: string; value: number; label: string;
}) {
  return (
    <View style={styles.tile}>
      <View style={[styles.tileIcon, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={styles.tileValue}>{value}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f3f4f6' },
  header: {
    backgroundColor: '#16a34a', flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingTop: Platform.OS === 'android' ? 8 : 4, paddingBottom: 12, gap: 10,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, color: '#fff', fontSize: 18, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { padding: 16, paddingBottom: 40 },
  overview: {
    flexDirection: 'row', backgroundColor: '#fff', borderRadius: 16, paddingVertical: 18,
    borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 20,
  },
  bigItem: { flex: 1, alignItems: 'center' },
  bigValue: { fontSize: 24, fontWeight: '800', color: '#111827' },
  bigLabel: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 10 },
  activityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  tile: {
    width: '47.5%', backgroundColor: '#fff', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: '#e5e7eb',
  },
  tileIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  tileValue: { fontSize: 22, fontWeight: '800', color: '#111827' },
  tileLabel: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  empty: {
    backgroundColor: '#fff', borderRadius: 14, padding: 24, alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: '#e5e7eb',
  },
  emptyText: { color: '#6b7280', fontSize: 14 },
  emptyBtn: { backgroundColor: '#f0fdf4', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  emptyBtnText: { color: '#16a34a', fontWeight: '600' },
  sportCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 12,
    borderWidth: 1, borderColor: '#e5e7eb',
  },
  sportHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  sportName: { flex: 1, fontSize: 16, fontWeight: '700', color: '#111827' },
  sportRecord: { fontSize: 13, color: '#6b7280', fontWeight: '600' },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  barBg: { flex: 1, height: 10, backgroundColor: '#f3f4f6', borderRadius: 5, overflow: 'hidden' },
  barFill: { height: 10, backgroundColor: '#16a34a', borderRadius: 5 },
  barPct: { fontSize: 13, fontWeight: '700', color: '#16a34a', minWidth: 38, textAlign: 'right' },
  barLabel: { fontSize: 12, color: '#9ca3af', marginTop: 4 },
  fieldGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  fieldCell: { width: '33.33%', paddingVertical: 10, alignItems: 'center' },
  fieldValue: { fontSize: 18, fontWeight: '800', color: '#111827' },
  fieldLabel: { fontSize: 11, color: '#6b7280', marginTop: 2, textAlign: 'center' },
  linkBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 },
  linkText: { color: '#16a34a', fontWeight: '600' },
});
