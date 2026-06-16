import React, { useState, useEffect, useCallback } from 'react';
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
  Image,
  Platform,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useVideoPlayer, VideoView } from 'expo-video';
import { PLAYERS, POSTS, playerDistanceKm, type Player, type Post } from '../../data/mockData';
import { formatDistance } from '../../utils/geo';
import { useUserLocation } from '../../hooks/useUserLocation';
import PlayerProfileModal from '../../components/PlayerProfileModal';
import NotifBell from '../../components/NotifBell';
import RadiusSlider from '../../components/RadiusSlider';
import { useAuth } from '../../lib/AuthContext';
import { fetchPosts, createPost, toggleLike, fetchLikedPostIds, uploadPostMedia } from '../../lib/posts';
import { fetchPlayers } from '../../lib/players';
import { getOrCreateConversation } from '../../lib/chatService';

// ─── Quick-strip feature flag — set to false to roll back instantly ───────────
const SHOW_QUICK_STRIP = true;

const QUICK_ACTIONS = [
  { key: 'match', icon: 'football-outline', label: 'Organize Match' },
  { key: 'book',  icon: 'calendar-outline',  label: 'Book Venue'    },
  { key: 'earn',  icon: 'trophy-outline',    label: 'Tournaments'   },
] as const;
// ─────────────────────────────────────────────────────────────────────────────

const FIELD_IMAGE = 'https://image.pollinations.ai/prompt/close%20up%20ground%20level%20shot%20real%20football%20pitch%20grass%20sharp%20green%20grass%20blades%20foreground%20white%20painted%20center%20circle%20line%20shallow%20depth%20of%20field%20bokeh%20golden%20hour%20lighting%20photorealistic%20ultra%20detailed%20grass%20texture%20dew%20drops%20cinematic%20dark%20moody%20tone%20portrait%20no%20people?width=1080&height=1920&seed=42&nologo=true&model=flux';

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
const PLAYER_RADIUS_MAX = 20;

