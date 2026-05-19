import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  StatusBar,
  FlatList,
  ImageBackground,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { PLAYERS, POSTS, playerDistanceKm, type Player, type Post } from '../../data/mockData';
import { formatDistance } from '../../utils/geo';
import { useUserLocation } from '../../hooks/useUserLocation';
import PlayerProfileModal from '../../components/PlayerProfileModal';

const FIELD_IMAGE = 'https://images.unsplash.com/photo-1537020724888-8c2fb2b2ae7e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxicmlnaHQlMjBmb290YmFsbCUyMGZpZWxkJTIwZ3Jhc3N8ZW58MXx8fHwxNzY1NzM5NzA0fDA&ixlib=rb-4.1.0&q=80&w=1080';

const SKILL_COLORS: Record<string, string> = {
  Beginner: '#3b82f6',
  Intermediate: '#f59e0b',
  Advanced: '#ef4444',
};

const LOOKING_FOR_OPTIONS = [
  'Doubles Partner',
  'Regular Group',
  'Team Members',
  'Pickup Games',
  'Practice Partner',
  'Coach/Mentor',
];

const SPORTS = ['Football', 'Cricket', 'Tennis', 'Basketball', 'Hockey', 'Badminton'];
const SKILL_LEVELS: Array<'Beginner' | 'Intermediate' | 'Advanced'> = ['Beginner', 'Intermediate', 'Advanced'];
const RADII = ['1 km', '3 km', '5 km', '10 km', '15 km'];
const PLAYER_RADIUS_OPTIONS = [1, 3, 5, 10, 20];

