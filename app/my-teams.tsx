import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, ActivityIndicator, Platform, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../lib/AuthContext';
import { fetchMyTeams, fetchDiscoverTeams, createTeam, addTeamMember, type Team } from '../lib/teams';
import { createNotification } from '../lib/notifications';
import TeamFormModal, { TEAM_SPORT_EMOJI } from '../components/TeamFormModal';

export default function MyTeamsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [myTeams, setMyTeams]       = useState<Team[]>([]);
  const [discover, setDiscover]     = useState<Team[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [joiningId, setJoiningId]   = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const mine = await fetchMyTeams(user.id);
    const others = await fetchDiscoverTeams(user.id, mine.map((t) => t.id));
    setMyTeams(mine);
    setDiscover(others);
    setLoading(false);
  }, [user]);

  // Reload whenever the screen comes back into focus (e.g. after leaving a team)
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const userName =
    user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'A player';

  const handleJoin = async (team: Team) => {
    if (!user || joiningId) return;
    setJoiningId(team.id);
    const res = await addTeamMember(team.id, user.id);
    setJoiningId(null);
    if (!res.ok) { Alert.alert('Could not join', res.error ?? 'Please try again.'); return; }
    createNotification({
      userId: team.ownerId,
      type: 'team_join',
      title: `${userName} joined ${team.name}`,
      body: `${team.sport} · ${team.memberCount + 1}/${team.maxMembers} members`,
      data: { team_id: team.id },
    }).catch(() => {});
    await load();
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#8b5cf6" />
      <SafeAreaView style={styles.header} edges={['top']}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Teams</Text>
        <TouchableOpacity style={styles.newBtn} onPress={() => setShowCreate(true)}>
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.newBtnText}>New Team</Text>
        </TouchableOpacity>
      </SafeAreaView>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#8b5cf6" /></View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.body}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8b5cf6" />}
        >
          <Text style={styles.sectionTitle}>Your Teams</Text>
          {myTeams.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={40} color="#d1d5db" />
              <Text style={styles.emptyTitle}>You're not in a team yet</Text>
              <Text style={styles.emptySub}>Create your own or join one below</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => setShowCreate(true)}>
                <Text style={styles.emptyBtnText}>Create a Team</Text>
              </TouchableOpacity>
            </View>
          ) : (
            myTeams.map((t) => (
              <TeamCard
                key={t.id}
                team={t}
                isCaptain={t.ownerId === user?.id}
                onPress={() => router.push({ pathname: '/team', params: { id: t.id } })}
              />
            ))
          )}

          <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Discover Teams</Text>
          {discover.length === 0 ? (
            <Text style={styles.emptySub}>No open teams to join right now.</Text>
          ) : (
            discover.map((t) => {
              const full = t.memberCount >= t.maxMembers;
              return (
                <TeamCard
                  key={t.id}
                  team={t}
                  onPress={() => router.push({ pathname: '/team', params: { id: t.id } })}
                  action={
                    <TouchableOpacity
                      style={[styles.joinBtn, full && styles.joinBtnDisabled]}
                      disabled={full || joiningId === t.id}
                      onPress={() => handleJoin(t)}
                    >
                      {joiningId === t.id
                        ? <ActivityIndicator size="small" color="#fff" />
                        : <Text style={styles.joinBtnText}>{full ? 'Full' : 'Join'}</Text>}
                    </TouchableOpacity>
                  }
                />
              );
            })
          )}
        </ScrollView>
      )}

      <TeamFormModal
        visible={showCreate}
        title="Create Team"
        submitLabel="Create Team"
        onClose={() => setShowCreate(false)}
        onSubmit={async (v) => {
          if (!user) return 'Please sign in again.';
          const res = await createTeam({ ownerId: user.id, ...v });
          if (!res.ok) return res.error ?? 'Could not create team.';
          setShowCreate(false);
          await load();
          return null;
        }}
      />
    </View>
  );
}

function TeamCard({
  team, isCaptain, onPress, action,
}: { team: Team; isCaptain?: boolean; onPress: () => void; action?: React.ReactNode }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.cardEmoji}>
        <Text style={{ fontSize: 26 }}>{TEAM_SPORT_EMOJI[team.sport] ?? '🏆'}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={styles.cardName} numberOfLines={1}>{team.name}</Text>
          {isCaptain && (
            <View style={styles.captainBadge}><Text style={styles.captainText}>Captain</Text></View>
          )}
        </View>
        <Text style={styles.cardMeta}>
          {team.sport}{team.area ? ` · ${team.area}` : ''}
        </Text>
        <Text style={styles.cardMembers}>
          <Ionicons name="people" size={12} color="#8b5cf6" /> {team.memberCount}/{team.maxMembers} members
          {!team.isOpen ? ' · Invite only' : ''}
        </Text>
      </View>
      {action ?? <Ionicons name="chevron-forward" size={18} color="#9ca3af" />}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f3f4f6' },
  header: {
    backgroundColor: '#8b5cf6', flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingTop: Platform.OS === 'android' ? 8 : 4, paddingBottom: 12, gap: 10,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, color: '#fff', fontSize: 18, fontWeight: '700' },
  newBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
  },
  newBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { padding: 16, paddingBottom: 40 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 10 },
  empty: {
    backgroundColor: '#fff', borderRadius: 14, padding: 24, alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: '#e5e7eb',
  },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#374151' },
  emptySub: { fontSize: 13, color: '#9ca3af' },
  emptyBtn: { marginTop: 8, backgroundColor: '#8b5cf6', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10 },
  emptyBtnText: { color: '#fff', fontWeight: '700' },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: '#e5e7eb',
  },
  cardEmoji: {
    width: 50, height: 50, borderRadius: 12, backgroundColor: '#f5f3ff',
    alignItems: 'center', justifyContent: 'center',
  },
  cardName: { fontSize: 15, fontWeight: '700', color: '#111827', flexShrink: 1 },
  cardMeta: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  cardMembers: { fontSize: 12, color: '#8b5cf6', marginTop: 4, fontWeight: '600' },
  captainBadge: { backgroundColor: '#fef3c7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  captainText: { color: '#b45309', fontSize: 10, fontWeight: '700' },
  joinBtn: { backgroundColor: '#8b5cf6', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, minWidth: 64, alignItems: 'center' },
  joinBtnDisabled: { backgroundColor: '#d1d5db' },
  joinBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