export default function HoodScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { location } = useUserLocation();
  const [playerRadius, setPlayerRadius] = useState(5);
  const [players, setPlayers] = useState<Player[]>(PLAYERS);
  const [refreshing, setRefreshing] = useState(false);

  const nearbyCount = location
    ? players.filter((p) => playerDistanceKm(location, p) <= playerRadius).length
    : players.length;
  const lookingCount = location
    ? players.filter((p) => p.privacy === 'public' && playerDistanceKm(location, p) <= playerRadius).length
    : players.filter((p) => p.privacy === 'public').length;

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
  const [posting, setPosting] = useState(false);
  const [pickedMedia, setPickedMedia] = useState<{ uri: string; type: 'image' | 'video'; mimeType?: string } | null>(null);

  const allSports = ['All', ...SPORTS];

  const loadData = useCallback(async () => {
    const [dbPosts, dbPlayers, liked] = await Promise.all([
      fetchPosts(),
      fetchPlayers(),
      user ? fetchLikedPostIds(user.id) : Promise.resolve(new Set<string>()),
    ]);
    setPosts(dbPosts);
    setPlayers(dbPlayers);
    setLikedPosts(liked);
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const filteredPlayers = players.filter((p) => {
    const matchSearch =
      playerSearch === '' ||
      p.name.toLowerCase().includes(playerSearch.toLowerCase()) ||
      p.area.toLowerCase().includes(playerSearch.toLowerCase());
    const matchSport =
      sportFilter === 'All' || p.sports.some((s) => s.name === sportFilter);
    const matchRadius = !location || playerDistanceKm(location, p) <= playerRadius;
    return matchSearch && matchSport && matchRadius;
  });

  const handleToggleLike = async (postId: string, authorId: string) => {
    // Prevent self-likes
    if (user && user.id === authorId) return;

    const isLiked = likedPosts.has(postId);

    // Optimistic UI: update liked set and count immediately
    setLikedPosts((prev) => {
      const next = new Set(prev);
      isLiked ? next.delete(postId) : next.add(postId);
      return next;
    });
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, likes: Math.max(0, p.likes + (isLiked ? -1 : 1)) }
          : p
      )
    );

    if (user) {
      await toggleLike(postId, user.id, isLiked);
    }
  };

  const handleMessage = async (target: { id: string; name: string; initials: string; avatarColor: string }) => {
    if (!user) { router.push('/messages'); return; }
    if (target.id === user.id) return;

    const convId = await getOrCreateConversation(user.id, target.id);
    if (convId) {
      router.push({
        pathname: '/chat',
        params: { id: convId, name: target.name, initials: target.initials, color: target.avatarColor },
      });
    }
  };

  const pickMedia = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: false,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setPickedMedia({
        uri: asset.uri,
        type: asset.type === 'video' ? 'video' : 'image',
        mimeType: asset.mimeType ?? undefined,
      });
    }
  };

  const handlePost = async () => {
    setPosting(true);
    const userName = user?.user_metadata?.full_name ?? user?.email?.split('@')[0] ?? 'You';
    const userInitials = userName.slice(0, 2).toUpperCase();
    const userColor = '#16a34a';

    let mediaUrl: string | undefined;
    let mediaType: 'image' | 'video' | undefined;
    if (pickedMedia && user) {
      const uploaded = await uploadPostMedia(user.id, pickedMedia.uri, pickedMedia.type, pickedMedia.mimeType);
      if (uploaded) { mediaUrl = uploaded; mediaType = pickedMedia.type; }
    }

    const saved = await createPost({
      userId: user?.id ?? null,
      userName,
      userInitials,
      userColor,
      text: postText || 'Looking to play!',
      lookingFor,
      sports: [{ name: postSport, skill: skillLevel, emoji: '' }],
      mediaUrl,
      mediaType,
    });

    const newPost: Post = saved ?? {
      id: String(Date.now()),
      playerId: user?.id ?? 'me',
      playerName: userName,
      initials: userInitials,
      avatarColor: userColor,
      time: 'Just now',
      text: postText || 'Looking to play!',
      sports: [{ name: postSport, skill: skillLevel, emoji: '' }],
      lookingFor,
      likes: 0,
      comments: 0,
      mediaUrl,
      mediaType,
    };
    setPosts((prev) => [newPost, ...prev]);
    setPosting(false);
    setShowCreateModal(false);
    setPostText('');
    setPickedMedia(null);
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
    <ImageBackground source={{ uri: FIELD_IMAGE }} style={styles.root} resizeMode="cover">
      <View style={styles.bgOverlay} pointerEvents="none" />
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <View style={styles.safeHeader}>
        <View style={styles.headerBg}>
          <View style={styles.headerOverlay}>
            <SafeAreaView edges={['top']}>
              <View style={styles.header}>
                <Text style={styles.headerTitle}>The Hood</Text>
                <View style={styles.headerIcons}>
                  <NotifBell />
                  <TouchableOpacity onPress={() => router.push('/messages')}>
                    <Ionicons name="chatbubbles-outline" size={24} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.statsRow}>
                <TouchableOpacity style={styles.statCard} onPress={() => setShowPlayersModal(true)}>
                  <Ionicons name="people" size={18} color="#fff" />
                  <Text style={styles.statText}>{nearbyCount} Near You</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.statCard} onPress={() => router.push('/looking-now')}>
                  <Ionicons name="search" size={18} color="#fff" />
                  <Text style={styles.statText}>{lookingCount} Looking</Text>
                </TouchableOpacity>
              </View>

              {SHOW_QUICK_STRIP && (
                <View style={styles.quickStripRow}>
                  {QUICK_ACTIONS.map(({ key, icon, label }) => (
                    <TouchableOpacity
                      key={key}
                      style={styles.quickBtn}
                      onPress={() => {
                        if (key === 'match') { router.push('/(tabs)/myturf?action=createMatch'); }
                        else if (key === 'book') { router.push('/(tabs)/book'); }
                        else if (key === 'earn') { router.push('/(tabs)/earn'); }
                      }}
                    >
                      <Ionicons name={icon as any} size={15} color="#fff" />
                      <Text style={styles.quickBtnLabel}>{label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </SafeAreaView>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.feed}
        contentContainerStyle={styles.feedContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#16a34a" />}
      >
        {posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            liked={likedPosts.has(post.id)}
            isSelf={user?.id === post.playerId}
            onLike={() => handleToggleLike(post.id, post.playerId)}
            onAvatarPress={() => {
              // Use the cached player if IDs already match (DB → DB).
              // If players is still mock data (IDs '1'–'6') but posts carry
              // real UUIDs, build a minimal Player from the post so the modal
              // can open and fetch real sports/stats from Supabase.
              const p =
                players.find((pl) => pl.id === post.playerId) ?? {
                  id: post.playerId,
                  name: post.playerName,
                  initials: post.initials,
                  avatarColor: post.avatarColor,
                  gender: 'male' as const,
                  area: '',
                  distance: '',
                  bio: '',
                  sports: post.sports ?? [],
                  privacy: 'public' as const,
                  joinDate: '',
                  stats: { matches: 0, wins: 0, rank: 'Bronze' },
                  offsetKm: { dx: 0, dy: 0 },
                };
              setSelectedPlayer(p);
            }}
            onMessage={() =>
              handleMessage({
                id: post.playerId,
                name: post.playerName,
                initials: post.initials,
                avatarColor: post.avatarColor,
              })
            }
            onComment={() =>
              router.push({
                pathname: '/comments',
                params: { postId: post.id, postAuthor: post.playerName },
              })
            }
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
          <SafeAreaView style={styles.modalContainer} edges={['bottom']}>
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

            {/* Distance slider */}
            <View style={styles.sliderRow}>
              <Text style={styles.sliderLabel}>Distance</Text>
              <RadiusSlider
                value={playerRadius}
                minimumValue={1}
                maximumValue={PLAYER_RADIUS_MAX}
                step={1}
                onValueChange={(v) => setPlayerRadius(Math.round(v))}
                style={styles.sliderTrack}
              />
              <Text style={styles.sliderValue}>{playerRadius} km</Text>
            </View>

            {/* Sport filter */}
            <View style={styles.sportFilterRow}>
              {allSports.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.sportChip, sportFilter === s && styles.sportChipActive]}
                  onPress={() => setSportFilter(s)}
                >
                  <Text style={[styles.sportChipText, sportFilter === s && styles.sportChipTextActive]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <FlatList
              data={filteredPlayers}
              keyExtractor={(item) => item.id}
              style={{ flex: 1 }}
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
                    handleMessage({
                      id: item.id,
                      name: item.name,
                      initials: item.initials,
                      avatarColor: item.avatarColor,
                    });
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
          <SafeAreaView style={styles.modalContainer} edges={['bottom']}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Post</Text>
              <TouchableOpacity onPress={() => { setShowCreateModal(false); setPickedMedia(null); }}>
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

              {/* Media picker */}
              {pickedMedia ? (
                <View style={styles.mediaPreviewBox}>
                  {pickedMedia.type === 'image' ? (
                    <Image source={{ uri: pickedMedia.uri }} style={styles.mediaPreview} resizeMode="cover" />
                  ) : (
                    <PickedVideoPreview uri={pickedMedia.uri} />
                  )}
                  <TouchableOpacity style={styles.mediaRemoveBtn} onPress={() => setPickedMedia(null)}>
                    <Ionicons name="close-circle" size={22} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.mediaPickerBtn} onPress={pickMedia}>
                  <Ionicons name="image-outline" size={20} color="#6b7280" />
                  <Text style={styles.mediaPickerText}>Add Photo / Video</Text>
                </TouchableOpacity>
              )}

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
                <TouchableOpacity style={styles.postBtn} onPress={handlePost} disabled={posting}>
                  {posting
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <><Ionicons name="send-outline" size={18} color="#fff" /><Text style={styles.postBtnText}>Post to Feed</Text></>}
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
        onMessage={(player) => {
          setSelectedPlayer(null);
          handleMessage({
            id: player.id,
            name: player.name,
            initials: player.initials,
            avatarColor: player.avatarColor,
          });
        }}
      />
    </ImageBackground>
  );
}

function PostVideoPlayer({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => { p.loop = true; });
  return (
    <VideoView
      player={player}
      style={styles.postMedia}
      contentFit="cover"
      nativeControls
    />
  );
}

function PickedVideoPreview({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => { p.loop = false; });
  return (
    <VideoView
      player={player}
      style={styles.mediaPreview}
      contentFit="cover"
      nativeControls
    />
  );
}

function PostCard({
  post,
  liked,
  isSelf,
  onLike,
  onAvatarPress,
  onMessage,
  onComment,
}: {
  post: Post;
  liked: boolean;
  isSelf: boolean;
  onLike: () => void;
  onAvatarPress: () => void;
  onMessage: () => void;
  onComment: () => void;
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
          <Text style={styles.posterName}>{post.playerName}{isSelf ? ' (You)' : ''}</Text>
          <Text style={styles.postTime}>{post.time}</Text>
        </View>
        <View style={styles.lookingBadge}>
          <Text style={styles.lookingBadgeText}>{post.lookingFor}</Text>
        </View>
      </View>

      <Text style={styles.postText}>{post.text}</Text>

      {/* Media */}
      {post.mediaUrl && post.mediaType === 'image' && (
        <Image source={{ uri: post.mediaUrl }} style={styles.postMedia} resizeMode="cover" />
      )}
      {post.mediaUrl && post.mediaType === 'video' && (
        <PostVideoPlayer uri={post.mediaUrl} />
      )}

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
        {/* Instagram like mechanic: visible on all posts, tappable only on others' */}
        {isSelf ? (
          <View style={styles.actionBtn}>
            <Ionicons
              name={post.likes > 0 ? 'heart' : 'heart-outline'}
              size={18}
              color={post.likes > 0 ? '#ef4444' : '#d1d5db'}
            />
            <Text style={[styles.actionText, { color: post.likes > 0 ? '#ef4444' : '#d1d5db' }]}>
              {post.likes}
            </Text>
          </View>
        ) : (
          <TouchableOpacity style={styles.actionBtn} onPress={onLike}>
            <Ionicons name={liked ? 'heart' : 'heart-outline'} size={18} color={liked ? '#ef4444' : '#6b7280'} />
            <Text style={[styles.actionText, liked && { color: '#ef4444' }]}>{post.likes}</Text>
          </TouchableOpacity>
        )}

        {/* Comment button — all posts */}
        <TouchableOpacity style={styles.actionBtn} onPress={onComment}>
          <Ionicons name="chatbubble-outline" size={18} color="#6b7280" />
          <Text style={styles.actionText}>{post.comments}</Text>
        </TouchableOpacity>

        {/* Message — only others' posts */}
        {!isSelf ? (
          <TouchableOpacity style={styles.actionBtn} onPress={onMessage}>
            <Ionicons name="paper-plane-outline" size={18} color="#16a34a" />
            <Text style={[styles.actionText, { color: '#16a34a' }]}>Message</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.actionBtn}>
            <Ionicons name="share-social-outline" size={18} color="#6b7280" />
            <Text style={styles.actionText}>Share</Text>
          </TouchableOpacity>
        )}
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
  root: { flex: 1 },
  bgOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,10,2,0.38)' },
  safeHeader: { overflow: 'hidden' },
  headerBg: { width: '100%' },
  headerOverlay: { backgroundColor: 'rgba(0,0,0,0.18)' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 8 : 4,
    paddingBottom: 8,
  },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: '800' },
  headerIcons: { flexDirection: 'row', alignItems: 'center', gap: 16 },
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
  quickStripRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 14,
    gap: 8,
  },
  quickBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.38)',
    borderRadius: 22,
    paddingVertical: 10,
  },
  quickBtnLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
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
    backgroundColor: 'rgba(255,255,255,0.93)',
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
  postMedia: { width: '100%', height: 200, borderRadius: 10, marginBottom: 10 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  mediaPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    borderStyle: 'dashed',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 14,
    backgroundColor: '#f9fafb',
  },
  mediaPickerText: { color: '#6b7280', fontSize: 14 },
  mediaPreviewBox: { position: 'relative', marginBottom: 14 },
  mediaPreview: { width: '100%', height: 180, borderRadius: 10 },
  mediaRemoveBtn: { position: 'absolute', top: 6, right: 6 },
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
  modalContainer: { backgroundColor: 'rgba(255,255,255,0.97)', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%', flex: 1 },
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
    gap: 6,
    marginHorizontal: 12,
    marginVertical: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
  },
  searchInput: { flex: 1, fontSize: 13, color: '#111827' },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 2,
    gap: 8,
  },
  sliderLabel: { fontSize: 11, color: '#6b7280', fontWeight: '500', width: 52 },
  sliderTrack: { flex: 1 },
  sliderValue: { fontSize: 11, color: '#111827', fontWeight: '700', width: 34, textAlign: 'right' },
  sportFilterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  sportChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  sportChipActive: { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  sportChipText: { fontSize: 11, color: '#6b7280', fontWeight: '500' },
  sportChipTextActive: { color: '#fff', fontWeight: '600' },
  playerCard: {
    backgroundColor: 'rgba(255,255,255,0.93)',
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
});