export default function HoodScreen() {
  const router = useRouter();
  const { location } = useUserLocation();
  const [playerRadius, setPlayerRadius] = useState(5);

  const nearbyCount = location
    ? PLAYERS.filter((p) => playerDistanceKm(location, p) <= playerRadius).length
    : PLAYERS.length;
  const lookingCount = location
    ? PLAYERS.filter((p) => p.privacy === 'public' && playerDistanceKm(location, p) <= playerRadius).length
    : PLAYERS.filter((p) => p.privacy === 'public').length;

  const [showPlayersModal, setShowPlayersModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null);
  const [playerSearch, setPlayerSearch] = useState('');
  const [sportFilter, setSportFilter] = useState('All');
  const [broadcastRadius, setBroadcastRadius] = useState('3 km');
  const [broadcastSent, setBroadcastSent] = useState(false);
  const [postText, setPostText] = useState('');
  const [lookingFor, setLookingFor] = useState('Practice Partner');
  const [postSport, setPostSport] = useState('Football');
  const [skillLevel, setSkillLevel] = useState<'Beginner' | 'Intermediate' | 'Advanced'>('Intermediate');
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [posts, setPosts] = useState<Post[]>(POSTS);

  const allSports = ['All', ...SPORTS];

  const filteredPlayers = PLAYERS.filter((p) => {
    const matchSearch =
      playerSearch === '' ||
      p.name.toLowerCase().includes(playerSearch.toLowerCase()) ||
      p.area.toLowerCase().includes(playerSearch.toLowerCase());
    const matchSport =
      sportFilter === 'All' || p.sports.some((s) => s.name === sportFilter);
    const matchRadius = !location || playerDistanceKm(location, p) <= playerRadius;
    return matchSearch && matchSport && matchRadius;
  });

  const toggleLike = (postId: string) => {
    setLikedPosts((prev) => {
      const next = new Set(prev);
      next.has(postId) ? next.delete(postId) : next.add(postId);
      return next;
    });
  };

  const handlePost = () => {
    const newPost: Post = {
      id: String(Date.now()),
      playerId: 'me',
      playerName: 'You',
      initials: 'ME',
      avatarColor: '#16a34a',
      time: 'Just now',
      text: postText || 'Looking to play!',
      sports: [{ name: postSport, skill: skillLevel, emoji: '' }],
      lookingFor,
      likes: 0,
      comments: 0,
    };
    setPosts([newPost, ...posts]);
    setShowCreateModal(false);
    setPostText('');
  };

  const handleBroadcast = () => {
    setBroadcastSent(true);
    setTimeout(() => {
      setBroadcastSent(false);
      setShowBroadcastModal(false);
      setShowCreateModal(false);
    }, 1500);
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <View style={styles.safeHeader}>
        <ImageBackground source={{ uri: FIELD_IMAGE }} style={styles.headerBg} resizeMode="cover">
          <View style={styles.headerOverlay}>
            <SafeAreaView edges={['top']}>
              <View style={styles.header}>
                <Text style={styles.headerTitle}>The Hood</Text>
                <TouchableOpacity onPress={() => router.push('/messages')}>
                  <Ionicons name="chatbubbles-outline" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
              <View style={styles.statsRow}>
                <TouchableOpacity style={styles.statCard} onPress={() => setShowPlayersModal(true)}>
                  <Ionicons name="people" size={18} color="#fff" />
                  <Text style={styles.statText}>{nearbyCount} Near You</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.statCard} onPress={() => setShowPlayersModal(true)}>
                  <Ionicons name="search" size={18} color="#fff" />
                  <Text style={styles.statText}>{lookingCount} Looking</Text>
                </TouchableOpacity>
              </View>
            </SafeAreaView>
          </View>
        </ImageBackground>
      </View>

      <ScrollView style={styles.feed} contentContainerStyle={styles.feedContent}>
        {posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            liked={likedPosts.has(post.id)}
            onLike={() => toggleLike(post.id)}
            onAvatarPress={() => {
              const p = PLAYERS.find((pl) => pl.id === post.playerId);
              if (p) setSelectedPlayer(p);
            }}
          />
        ))}
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={() => setShowCreateModal(true)}>
        <ImageBackground source={{ uri: FIELD_IMAGE }} style={styles.fabImage} resizeMode="cover">
          <View style={styles.fabOverlay}>
            <Ionicons name="add" size={28} color="#fff" />
          </View>
        </ImageBackground>
      </TouchableOpacity>

      {/* Players List Modal */}
      <Modal visible={showPlayersModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Players Nearby</Text>
              <TouchableOpacity onPress={() => setShowPlayersModal(false)}>
                <Ionicons name="close" size={24} color="#111827" />
              </TouchableOpacity>
            </View>

            <View style={styles.searchBox}>
              <Ionicons name="search" size={18} color="#9ca3af" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search players..."
                value={playerSearch}
                onChangeText={setPlayerSearch}
                placeholderTextColor="#9ca3af"
              />
            </View>

            {/* Radius selector */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.radiusBar}
              contentContainerStyle={styles.radiusBarContent}
            >
              {PLAYER_RADIUS_OPTIONS.map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.radiusPill, playerRadius === r && styles.radiusPillActive]}
                  onPress={() => setPlayerRadius(r)}
                >
                  <Ionicons name="radio-button-on" size={12} color={playerRadius === r ? '#fff' : '#6b7280'} />
                  <Text style={[styles.radiusPillText, playerRadius === r && styles.radiusPillTextActive]}>
                    {r} km
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.pillDivider} />

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillRow}>
              {allSports.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.pill, sportFilter === s && styles.pillActive]}
                  onPress={() => setSportFilter(s)}
                >
                  <Text style={[styles.pillText, sportFilter === s && styles.pillTextActive]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <FlatList
              data={filteredPlayers}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: 16 }}
              renderItem={({ item }) => (
                <PlayerCard
                  player={item}
                  distance={location ? formatDistance(playerDistanceKm(location, item)) : item.distance}
                  expanded={expandedPlayerId === item.id}
                  onExpand={() =>
                    setExpandedPlayerId(expandedPlayerId === item.id ? null : item.id)
                  }
                  onProfile={() => {
                    setShowPlayersModal(false);
                    setSelectedPlayer(item);
                  }}
                  onMessage={() => {
                    setShowPlayersModal(false);
                    router.push('/messages');
                  }}
                />
              )}
            />
          </SafeAreaView>
        </View>
      </Modal>

      {/* Create Post Modal */}
      <Modal visible={showCreateModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Post</Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                <Ionicons name="close" size={24} color="#111827" />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 16 }}>
              <TextInput
                style={styles.postInput}
                placeholder="What are you looking for?"
                placeholderTextColor="#9ca3af"
                value={postText}
                onChangeText={setPostText}
                multiline
                numberOfLines={4}
              />

              <Text style={styles.fieldLabel}>Looking For</Text>
              <View style={styles.optionGrid}>
                {LOOKING_FOR_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    style={[styles.optionChip, lookingFor === opt && styles.optionChipActive]}
                    onPress={() => setLookingFor(opt)}
                  >
                    <Text style={[styles.optionChipText, lookingFor === opt && styles.optionChipTextActive]}>
                      {opt}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Sport</Text>
              <View style={styles.optionGrid}>
                {SPORTS.map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.optionChip, postSport === s && styles.optionChipActive]}
                    onPress={() => setPostSport(s)}
                  >
                    <Text style={[styles.optionChipText, postSport === s && styles.optionChipTextActive]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Skill Level</Text>
              <View style={styles.optionGrid}>
                {SKILL_LEVELS.map((lvl) => (
                  <TouchableOpacity
                    key={lvl}
                    style={[styles.optionChip, skillLevel === lvl && { backgroundColor: SKILL_COLORS[lvl], borderColor: SKILL_COLORS[lvl] }]}
                    onPress={() => setSkillLevel(lvl)}
                  >
                    <Text style={[styles.optionChipText, skillLevel === lvl && { color: '#fff' }]}>{lvl}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.twoButtons}>
                <TouchableOpacity
                  style={styles.broadcastBtn}
                  onPress={() => setShowBroadcastModal(true)}
                >
                  <Ionicons name="radio-outline" size={18} color="#16a34a" />
                  <Text style={styles.broadcastBtnText}>Broadcast to Nearby</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.postBtn} onPress={handlePost}>
                  <Ionicons name="send-outline" size={18} color="#fff" />
                  <Text style={styles.postBtnText}>Post to Feed</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>

      {/* Broadcast Modal */}
      <Modal visible={showBroadcastModal} animationType="fade" transparent>
        <View style={styles.centeredOverlay}>
          <View style={styles.alertBox}>
            <Ionicons name="radio" size={40} color="#16a34a" style={{ marginBottom: 12 }} />
            <Text style={styles.alertTitle}>Broadcast Nearby</Text>
            <Text style={styles.alertSub}>Select radius to broadcast your post to nearby players</Text>

            <View style={styles.radiusList}>
              {RADII.map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.radiusItem, broadcastRadius === r && styles.radiusItemActive]}
                  onPress={() => setBroadcastRadius(r)}
                >
                  <Text style={[styles.radiusText, broadcastRadius === r && styles.radiusTextActive]}>{r}</Text>
                  {broadcastRadius === r && <Ionicons name="checkmark-circle" size={18} color="#16a34a" />}
                </TouchableOpacity>
              ))}
            </View>

            {broadcastSent ? (
              <View style={styles.sentRow}>
                <Ionicons name="checkmark-circle" size={20} color="#16a34a" />
                <Text style={styles.sentText}>Broadcast sent!</Text>
              </View>
            ) : (
              <View style={styles.twoButtons}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setShowBroadcastModal(false)}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.postBtn} onPress={handleBroadcast}>
                  <Ionicons name="radio-outline" size={16} color="#fff" />
                  <Text style={styles.postBtnText}>Send Broadcast</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Player Profile Modal */}
      <PlayerProfileModal
        player={selectedPlayer}
        onClose={() => setSelectedPlayer(null)}
        onMessage={() => {
          setSelectedPlayer(null);
          router.push('/messages');
        }}
      />
    </View>
  );
}

