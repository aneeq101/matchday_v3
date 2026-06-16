import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  StatusBar, ActivityIndicator, Platform, Image, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../lib/AuthContext';
import {
  fetchFollowers, fetchFollowing, followUser, unfollowUser,
  type FollowUser,
} from '../lib/follows';

type Tab = 'followers' | 'following';

export default function FollowersScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ tab?: string }>();

  const [tab, setTab]           = useState<Tab>((params.tab as Tab) ?? 'followers');
  const [followers, setFollowers] = useState<FollowUser[]>([]);
  const [following, setFollowing] = useState<FollowUser[]>([]);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toggling, setToggling]   = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const [fl, fg] = await Promise.all([
      fetchFollowers(user.id),
      fetchFollowing(user.id),
    ]);
    setFollowers(fl);
    setFollowing(fg);
    setFollowingIds(new Set(fg.map((u) => u.id)));
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const toggle = async (target: FollowUser) => {
    if (!user || toggling) return;
    setToggling(target.id);
    const already = followingIds.has(target.id);
    if (already) {
      const ok = await unfollowUser(user.id, target.id);
      if (ok) {
        setFollowingIds((prev) => { const s = new Set(prev); s.delete(target.id); return s; });
        setFollowing((prev) => prev.filter((u) => u.id !== target.id));
      }
    } else {
      const ok = await followUser(user.id, target.id);
      if (ok) {
        setFollowingIds((prev) => new Set([...prev, target.id]));
        setFollowing((prev) => [...prev, target]);
      }
    }
    setToggling(null);
  };

  const data = tab === 'followers' ? followers : following;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#16a34a" />
      <SafeAreaView style={styles.header} edges={['top']}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Connections</Text>
      </SafeAreaView>

      {/* Tabs */}
      <View style={styles.tabBar}>
        {(['followers', 'following'] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tabBtn, tab === t && styles.tabBtnActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'followers' ? `Followers (${followers.length})` : `Following (${following.length})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#16a34a" />
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          contentContainerStyle={data.length === 0 ? styles.emptyContainer : styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#16a34a" />}
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="people-outline" size={52} color="#d1d5db" />
              <Text style={styles.emptyTitle}>
                {tab === 'followers' ? 'No followers yet' : 'Not following anyone'}
              </Text>
              <Text style={styles.emptySub}>
                {tab === 'followers'
                  ? 'Players who follow you will appear here'
                  : 'Follow players from The Hood to see them here'}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const isMe = item.id === user?.id;
            const isFollowingThem = followingIds.has(item.id);
            return (
              <View style={styles.row}>
                {item.avatarUrl ? (
                  <Image source={{ uri: item.avatarUrl }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback]}>
                    <Text style={styles.avatarText}>{item.initials}</Text>
                  </View>
                )}
                <View style={styles.rowInfo}>
                  <Text style={styles.rowName}>{item.name}</Text>
                </View>
                {!isMe && (
                  <TouchableOpacity
                    style={[styles.followBtn, isFollowingThem && styles.followingBtn]}
                    onPress={() => toggle(item)}
                    disabled={toggling === item.id}
                  >
                    {toggling === item.id
                      ? <ActivityIndicator size="small" color={isFollowingThem ? '#6b7280' : '#fff'} />
                      : <Text style={[styles.followBtnText, isFollowingThem && styles.followingBtnText]}>
                          {isFollowingThem ? 'Following' : 'Follow'}
                        </Text>}
                  </TouchableOpacity>
                )}
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f3f4f6' },
  header: {
    backgroundColor: '#16a34a',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: Platform.OS === 'android' ? 8 : 4,
    paddingBottom: 12,
    gap: 10,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  tabBar: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  tabBtn: { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBtnActive: { borderBottomColor: '#16a34a' },
  tabText: { fontSize: 14, color: '#6b7280', fontWeight: '600' },
  tabTextActive: { color: '#16a34a' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 10, paddingHorizontal: 32 },
  emptyContainer: { flex: 1 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#374151' },
  emptySub: { color: '#9ca3af', fontSize: 14, textAlign: 'center' },
  list: { paddingVertical: 4 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  avatar: { width: 46, height: 46, borderRadius: 23, flexShrink: 0 },
  avatarFallback: { backgroundColor: '#16a34a', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  rowInfo: { flex: 1 },
  rowName: { fontWeight: '600', color: '#111827', fontSize: 15 },
  followBtn: {
    backgroundColor: '#16a34a', paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20, minWidth: 88, alignItems: 'center',
  },
  followingBtn: { backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb' },
  followBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  followingBtnText: { color: '#6b7280' },
});
