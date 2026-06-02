import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  StatusBar,
  ActivityIndicator,
  Image,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { CONVERSATIONS, type Conversation } from '../data/mockData';
import { useAuth } from '../lib/AuthContext';
import { fetchConversations } from '../lib/chatService';

export default function MessagesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [conversations, setConversations] = useState<Conversation[]>(CONVERSATIONS);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) { setConversations(CONVERSATIONS); return; }
    setLoading(true);
    const { real, mock } = await fetchConversations(user.id);
    setConversations([...real, ...mock]);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const filtered = conversations.filter(
    (c) =>
      search === '' ||
      c.playerName.toLowerCase().includes(search.toLowerCase()) ||
      c.lastMessage.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#16a34a" />
      <View style={styles.searchWrapper}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color="#9ca3af" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search conversations..."
            placeholderTextColor="#9ca3af"
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color="#9ca3af" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color="#16a34a" />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="chatbubbles-outline" size={56} color="#d1d5db" />
          <Text style={styles.emptyTitle}>No conversations found</Text>
          <Text style={styles.emptySub}>Connect with players to start messaging</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#16a34a" />}
          renderItem={({ item }) => (
            <ConversationRow
              conversation={item}
              onPress={() => {
                // Optimistically clear unread before navigating
                setConversations((prev) =>
                  prev.map((c) => (c.id === item.id ? { ...c, unread: false } : c))
                );
                router.push({
                  pathname: '/chat',
                  params: { id: item.id, name: item.playerName, initials: item.initials, color: item.avatarColor },
                });
              }}
            />
          )}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
  );
}

function ConversationRow({
  conversation,
  onPress,
}: {
  conversation: Conversation;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.row, conversation.unread && styles.rowUnread]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Avatar: photo if available, else coloured initials circle */}
      {conversation.avatarUrl ? (
        <Image source={{ uri: conversation.avatarUrl }} style={styles.avatarImg} />
      ) : (
        <View style={[styles.avatar, { backgroundColor: conversation.avatarColor }]}>
          <Text style={styles.avatarText}>{conversation.initials}</Text>
        </View>
      )}

      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, conversation.unread && styles.nameUnread]}>
              {conversation.playerName}
            </Text>
            <Ionicons
              name={conversation.gender === 'male' ? 'male' : 'female'}
              size={13}
              color={conversation.gender === 'male' ? '#3b82f6' : '#ec4899'}
            />
          </View>
          <Text style={[styles.timestamp, conversation.unread && styles.timestampUnread]}>
            {conversation.timestamp}
          </Text>
        </View>
        <View style={styles.rowBottom}>
          <Text
            style={[styles.lastMessage, conversation.unread && styles.lastMessageBold]}
            numberOfLines={1}
          >
            {conversation.lastMessage}
          </Text>
          {conversation.unread && <View style={styles.unreadDot} />}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  searchWrapper: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    backgroundColor: '#fff',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#111827' },
  list: { paddingVertical: 4 },
  separator: { height: 1, backgroundColor: '#f3f4f6', marginLeft: 72 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    gap: 12,
  },
  rowUnread: {
    backgroundColor: '#f0fdf4',
  },
  avatarImg: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 18 },
  rowBody: { flex: 1 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  name: { fontWeight: '700', color: '#111827', fontSize: 15 },
  nameUnread: { color: '#16a34a' },
  timestamp: { color: '#9ca3af', fontSize: 12 },
  timestampUnread: { color: '#16a34a', fontWeight: '600' },
  rowBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  lastMessage: { color: '#6b7280', fontSize: 13, flex: 1 },
  lastMessageBold: { color: '#111827', fontWeight: '600' },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3b82f6',
    marginLeft: 8,
  },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#374151' },
  emptySub: { color: '#9ca3af', fontSize: 14 },
});
