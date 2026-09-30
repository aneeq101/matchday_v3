import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, ActivityIndicator,
  Platform, Alert, Modal, TextInput, FlatList, Image, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../lib/AuthContext';
import {
  fetchTeam, fetchTeamMembers, addTeamMember, removeTeamMember, deleteTeam, updateTeam,
  type Team, type TeamMember,
} from '../lib/teams';
import { fetchPlayers, fetchPlayer } from '../lib/players';
import PlayerProfileModal from '../components/PlayerProfileModal';
import { openConversation } from '../lib/chatService';
import { createNotification } from '../lib/notifications';
import TeamFormModal, { TEAM_SPORT_EMOJI } from '../components/TeamFormModal';
import type { Player } from '../data/mockData';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function TeamScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [team, setTeam]         = useState<Team | null>(null);
  const [members, setMembers]   = useState<TeamMember[]>([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy]         = useState(false);
  const [confirm, setConfirm]   = useState<null | { title: string; body: string; label: string; run: () => Promise<void> }>(null);

  const [showEdit, setShowEdit]     = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [players, setPlayers]       = useState<Player[]>([]);
  const [search, setSearch]         = useState('');
  const [addingId, setAddingId]     = useState<string | null>(null);
  const [profile, setProfile]       = useState<Player | null>(null);

  const openProfile = async (userId: string) => {
    if (userId === user?.id) return;
    const p = await fetchPlayer(userId);
    if (p) setProfile(p);
  };

  const load = useCallback(async () => {
    if (!id) return;
    const [t, m] = await Promise.all([fetchTeam(id), fetchTeamMembers(id)]);
    setTeam(t);
    setMembers(m);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const userName =
    user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'A player';

  const isCaptain = !!team && team.ownerId === user?.id;
  const isMember  = members.some((m) => m.userId === user?.id);
  const isFull    = !!team && members.length >= team.maxMembers;

  const handleJoin = async () => {
    if (!user || !team || busy) return;
    setBusy(true);
    const res = await addTeamMember(team.id, user.id);
    setBusy(false);
    if (!res.ok) { Alert.alert('Could not join', res.error ?? 'Please try again.'); return; }
    createNotification({
      userId: team.ownerId,
      type: 'team_join',
      title: `${userName} joined ${team.name}`,
      body: `${team.sport} · ${members.length + 1}/${team.maxMembers} members`,
      data: { team_id: team.id },
    }).catch(() => {});
    await load();
  };

  const askLeave = () => setConfirm({
    title: 'Leave team?',
    body: `You'll be removed from ${team?.name}. You can rejoin later if the team is open.`,
    label: 'Leave',
    run: async () => {
      if (!user || !team) return;
      const ok = await removeTeamMember(team.id, user.id);
      if (!ok) { Alert.alert('Error', 'Could not leave the team. Please try again.'); return; }
      router.back();
    },
  });

  const askDelete = () => setConfirm({
    title: 'Delete team?',
    body: `${team?.name} and its member list will be permanently deleted.`,
    label: 'Delete',
    run: async () => {
      if (!team) return;
      const ok = await deleteTeam(team.id);
      if (!ok) { Alert.alert('Error', 'Could not delete the team. Please try again.'); return; }
      router.back();
    },
  });

  const askRemove = (m: TeamMember) => setConfirm({
    title: `Remove ${m.name}?`,
    body: 'They will be removed from the team.',
    label: 'Remove',
    run: async () => {
      if (!team) return;
      const ok = await removeTeamMember(team.id, m.userId);
      if (!ok) { Alert.alert('Error', 'Could not remove player. Please try again.'); return; }
      setMembers((prev) => prev.filter((x) => x.userId !== m.userId));
    },
  });

  const messageMember = async (m: TeamMember) => {
    if (!user || m.userId === user.id) return;
    const res = await openConversation(m.userId);
    if (res.error !== undefined) { Alert.alert('Can\'t message', res.error); return; }
    router.push({ pathname: '/chat', params: { id: res.id, name: m.name, initials: m.initials, color: m.avatarColor } });
  };

  const openInvite = async () => {
    setSearch('');
    setShowInvite(true);
    const all = await fetchPlayers();
    // Only real accounts (mock fallback players have non-UUID ids)
    setPlayers(all.filter((p) => UUID_RE.test(p.id) && p.id !== user?.id));
  };

  const handleAdd = async (p: Player) => {
    if (!team || addingId) return;
    setAddingId(p.id);
    const res = await addTeamMember(team.id, p.id);
    setAddingId(null);
    if (!res.ok) { Alert.alert('Could not add player', res.error ?? 'Please try again.'); return; }
    createNotification({
      userId: p.id,
      type: 'team_invite',
      title: `${userName} added you to ${team.name}`,
      body: `${team.sport} team${team.area ? ` · ${team.area}` : ''}`,
      data: { team_id: team.id },
    }).catch(() => {});
    setMembers((prev) => [
      ...prev,
      { userId: p.id, role: 'member', name: p.name, initials: p.initials, avatarColor: p.avatarColor },
    ]);
  };

  const memberIds = new Set(members.map((m) => m.userId));
  const q = search.trim().toLowerCase();
  const invitable = players.filter(
    (p) => !memberIds.has(p.id) && (!q || p.name.toLowerCase().includes(q) || p.area.toLowerCase().includes(q)),
  );

  if (loading) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator size="large" color="#8b5cf6" />
      </View>
    );
  }

  if (!team) {
    return (
      <View style={styles.root}>
        <SafeAreaView style={styles.header} edges={['top']}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Team</Text>
        </SafeAreaView>
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={40} color="#d1d5db" />
          <Text style={styles.emptyText}>This team no longer exists.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#8b5cf6" />
      <SafeAreaView style={styles.header} edges={['top']}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{team.name}</Text>
        {isCaptain && (
          <TouchableOpacity style={styles.headerIconBtn} onPress={() => setShowEdit(true)}>
            <Ionicons name="create-outline" size={20} color="#fff" />
          </TouchableOpacity>
        )}
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8b5cf6" />}
      >
        {/* Team info */}
        <View style={styles.infoCard}>
          <Text style={{ fontSize: 44 }}>{TEAM_SPORT_EMOJI[team.sport] ?? '🏆'}</Text>
          <Text style={styles.teamName}>{team.name}</Text>
          <Text style={styles.teamMeta}>{team.sport}{team.area ? ` · ${team.area}` : ''}</Text>
          <View style={styles.pillRow}>
            <View style={styles.pill}>
              <Ionicons name="people" size={13} color="#8b5cf6" />
              <Text style={styles.pillText}>{members.length}/{team.maxMembers}</Text>
            </View>
            <View style={styles.pill}>
              <Ionicons name={team.isOpen ? 'lock-open-outline' : 'lock-closed-outline'} size={13} color="#8b5cf6" />
              <Text style={styles.pillText}>{team.isOpen ? 'Open' : 'Invite only'}</Text>
            </View>
          </View>
          {!!team.description && <Text style={styles.teamDesc}>{team.description}</Text>}
        </View>

        {/* Main action */}
        {isCaptain ? (
          <TouchableOpacity
            style={[styles.primaryBtn, isFull && styles.btnDisabled]}
            onPress={openInvite}
            disabled={isFull}
          >
            <Ionicons name="person-add-outline" size={18} color="#fff" />
            <Text style={styles.primaryText}>{isFull ? 'Team is full' : 'Add Players'}</Text>
          </TouchableOpacity>
        ) : !isMember ? (
          <TouchableOpacity
            style={[styles.primaryBtn, (isFull || !team.isOpen) && styles.btnDisabled]}
            onPress={handleJoin}
            disabled={isFull || !team.isOpen || busy}
          >
            {busy ? <ActivityIndicator color="#fff" /> : (
              <>
                <Ionicons name="enter-outline" size={18} color="#fff" />
                <Text style={styles.primaryText}>
                  {isFull ? 'Team is full' : team.isOpen ? 'Join Team' : 'Invite only'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        ) : null}

        {/* Challenge this team (anyone who isn't in it) */}
        {!isMember && !isCaptain && (
          <TouchableOpacity
            style={styles.challengeBtn}
            onPress={() => router.push({
              pathname: '/challenges',
              params: { kind: 'team', opponentId: team.id, opponentName: team.name, sport: team.sport },
            })}
          >
            <Ionicons name="flash" size={18} color="#f97316" />
            <Text style={styles.challengeText}>Challenge this Team</Text>
          </TouchableOpacity>
        )}

        {/* Members */}
        <Text style={styles.sectionTitle}>Members</Text>
        <View style={styles.listCard}>
          {members.map((m, i) => (
            <TouchableOpacity
              key={m.userId}
              style={[styles.memberRow, i > 0 && styles.rowDivider]}
              onPress={() => openProfile(m.userId)}
              disabled={m.userId === user?.id}
              activeOpacity={0.7}
            >
              <View style={[styles.avatar, { backgroundColor: m.avatarColor }]}>
                {m.avatarUrl
                  ? <Image source={{ uri: m.avatarUrl }} style={styles.avatarImg} />
                  : <Text style={styles.avatarText}>{m.initials}</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.memberName}>
                  {m.name}{m.userId === user?.id ? ' (You)' : ''}
                </Text>
                {m.role === 'captain' && <Text style={styles.captainLabel}>Captain</Text>}
              </View>
              {m.userId !== user?.id && (
                <TouchableOpacity style={styles.iconBtn} onPress={() => messageMember(m)}>
                  <Ionicons name="chatbubble-outline" size={18} color="#16a34a" />
                </TouchableOpacity>
              )}
              {isCaptain && m.userId !== user?.id && (
                <TouchableOpacity style={styles.iconBtn} onPress={() => askRemove(m)}>
                  <Ionicons name="close-circle-outline" size={20} color="#ef4444" />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Leave / delete */}
        {isCaptain ? (
          <TouchableOpacity style={styles.dangerBtn} onPress={askDelete}>
            <Ionicons name="trash-outline" size={18} color="#ef4444" />
            <Text style={styles.dangerText}>Delete Team</Text>
          </TouchableOpacity>
        ) : isMember ? (
          <TouchableOpacity style={styles.dangerBtn} onPress={askLeave}>
            <Ionicons name="exit-outline" size={18} color="#ef4444" />
            <Text style={styles.dangerText}>Leave Team</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>

      {/* Edit team */}
      <TeamFormModal
        visible={showEdit}
        title="Edit Team"
        submitLabel="Save Changes"
        lockSport
        minMembers={members.length}
        initial={{
          name: team.name, sport: team.sport, area: team.area,
          description: team.description, isOpen: team.isOpen, maxMembers: team.maxMembers,
        }}
        onClose={() => setShowEdit(false)}
        onSubmit={async (v) => {
          const ok = await updateTeam(team.id, v);
          if (!ok) return 'Could not save changes. Please try again.';
          setShowEdit(false);
          await load();
          return null;
        }}
      />

      {/* Add players */}
      <Modal visible={showInvite} animationType="slide" transparent onRequestClose={() => setShowInvite(false)}>
        <View style={styles.sheetOverlay}>
          <View style={styles.sheet}>
            <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>Add Players</Text>
                <TouchableOpacity onPress={() => setShowInvite(false)}>
                  <Ionicons name="close" size={24} color="#111827" />
                </TouchableOpacity>
              </View>
              <View style={styles.searchBox}>
                <Ionicons name="search" size={18} color="#9ca3af" />
                <TextInput
                  style={styles.searchInput}
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search by name or area"
                  placeholderTextColor="#9ca3af"
                />
              </View>
              <Text style={styles.sheetHint}>{members.length}/{team.maxMembers} spots filled</Text>
              <FlatList
                data={invitable}
                keyExtractor={(p) => p.id}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
                ListEmptyComponent={<Text style={styles.emptyText}>No players found</Text>}
                renderItem={({ item }) => (
                  <View style={styles.inviteRow}>
                    <View style={[styles.avatar, { backgroundColor: item.avatarColor }]}>
                      <Text style={styles.avatarText}>{item.initials}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.memberName}>{item.name}</Text>
                      {!!item.area && <Text style={styles.inviteArea}>{item.area}</Text>}
                    </View>
                    <TouchableOpacity
                      style={[styles.addBtn, members.length >= team.maxMembers && styles.btnDisabled]}
                      onPress={() => handleAdd(item)}
                      disabled={members.length >= team.maxMembers || addingId === item.id}
                    >
                      {addingId === item.id
                        ? <ActivityIndicator size="small" color="#fff" />
                        : <Text style={styles.addBtnText}>Add</Text>}
                    </TouchableOpacity>
                  </View>
                )}
              />
            </SafeAreaView>
          </View>
        </View>
      </Modal>

      <PlayerProfileModal
        player={profile}
        onClose={() => setProfile(null)}
        onMessage={(p) => {
          setProfile(null);
          messageMember({ userId: p.id, role: 'member', name: p.name, initials: p.initials, avatarColor: p.avatarColor });
        }}
      />

      {/* Confirm dialog */}
      <Modal visible={!!confirm} animationType="fade" transparent onRequestClose={() => setConfirm(null)}>
        <View style={styles.centerOverlay}>
          <View style={styles.alertBox}>
            <Text style={styles.alertTitle}>{confirm?.title}</Text>
            <Text style={styles.alertBody}>{confirm?.body}</Text>
            <View style={{ flexDirection: 'row', gap: 10, width: '100%' }}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setConfirm(null)} disabled={busy}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmBtn}
                disabled={busy}
                onPress={async () => {
                  if (!confirm) return;
                  setBusy(true);
                  await confirm.run();
                  setBusy(false);
                  setConfirm(null);
                }}
              >
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmText}>{confirm?.label}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f3f4f6' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  header: {
    backgroundColor: '#8b5cf6', flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingTop: Platform.OS === 'android' ? 8 : 4, paddingBottom: 12, gap: 10,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, color: '#fff', fontSize: 18, fontWeight: '700' },
  headerIconBtn: { padding: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 8 },
  body: { padding: 16, paddingBottom: 40 },
  infoCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 20, alignItems: 'center',
    borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 14,
  },
  teamName: { fontSize: 20, fontWeight: '800', color: '#111827', marginTop: 6 },
  teamMeta: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  pillRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#f5f3ff', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
  },
  pillText: { color: '#7c3aed', fontSize: 12, fontWeight: '600' },
  teamDesc: { fontSize: 14, color: '#374151', textAlign: 'center', marginTop: 12, lineHeight: 20 },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#8b5cf6', paddingVertical: 14, borderRadius: 12, marginBottom: 20,
  },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  btnDisabled: { backgroundColor: '#d1d5db' },
  challengeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: -8,
    paddingVertical: 13, borderRadius: 12, borderWidth: 1.5, borderColor: '#fed7aa', backgroundColor: '#fff7ed', marginBottom: 20,
  },
  challengeText: { color: '#ea580c', fontWeight: '700', fontSize: 15 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 10 },
  listCard: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 20 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  rowDivider: { borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg: { width: 40, height: 40 },
  avatarText: { color: '#fff', fontWeight: '700' },
  memberName: { fontSize: 14, fontWeight: '600', color: '#111827' },
  captainLabel: { fontSize: 11, color: '#b45309', fontWeight: '700', marginTop: 2 },
  iconBtn: { padding: 6 },
  dangerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 13, borderRadius: 12, borderWidth: 1.5, borderColor: '#fecaca', backgroundColor: '#fff5f5',
  },
  dangerText: { color: '#ef4444', fontWeight: '700', fontSize: 15 },
  emptyText: { color: '#9ca3af', fontSize: 14, textAlign: 'center', marginTop: 20 },
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, height: '80%', overflow: 'hidden' },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  sheetHint: { color: '#6b7280', fontSize: 12, marginHorizontal: 16, marginBottom: 8 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8, margin: 16, marginBottom: 8,
    backgroundColor: '#f3f4f6', borderRadius: 10, paddingHorizontal: 12,
  },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 15, color: '#111827' },
  inviteRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  inviteArea: { fontSize: 12, color: '#6b7280' },
  addBtn: { backgroundColor: '#8b5cf6', paddingHorizontal: 16, paddingVertical: 7, borderRadius: 8, minWidth: 60, alignItems: 'center' },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  centerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  alertBox: { backgroundColor: '#fff', borderRadius: 20, padding: 24, width: '85%', maxWidth: 360, alignItems: 'center' },
  alertTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 6 },
  alertBody: { fontSize: 14, color: '#6b7280', textAlign: 'center', marginBottom: 18 },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#e5e7eb' },
  cancelText: { color: '#6b7280', fontWeight: '600' },
  confirmBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', backgroundColor: '#ef4444' },
  confirmText: { color: '#fff', fontWeight: '700' },
});
