import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, ActivityIndicator, Platform, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../lib/AuthContext';
import { fetchMyOrganisedTournaments, fetchMyRegistrations } from '../lib/tournaments';
import type { Tournament } from '../data/mockData';

const TYPE_COLORS: Record<string, string> = {
  tournament: '#8b5cf6',
  league:     '#3b82f6',
  match:      '#16a34a',
};
const TYPE_LABELS: Record<string, string> = {
  tournament: 'Tournament',
  league:     'League',
  match:      'Match',
};

export default function MyTournamentsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [organised, setOrganised]     = useState<Tournament[]>([]);
  const [registered, setRegistered]   = useState<Tournament[]>([]);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const [org, reg] = await Promise.all([
      fetchMyOrganisedTournaments(user.id),
      fetchMyRegistrations(user.id),
    ]);
    setOrganised(org);
    setRegistered(reg);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const total = organised.length + registered.length;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#f59e0b" />
      <SafeAreaView style={styles.header} edges={['top']}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>My Tournaments</Text>
          <Text style={styles.headerSub}>{total} event{total !== 1 ? 's' : ''} total</Text>
        </View>
      </SafeAreaView>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#f59e0b" />
        </View>
      ) : total === 0 ? (
        <View style={styles.center}>
          <Ionicons name="trophy-outline" size={52} color="#d1d5db" />
          <Text style={styles.emptyTitle}>No events yet</Text>
          <Text style={styles.emptySub}>Events you create or join in the Earn tab will appear here</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f59e0b" />}
        >
          {organised.length > 0 && (
            <>
              <View style={styles.sectionHeader}>
                <Ionicons name="shield-checkmark-outline" size={16} color="#f59e0b" />
                <Text style={styles.sectionTitle}>Organised by You</Text>
                <Text style={styles.sectionCount}>{organised.length}</Text>
              </View>
              {organised.map((item) => <EventCard key={item.id} event={item} badge="Organiser" badgeColor="#f59e0b" />)}
            </>
          )}

          {registered.length > 0 && (
            <>
              <View style={[styles.sectionHeader, organised.length > 0 && { marginTop: 8 }]}>
                <Ionicons name="person-outline" size={16} color="#16a34a" />
                <Text style={styles.sectionTitle}>Registered / Joined</Text>
                <Text style={styles.sectionCount}>{registered.length}</Text>
              </View>
              {registered.map((item) => <EventCard key={item.id} event={item} badge="Registered" badgeColor="#16a34a" />)}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

function EventCard({ event, badge, badgeColor }: { event: Tournament; badge: string; badgeColor: string }) {
  const typeColor = TYPE_COLORS[event.type] ?? '#16a34a';
  const typeLabel = TYPE_LABELS[event.type] ?? event.type;
  const progress  = event.maxParticipants > 0 ? event.participants / event.maxParticipants : 0;
  const full      = event.participants >= event.maxParticipants;

  return (
    <View style={[styles.card, { borderLeftColor: typeColor }]}>
      <View style={styles.cardTop}>
        <Text style={styles.cardEmoji}>{event.sportEmoji}</Text>
        <View style={{ flex: 1 }}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardName} numberOfLines={1}>{event.name}</Text>
            <View style={[styles.typeBadge, { backgroundColor: typeColor + '20' }]}>
              <Text style={[styles.typeBadgeText, { color: typeColor }]}>{typeLabel}</Text>
            </View>
          </View>
          <Text style={styles.cardMeta}>{event.date}{event.location ? `  ·  ${event.location}` : ''}</Text>
        </View>
      </View>

      {/* Participant bar */}
      <View style={styles.barRow}>
        <View style={styles.barBg}>
          <View style={[styles.barFill, { width: `${Math.round(progress * 100)}%` as any, backgroundColor: typeColor }]} />
        </View>
        <Text style={[styles.barLabel, full && { color: typeColor, fontWeight: '700' }]}>
          {event.participants}/{event.maxParticipants} players{full ? ' · Full' : ''}
        </Text>
      </View>

      {/* Fee / Prize + role badge */}
      <View style={styles.cardFooter}>
        <View style={[styles.roleBadge, { backgroundColor: badgeColor + '18' }]}>
          <Text style={[styles.roleBadgeText, { color: badgeColor }]}>{badge}</Text>
        </View>
        {(event.entryFee > 0 || event.prizePool > 0) && (
          <View style={styles.moneyRow}>
            {event.entryFee  > 0 && <Text style={styles.feeText}>Entry: PKR {event.entryFee.toLocaleString()}</Text>}
            {event.prizePool > 0 && <Text style={styles.prizeText}>🏆 PKR {event.prizePool.toLocaleString()}</Text>}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f3f4f6' },
  header: {
    backgroundColor: '#f59e0b',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: Platform.OS === 'android' ? 8 : 4,
    paddingBottom: 12,
    gap: 10,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  headerSub: { color: 'rgba(255,255,255,0.85)', fontSize: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 10, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#374151' },
  emptySub: { color: '#9ca3af', fontSize: 14, textAlign: 'center' },
  list: { padding: 14, gap: 12, paddingBottom: 40 },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginBottom: 8, marginTop: 4,
  },
  sectionTitle: { flex: 1, fontWeight: '700', color: '#374151', fontSize: 14 },
  sectionCount: {
    fontSize: 12, fontWeight: '700', color: '#6b7280',
    backgroundColor: '#e5e7eb', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2,
  },
  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14,
    borderLeftWidth: 3,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  cardTop: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  cardEmoji: { fontSize: 30, paddingTop: 2 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  cardName: { flex: 1, fontWeight: '700', color: '#111827', fontSize: 14 },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  typeBadgeText: { fontSize: 11, fontWeight: '700' },
  cardMeta: { color: '#6b7280', fontSize: 12 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  barBg: { flex: 1, height: 6, backgroundColor: '#f3f4f6', borderRadius: 3, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
  barLabel: { fontSize: 11, color: '#6b7280', flexShrink: 0 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  roleBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  roleBadgeText: { fontSize: 11, fontWeight: '700' },
  moneyRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  feeText: { color: '#374151', fontSize: 12, fontWeight: '600' },
  prizeText: { color: '#16a34a', fontSize: 12, fontWeight: '700' },
});
