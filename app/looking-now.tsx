import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { POSTS, type Post } from '../data/mockData';
import { fetchPosts } from '../lib/posts';
import { getOrCreateConversation } from '../lib/chatService';
import { useAuth } from '../lib/AuthContext';

const SKILL_COLORS: Record<string, string> = {
  Beginner: '#3b82f6',
  Intermediate: '#f59e0b',
  Advanced: '#ef4444',
};

const LOOKING_ICONS: Record<string, string> = {
  'Practice Partner': 'barbell-outline',
  'Doubles Partner': 'people-outline',
  'Team Members': 'people-circle-outline',
  'Pickup Games': 'football-outline',
  'Coach/Mentor': 'school-outline',
  'Regular Group': 'calendar-outline',
};

// Deduplicate posts by playerId — one card per player, their latest post
function dedupByPlayer(posts: Post[]): Post[] {
  const seen = new Set<string>();
  const result: Post[] = [];
  for (const p of posts) {
    if (!seen.has(p.playerId)) {
      seen.add(p.playerId);
      result.push(p);
    }
  }
  return result;
}

export default function LookingNowScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>(dedupByPlayer(POSTS));
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [messagingId, setMessagingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const all = await fetchPosts();
    setPosts(dedupByPlayer(all));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleMessage = async (post: Post) => {
    if (!user) { router.push('/messages'); return; }
    if (post.playerId === user.id) return;

    setMessagingId(post.playerId);
    const convId = await getOrCreateConversation(user.id, post.playerId);
    setMessagingId(null);

    if (convId) {
      router.push({
        pathname: '/chat',
        params: {
          id: convId,
          name: post.playerName,
          initials: post.initials,
          color: post.avatarColor,
        },
      });
    }
  };

  // Hide the current user's own post from this list
  const visible = posts.filter((p) => p.playerId !== user?.id);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#16a34a" />
      <SafeAreaView style={styles.header} edges={['top']}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Looking Now</Text>
          <Text style={styles.headerSub}>{visible.length} players seeking partners</Text>
        </View>
        <View style={styles.liveDot}>
          <View style={styles.livePulse} />
          <Text style={styles.liveLabel}>Live</Text>
        </View>
      </SafeAreaView>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#16a34a" />
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#16a34a" />}
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="search-outline" size={52} color="#d1d5db" />
              <Text style={styles.emptyTitle}>No one looking right now</Text>
              <Text style={styles.emptySub}>Be the first to post in The Hood</Text>
            </View>
          }
          renderItem={({ item }) => (
            <LookingCard
              post={item}
              isMessaging={messagingId === item.playerId}
              onMessage={() => handleMessage(item)}
            />
          )}
        />
      )}
    </View>
  );
}

function LookingCard({
  post,
  isMessaging,
  onMessage,
}: {
  post: Post;
  isMessaging: boolean;
  onMessage: () => void;
}) {
  const iconName = (LOOKING_ICONS[post.lookingFor] ?? 'search-outline') as keyof typeof Ionicons.glyphMap;

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={[styles.avatar, { backgroundColor: post.avatarColor }]}>
          <Text style={styles.avatarText}>{post.initials}</Text>
        </View>
        <View style={styles.playerInfo}>
          <Text style={styles.playerName}>{post.playerName}</Text>
          <View style={styles.lookingBadge}>
            <Ionicons name={iconName} size={12} color="#16a34a" />
            <Text style={styles.lookingBadgeText}>{post.lookingFor}</Text>
          </View>
        </View>
        <Text style={styles.timeAgo}>{post.time}</Text>
      </View>

      <Text style={styles.postText} numberOfLines={2}>{post.text}</Text>

      <View style={styles.tagsRow}>
        {post.sports.map((s, i) => (
          <View key={i} style={styles.sportTag}>
            <Text style={styles.sportTagText}>{s.emoji} {s.name}</Text>
            <View style={[styles.skillChip, { backgroundColor: SKILL_COLORS[s.skill] }]}>
              <Text style={styles.skillChipText}>{s.skill}</Text>
            </View>
          </View>
        ))}
      </View>

      <TouchableOpacity style={styles.messageBtn} onPress={onMessage} disabled={isMessaging}>
        {isMessaging ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <>
            <Ionicons name="chatbubble-outline" size={16} color="#fff" />
            <Text style={styles.messageBtnText}>Message {post.playerName.split(' ')[0]}</Text>
          </>
        )}
      </TouchableOpacity>
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
    paddingBottom: 14,
    gap: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  headerSub: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 1 },
  liveDot: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  livePulse: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#86efac' },
  liveLabel: { color: '#fff', fontSize: 12, fontWeight: '600' },
  list: { padding: 14, gap: 12, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#374151' },
  emptySub: { color: '#9ca3af', fontSize: 14 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  playerInfo: { flex: 1, gap: 4 },
  playerName: { fontWeight: '700', color: '#111827', fontSize: 15 },
  lookingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  lookingBadgeText: { color: '#16a34a', fontSize: 11, fontWeight: '600' },
  timeAgo: { color: '#9ca3af', fontSize: 11 },
  postText: { color: '#374151', fontSize: 13, lineHeight: 20, marginBottom: 10 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  sportTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  sportTagText: { color: '#374151', fontSize: 12, fontWeight: '500' },
  skillChip: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  skillChipText: { color: '#fff', fontSize: 10, fontWeight: '600' },
  messageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: '#16a34a',
    paddingVertical: 11,
    borderRadius: 10,
  },
  messageBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