function PostCard({
  post,
  liked,
  onLike,
  onAvatarPress,
}: {
  post: Post;
  liked: boolean;
  onLike: () => void;
  onAvatarPress: () => void;
}) {
  return (
    <View style={styles.postCard}>
      <View style={styles.postTop}>
        <TouchableOpacity onPress={onAvatarPress}>
          <View style={[styles.avatar, { backgroundColor: post.avatarColor }]}>
            <Text style={styles.avatarText}>{post.initials}</Text>
          </View>
        </TouchableOpacity>
        <View style={styles.postMeta}>
          <Text style={styles.posterName}>{post.playerName}</Text>
          <Text style={styles.postTime}>{post.time}</Text>
        </View>
        <View style={[styles.lookingBadge]}>
          <Text style={styles.lookingBadgeText}>{post.lookingFor}</Text>
        </View>
      </View>

      <Text style={styles.postText}>{post.text}</Text>

      <View style={styles.tagRow}>
        {post.sports.map((s, i) => (
          <View key={i} style={styles.sportTag}>
            <Text style={styles.sportTagText}>{s.emoji} {s.name}</Text>
            <View style={[styles.skillMini, { backgroundColor: SKILL_COLORS[s.skill] }]}>
              <Text style={styles.skillMiniText}>{s.skill}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.postActions}>
        <TouchableOpacity style={styles.actionBtn} onPress={onLike}>
          <Ionicons name={liked ? 'heart' : 'heart-outline'} size={18} color={liked ? '#ef4444' : '#6b7280'} />
          <Text style={[styles.actionText, liked && { color: '#ef4444' }]}>
            {liked ? post.likes + 1 : post.likes}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn}>
          <Ionicons name="chatbubble-outline" size={18} color="#6b7280" />
          <Text style={styles.actionText}>{post.comments}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn}>
          <Ionicons name="share-social-outline" size={18} color="#6b7280" />
          <Text style={styles.actionText}>Share</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function PlayerCard({
  player,
  distance,
  expanded,
  onExpand,
  onProfile,
  onMessage,
}: {
  player: Player;
  distance: string;
  expanded: boolean;
  onExpand: () => void;
  onProfile: () => void;
  onMessage: () => void;
}) {
  return (
    <TouchableOpacity style={styles.playerCard} onPress={onProfile} activeOpacity={0.85}>
      <View style={styles.playerTop}>
        <View style={[styles.avatar, { backgroundColor: player.avatarColor }]}>
          <Text style={styles.avatarText}>{player.initials}</Text>
        </View>
        <View style={styles.playerInfo}>
          <View style={styles.playerNameRow}>
            <Text style={styles.playerName}>{player.name}</Text>
            <Ionicons
              name={player.gender === 'male' ? 'male' : 'female'}
              size={14}
              color={player.gender === 'male' ? '#3b82f6' : '#ec4899'}
            />
          </View>
          <View style={styles.playerLocRow}>
            <Ionicons name="location-outline" size={12} color="#9ca3af" />
            <Text style={styles.playerLoc}>{player.area} · {distance}</Text>
          </View>
          <Text style={styles.playerBio} numberOfLines={2}>{player.bio}</Text>
        </View>
      </View>

      <View style={styles.playerSports}>
        {player.sports.map((s, i) => (
          <View key={i} style={styles.sportTag}>
            <Text style={styles.sportTagText}>{s.emoji} {s.name}</Text>
            <View style={[styles.skillMini, { backgroundColor: SKILL_COLORS[s.skill] }]}>
              <Text style={styles.skillMiniText}>{s.skill}</Text>
            </View>
          </View>
        ))}
      </View>

      {!expanded ? (
        <TouchableOpacity style={styles.connectBtn} onPress={onExpand}>
          <Ionicons name="person-add-outline" size={16} color="#fff" />
          <Text style={styles.connectBtnText}>Connect</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.expandedActions}>
          <TouchableOpacity style={styles.expandBtn} onPress={onMessage}>
            <Ionicons name="chatbubble-outline" size={16} color="#16a34a" />
            <Text style={styles.expandBtnText}>Message</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.expandBtn}>
            <Ionicons name="mail-outline" size={16} color="#16a34a" />
            <Text style={styles.expandBtnText}>Invite</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.expandBtn}>
            <Ionicons name="people-outline" size={16} color="#16a34a" />
            <Text style={styles.expandBtnText}>Create</Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f3f4f6' },
  safeHeader: { overflow: 'hidden' },
  headerBg: { width: '100%' },
  headerOverlay: { backgroundColor: 'rgba(0,0,0,0.40)' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 8 : 4,
    paddingBottom: 8,
  },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: '800' },
  statsRow: { flexDirection: 'row', gap: 10, padding: 12, paddingTop: 4 },
  statCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  statText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  feed: { flex: 1 },
  feedContent: { padding: 12, gap: 12, paddingBottom: 80 },
  fab: {
    position: 'absolute',
    bottom: 80,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  fabImage: { width: 56, height: 56 },
  fabOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  postCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  postTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  postMeta: { flex: 1 },
  posterName: { fontWeight: '700', color: '#111827', fontSize: 15 },
  postTime: { color: '#9ca3af', fontSize: 12, marginTop: 1 },
  lookingBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  lookingBadgeText: { color: '#16a34a', fontSize: 11, fontWeight: '600' },
  postText: { color: '#374151', fontSize: 14, lineHeight: 22, marginBottom: 10 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
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
  skillMini: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  skillMiniText: { color: '#fff', fontSize: 10, fontWeight: '600' },
  postActions: { flexDirection: 'row', gap: 16, borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingTop: 10 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionText: { color: '#6b7280', fontSize: 13 },
  // Modal styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContainer: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    margin: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#111827' },
  pillRow: { paddingHorizontal: 12, marginBottom: 4 },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  pillActive: { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  pillText: { color: '#6b7280', fontSize: 13, fontWeight: '500' },
  pillTextActive: { color: '#fff' },
  playerCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  playerTop: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  playerInfo: { flex: 1 },
  playerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  playerName: { fontWeight: '700', color: '#111827', fontSize: 15 },
  playerLocRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  playerLoc: { color: '#9ca3af', fontSize: 12 },
  playerBio: { color: '#6b7280', fontSize: 12, marginTop: 4, lineHeight: 18 },
  playerSports: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  connectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#16a34a',
    paddingVertical: 8,
    borderRadius: 8,
  },
  connectBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  expandedActions: { flexDirection: 'row', gap: 8 },
  expandBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#16a34a',
    paddingVertical: 8,
    borderRadius: 8,
  },
  expandBtnText: { color: '#16a34a', fontWeight: '600', fontSize: 13 },
  // Create Post
  postInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: '#111827',
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  fieldLabel: { fontWeight: '700', color: '#111827', marginBottom: 8, fontSize: 14 },
  optionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  optionChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  optionChipActive: { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  optionChipText: { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  optionChipTextActive: { color: '#fff' },
  twoButtons: { flexDirection: 'row', gap: 10, marginTop: 8 },
  broadcastBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: '#16a34a',
    paddingVertical: 12,
    borderRadius: 10,
  },
  broadcastBtnText: { color: '#16a34a', fontWeight: '600', fontSize: 14 },
  postBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#16a34a',
    paddingVertical: 12,
    borderRadius: 10,
  },
  postBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  cancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingVertical: 12,
    borderRadius: 10,
  },
  cancelBtnText: { color: '#6b7280', fontWeight: '600' },
  centeredOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  alertBox: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '85%',
    alignItems: 'center',
  },
  alertTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 6 },
  alertSub: { fontSize: 13, color: '#6b7280', textAlign: 'center', marginBottom: 20 },
  radiusList: { width: '100%', gap: 8, marginBottom: 20 },
  radiusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  radiusItemActive: { borderColor: '#16a34a', backgroundColor: '#f0fdf4' },
  radiusText: { color: '#374151', fontSize: 14 },
  radiusTextActive: { color: '#16a34a', fontWeight: '700' },
  sentRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sentText: { color: '#16a34a', fontWeight: '700', fontSize: 15 },
  radiusBar: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  radiusBarContent: { paddingHorizontal: 12, paddingVertical: 8, gap: 8, flexDirection: 'row' },
  radiusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  radiusPillActive: { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  radiusPillText: { fontSize: 13, color: '#374151', fontWeight: '500' },
  radiusPillTextActive: { color: '#fff' },
  pillDivider: { height: 1, backgroundColor: '#f3f4f6', marginHorizontal: 12 },
});
