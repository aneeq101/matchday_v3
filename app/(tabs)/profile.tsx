import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Switch,
  ImageBackground,
  Image,
  StatusBar,
  Platform,
  Alert,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../lib/AuthContext';
import { fetchMySports, addSport, removeSport, fetchPlayerStats, upsertSportStats, type ProfileSport, type PlayerStat } from '../../lib/profile';
import { fetchFollowCounts } from '../../lib/follows';
import { fetchSettings, saveSettings } from '../../lib/settings';
import NotifBell from '../../components/NotifBell';
import { SPORT_STAT_FIELDS } from '../../lib/sportStats';

const FIELD_IMAGE = 'https://image.pollinations.ai/prompt/close%20up%20ground%20level%20shot%20real%20football%20pitch%20grass%20sharp%20green%20grass%20blades%20foreground%20white%20painted%20center%20circle%20line%20shallow%20depth%20of%20field%20bokeh%20golden%20hour%20lighting%20photorealistic%20ultra%20detailed%20grass%20texture%20dew%20drops%20cinematic%20dark%20moody%20tone%20portrait%20no%20people?width=1080&height=1920&seed=42&nologo=true&model=flux';
import { useRouter, useFocusEffect } from 'expo-router';
import SportDetailsEditor from '../../components/SportDetailsEditor';
import AskRatingsModal from '../../components/AskRatingsModal';
import { fetchVerifiedRecord, type VerifiedRecord } from '../../lib/history';
import { summarizeDetails } from '../../lib/sportProfile';

const SKILL_COLORS: Record<string, string> = {
  Beginner: '#3b82f6',
  Intermediate: '#f59e0b',
  Advanced: '#ef4444',
};

const SPORT_EMOJIS: Record<string, string> = {
  Football: '⚽', Cricket: '🏏', Tennis: '🎾',
  Basketball: '🏀', Hockey: '🏑', Badminton: '🏸', Baseball: '⚾',
};

export default function ProfileScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();

  // Google puts name in full_name; email signup puts it in name
  const displayName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split('@')[0] ||
    'User';

  const avatarUrl: string | undefined =
    user?.user_metadata?.avatar_url || user?.user_metadata?.picture;

  const initials = displayName
    .split(' ')
    .map((w: string) => w[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const [showVisibilityModal, setShowVisibilityModal] = useState(false);
  const [showMessagesFromModal, setShowMessagesFromModal] = useState(false);
  const [profileVisibility, setProfileVisibility] = useState<'Public' | 'Friends Only'>('Public');
  const [allowMessages, setAllowMessages] = useState(true);
  const [messagesFrom, setMessagesFrom] = useState({ male: true, female: true, undisclosed: true });
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const [followCounts, setFollowCounts] = useState({ followers: 0, following: 0 });

  // Sports & stats
  const [mySports, setMySports] = useState<ProfileSport[]>([]);
  const [playerStats, setPlayerStats] = useState<PlayerStat[]>([]);
  // Wins / losses from results recorded in the app (challenges, events, pickup games)
  const [verified, setVerified] = useState<VerifiedRecord[]>([]);
  const [selectedStatSport, setSelectedStatSport] = useState('');
  const [showAddSport, setShowAddSport] = useState(false);
  const [addingSport, setAddingSport] = useState(false);
  const [newSport, setNewSport] = useState('Football');
  const [newSkill, setNewSkill] = useState<'Beginner' | 'Intermediate' | 'Advanced'>('Intermediate');
  const [newDetails, setNewDetails] = useState<Record<string, string>>({});
  const [editingSport, setEditingSport] = useState(false);   // sheet opened by tapping an existing sport
  const [askSport, setAskSport] = useState<string | null>(null);

  // Record Stats modal
  const [showRecordStats, setShowRecordStats] = useState(false);
  const [recordingSport, setRecordingSport] = useState('');
  const [recordMatches, setRecordMatches] = useState('0');
  const [recordWins, setRecordWins] = useState('0');
  const [recordLosses, setRecordLosses] = useState('0');
  const [recordDraws, setRecordDraws] = useState('0');
  const [recordSportStats, setRecordSportStats] = useState<Record<string, string>>({});
  const [savingStats, setSavingStats] = useState(false);

  const loadKey = useRef(0);

  const loadProfile = useCallback(async () => {
    if (!user) return;
    const key = ++loadKey.current;

    const [sports, stats, counts, settings] = await Promise.all([
      fetchMySports(user.id),
      fetchPlayerStats(user.id),
      fetchFollowCounts(user.id),
      fetchSettings(user.id),
    ]);

    // Discard result if a newer loadProfile call has already started
    if (key !== loadKey.current) return;

    setProfileVisibility(settings.privacy === 'private' ? 'Friends Only' : 'Public');
    setAllowMessages(settings.allowMessages);
    setMessagesFrom(settings.messagesFrom);

    setFollowCounts(counts);
    setMySports(sports);

    // Only show stats for sports the user has explicitly added to their profile
    const mySportNames = new Set(sports.map((s) => s.name));
    const filteredStats = stats.filter((s) => mySportNames.has(s.sport));
    setPlayerStats(filteredStats);

    // Set selected tab to first sport (only if nothing is selected or selection no longer exists)
    if (sports.length > 0) {
      setSelectedStatSport((prev) => (prev && mySportNames.has(prev) ? prev : sports[0].name));
    } else {
      setSelectedStatSport('');
    }
  }, [user]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  // Sports can be added from the welcome flow, and results get recorded elsewhere —
  // refresh the sports list and the verified record on focus
  useFocusEffect(useCallback(() => {
    if (!user) return;
    let stale = false;
    fetchMySports(user.id).then((sp) => { if (!stale && sp.length) setMySports(sp); });
    fetchVerifiedRecord(user.id).then((v) => { if (!stale) setVerified(v); });
    return () => { stale = true; };
  }, [user?.id]));

  const openAddSport = () => {
    const taken = new Set(mySports.map((s) => s.name));
    setNewSport(Object.keys(SPORT_EMOJIS).find((s) => !taken.has(s)) ?? 'Football');
    setNewSkill('Intermediate');
    setNewDetails({});
    setEditingSport(false);
    setShowAddSport(true);
  };

  const openEditSport = (s: ProfileSport) => {
    setNewSport(s.name);
    setNewSkill(s.skill);
    setNewDetails({ ...s.details });
    setEditingSport(true);
    setShowAddSport(true);
  };

  const handleAddSport = async () => {
    if (!user) return;
    setAddingSport(true);
    const result = await addSport({
      userId: user.id,
      sport: newSport,
      skill: newSkill,
      emoji: SPORT_EMOJIS[newSport] ?? '🏆',
      details: newDetails,
    });
    setAddingSport(false);
    if (!result) {
      Alert.alert('Error', 'Could not save sport. Please try again.');
      return;
    }
    // Show sport immediately — addSport always returns non-null when INSERT succeeds
    setMySports((prev) => {
      const filtered = prev.filter((s) => s.name !== result.name);
      return [...filtered, result];
    });
    setSelectedStatSport(result.name);
    setShowAddSport(false);
    setNewDetails({});
  };

  const handleRemoveSport = (sport: ProfileSport) => {
    Alert.alert('Remove Sport', `Remove ${sport.name} from your profile?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          setMySports((prev) => prev.filter((s) => s.id !== sport.id));
          setPlayerStats((prev) => prev.filter((s) => s.sport !== sport.name));
          setSelectedStatSport((prev) => (prev === sport.name ? '' : prev));
          await removeSport(sport.id);
        },
      },
    ]);
  };

  const openRecordStats = (sport: string) => {
    const existing = playerStats.find((s) => s.sport === sport);
    setRecordingSport(sport);
    setRecordMatches(String(existing?.matches ?? 0));
    setRecordWins(String(existing?.wins ?? 0));
    setRecordLosses(String(existing?.losses ?? 0));
    setRecordDraws(String(existing?.draws ?? 0));
    const statsStr: Record<string, string> = {};
    Object.entries(existing?.sportStats ?? {}).forEach(([k, v]) => { statsStr[k] = String(v); });
    setRecordSportStats(statsStr);
    setShowRecordStats(true);
  };

  const handleSaveStats = async () => {
    if (!user) return;
    setSavingStats(true);
    const matches = Math.max(0, parseInt(recordMatches) || 0);
    const wins    = Math.max(0, parseInt(recordWins)    || 0);
    const losses  = Math.max(0, parseInt(recordLosses)  || 0);
    const draws   = Math.max(0, parseInt(recordDraws)   || 0);

    const sportStats: Record<string, string | number> = {};
    Object.entries(recordSportStats).forEach(([k, v]) => {
      if (!v.trim()) return;
      const n = parseFloat(v);
      sportStats[k] = isNaN(n) ? v : n;
    });

    const ok = await upsertSportStats({ userId: user.id, sport: recordingSport, matches, wins, losses, draws, sportStats });
    setSavingStats(false);
    if (!ok) { Alert.alert('Error', 'Could not save stats. Please try again.'); return; }

    setPlayerStats((prev) => {
      const updated: PlayerStat = { sport: recordingSport, matches, wins, losses, draws, sportStats };
      const idx = prev.findIndex((s) => s.sport === recordingSport);
      if (idx >= 0) { const next = [...prev]; next[idx] = updated; return next; }
      return [...prev, updated];
    });
    setShowRecordStats(false);
  };

  const toggleGender = (key: keyof typeof messagesFrom) => {
    setMessagesFrom((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Privacy settings are saved to the profile; the server enforces them
  // (who can see the profile, who can start a chat).
  const persist = async (patch: Parameters<typeof saveSettings>[1]) => {
    if (!user) return;
    const ok = await saveSettings(user.id, patch);
    if (!ok) Alert.alert('Not saved', 'Could not save your setting. Please check your connection and try again.');
  };

  const changeVisibility = (opt: 'Public' | 'Friends Only') => {
    setProfileVisibility(opt);
    setShowVisibilityModal(false);
    persist({ privacy: opt === 'Friends Only' ? 'private' : 'public' });
  };

  const changeAllowMessages = (v: boolean) => {
    setAllowMessages(v);
    persist({ allowMessages: v });
  };

  const saveMessagesFrom = () => {
    setShowMessagesFromModal(false);
    persist({ messagesFrom });
  };

  const messagesFromLabel = () => {
    const selected = Object.entries(messagesFrom)
      .filter(([, v]) => v)
      .map(([k]) => k.charAt(0).toUpperCase() + k.slice(1));
    return selected.length === 3 ? 'Everyone' : selected.join(', ') || 'Nobody';
  };

  return (
    <ImageBackground source={{ uri: FIELD_IMAGE }} style={styles.root} resizeMode="cover">
      <View style={styles.bgOverlay} pointerEvents="none" />
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.profileHeader}>
          <View style={styles.profileHeaderOverlay}>
          <SafeAreaView edges={['top']}>
            <View style={styles.headerTop}>
              <Text style={styles.headerTitle}>Profile</Text>
              <View style={styles.headerIcons}>
                <NotifBell />
                <TouchableOpacity onPress={() => router.push('/messages')}>
                  <Ionicons name="chatbubbles-outline" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.avatarSection}>
              <View style={styles.avatarCircle}>
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
                ) : (
                  <Text style={styles.avatarInitials}>{initials}</Text>
                )}
              </View>
              <Text style={styles.profileName}>{displayName}</Text>
              <View style={styles.locationRow}>
                <Ionicons name="mail-outline" size={14} color="rgba(255,255,255,0.8)" />
                <Text style={styles.profileLocation}>{user?.email ?? ''}</Text>
              </View>
            </View>
          </SafeAreaView>
          </View>
        </View>

        {/* Stats Card */}
        {(() => {
          const totalMatches = playerStats.reduce((s, p) => s + p.matches, 0) + verified.reduce((s, v) => s + v.played, 0);
          const totalWins    = playerStats.reduce((s, p) => s + p.wins, 0) + verified.reduce((s, v) => s + v.wins, 0);
          const winRate      = totalMatches > 0 ? Math.round((totalWins / totalMatches) * 100) : 0;
          return (
            <View style={styles.statsCard}>
              <TouchableOpacity style={styles.statItem} onPress={() => router.push({ pathname: '/followers', params: { tab: 'followers' } })}>
                <Text style={styles.statNum}>{followCounts.followers}</Text>
                <Text style={styles.statLbl}>Followers</Text>
              </TouchableOpacity>
              <View style={styles.statDivider} />
              <TouchableOpacity style={styles.statItem} onPress={() => router.push({ pathname: '/followers', params: { tab: 'following' } })}>
                <Text style={styles.statNum}>{followCounts.following}</Text>
                <Text style={styles.statLbl}>Following</Text>
              </TouchableOpacity>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={[styles.statNum, totalMatches > 0 && { color: '#16a34a' }]}>
                  {totalMatches > 0 ? `${winRate}%` : '—'}
                </Text>
                <Text style={styles.statLbl}>Win Rate</Text>
              </View>
            </View>
          );
        })()}

        {/* Player Stats — manual stats + verified results from recorded games */}
        {(() => {
          const manualStat = playerStats.find((s) => s.sport === selectedStatSport);
          const ver = verified.find((v) => v.sport === selectedStatSport);
          const currentStat: PlayerStat | undefined = manualStat || ver ? {
            sport: selectedStatSport,
            matches: (manualStat?.matches ?? 0) + (ver?.played ?? 0),
            wins: (manualStat?.wins ?? 0) + (ver?.wins ?? 0),
            losses: (manualStat?.losses ?? 0) + (ver?.losses ?? 0),
            draws: (manualStat?.draws ?? 0) + (ver?.draws ?? 0),
            sportStats: manualStat?.sportStats ?? {},
          } : undefined;
          const winRate = currentStat && currentStat.matches > 0
            ? Math.round((currentStat.wins / currentStat.matches) * 100) : 0;
          return (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Player Stats</Text>
              {mySports.length === 0 ? (
                <View style={styles.emptyStatsCard}>
                  <Ionicons name="stats-chart-outline" size={36} color="#d1d5db" />
                  <Text style={styles.emptyStatsText}>Add a sport above to track your stats</Text>
                </View>
              ) : (
                <>
                  {/* Sport tabs — driven by mySports, not playerStats */}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}
                    style={{ marginBottom: 12 }} contentContainerStyle={{ gap: 8, flexDirection: 'row' }}>
                    {mySports.map((s) => (
                      <TouchableOpacity
                        key={s.id}
                        style={[styles.statSportTab, selectedStatSport === s.name && styles.statSportTabActive]}
                        onPress={() => setSelectedStatSport(s.name)}
                      >
                        <Text style={styles.statSportTabEmoji}>{s.emoji || SPORT_EMOJIS[s.name] || '🏆'}</Text>
                        <Text style={[styles.statSportTabText, selectedStatSport === s.name && styles.statSportTabTextActive]}>
                          {s.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  {!currentStat ? (
                    /* No stats recorded yet for this sport */
                    <TouchableOpacity style={styles.recordStatsPrompt} onPress={() => openRecordStats(selectedStatSport)}>
                      <Ionicons name="add-circle-outline" size={22} color="#16a34a" />
                      <Text style={styles.recordStatsPromptText}>Record your {selectedStatSport} stats</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.statsDetailCard}>
                      {/* Card header with Edit button */}
                      <View style={styles.statsCardHeader}>
                        <Text style={styles.statsCardTitle}>{selectedStatSport} Stats</Text>
                        <TouchableOpacity style={styles.editStatsBtn} onPress={() => openRecordStats(selectedStatSport)}>
                          <Ionicons name="create-outline" size={15} color="#16a34a" />
                          <Text style={styles.editStatsBtnText}>Edit</Text>
                        </TouchableOpacity>
                      </View>

                      {/* W / L / D / Played */}
                      <View style={styles.wldRow}>
                        <View style={styles.wldItem}>
                          <Text style={[styles.wldNum, { color: '#16a34a' }]}>{currentStat.wins}</Text>
                          <Text style={styles.wldLbl}>Won</Text>
                        </View>
                        <View style={styles.wldDivider} />
                        <View style={styles.wldItem}>
                          <Text style={[styles.wldNum, { color: '#ef4444' }]}>{currentStat.losses}</Text>
                          <Text style={styles.wldLbl}>Lost</Text>
                        </View>
                        {currentStat.draws > 0 && <>
                          <View style={styles.wldDivider} />
                          <View style={styles.wldItem}>
                            <Text style={[styles.wldNum, { color: '#f59e0b' }]}>{currentStat.draws}</Text>
                            <Text style={styles.wldLbl}>Draw</Text>
                          </View>
                        </>}
                        <View style={styles.wldDivider} />
                        <View style={styles.wldItem}>
                          <Text style={styles.wldNum}>{currentStat.matches}</Text>
                          <Text style={styles.wldLbl}>Played</Text>
                        </View>
                      </View>

                      {/* Where the numbers come from */}
                      <View style={styles.sourceRow}>
                        {!!ver && (
                          <View style={styles.verifiedPill}>
                            <Ionicons name="shield-checkmark" size={13} color="#16a34a" />
                            <Text style={styles.verifiedText}>{ver.played} verified from recorded games</Text>
                          </View>
                        )}
                        {!!manualStat && manualStat.matches > 0 && (
                          <Text style={styles.manualText}>{manualStat.matches} added by you</Text>
                        )}
                        <TouchableOpacity
                          style={{ marginLeft: 'auto' }}
                          onPress={() => user && router.push({ pathname: '/match-history', params: { userId: user.id, name: displayName, sport: selectedStatSport } })}
                        >
                          <Text style={styles.historyLink}>Match history ›</Text>
                        </TouchableOpacity>
                      </View>

                      {/* Win rate bar */}
                      <View style={styles.winRateSection}>
                        <View style={styles.winRateHeader}>
                          <Text style={styles.winRateLabel}>Win Rate</Text>
                          <Text style={styles.winRatePct}>{winRate}%</Text>
                        </View>
                        <View style={styles.winRateBarBg}>
                          <View style={[styles.winRateBarFill, { width: `${winRate}%` as any }]} />
                        </View>
                      </View>

                      {/* Sport-specific stat grid */}
                      {SPORT_STAT_FIELDS[currentStat.sport] && (
                        <View style={styles.sportStatsGrid}>
                          {SPORT_STAT_FIELDS[currentStat.sport]
                            .filter(({ key }) => currentStat.sportStats[key] !== undefined)
                            .map(({ key, label }) => (
                              <View key={key} style={styles.sportStatCell}>
                                <Text style={styles.sportStatValue}>{String(currentStat.sportStats[key])}</Text>
                                <Text style={styles.sportStatLabel}>{label}</Text>
                              </View>
                            ))}
                        </View>
                      )}
                    </View>
                  )}
                </>
              )}
            </View>
          );
        })()}

        {/* My Sports */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My Sports</Text>
            <TouchableOpacity style={styles.addSportBtn} onPress={openAddSport}>
              <Ionicons name="add" size={18} color="#16a34a" />
              <Text style={styles.addSportText}>Add Sport</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.sportsGrid}>
            {mySports.map((s) => (
              <TouchableOpacity
                key={s.id}
                style={styles.sportCard}
                onPress={() => openEditSport(s)}
                onLongPress={() => handleRemoveSport(s)}
              >
                <Text style={styles.sportEmoji}>{s.emoji}</Text>
                <Text style={styles.sportName}>{s.name}</Text>
                <View style={[styles.skillBadge, { backgroundColor: SKILL_COLORS[s.skill] }]}>
                  <Text style={styles.skillBadgeText}>{s.skill}</Text>
                </View>
                {summarizeDetails(s.name, s.details).map((line) => (
                  <Text key={line} style={styles.sportDetail} numberOfLines={2}>{line}</Text>
                ))}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.addSportCard} onPress={openAddSport}>
              <Ionicons name="add" size={28} color="#d1d5db" />
              <Text style={styles.addSportCardText}>Add</Text>
            </TouchableOpacity>
          </View>
          {mySports.length > 0 ? (
            <Text style={styles.longPressHint}>Tap a sport to edit it · long press to remove</Text>
          ) : (
            <TouchableOpacity style={styles.setupCard} onPress={() => router.push('/welcome')}>
              <Text style={{ fontSize: 26 }}>🏅</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.setupTitle}>Set up my sports</Text>
                <Text style={styles.setupSub}>Takes a minute — helps you find players and events that suit you.</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#16a34a" />
            </TouchableOpacity>
          )}
        </View>

        {/* Privacy & Messaging */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Privacy & Messaging</Text>
          <View style={styles.privacyCard}>
            {/* Profile Visibility */}
            <View style={styles.privacyRow}>
              <View style={styles.privacyLeft}>
                <Ionicons name="eye-outline" size={20} color="#374151" />
                <View>
                  <Text style={styles.privacyRowTitle}>Profile Visibility</Text>
                  <Text style={styles.privacyRowSub}>{profileVisibility}</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.changeBtn} onPress={() => setShowVisibilityModal(true)}>
                <Text style={styles.changeBtnText}>Change</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.divider} />

            {/* Allow Messages */}
            <View style={styles.privacyRow}>
              <View style={styles.privacyLeft}>
                <Ionicons name="chatbubble-outline" size={20} color="#374151" />
                <View>
                  <Text style={styles.privacyRowTitle}>Allow Messages</Text>
                  <Text style={styles.privacyRowSub}>{allowMessages ? 'Enabled' : 'Disabled'}</Text>
                </View>
              </View>
              <Switch
                value={allowMessages}
                onValueChange={changeAllowMessages}
                trackColor={{ false: '#d1d5db', true: '#86efac' }}
                thumbColor={allowMessages ? '#16a34a' : '#9ca3af'}
              />
            </View>

            <View style={styles.divider} />

            {/* Accept Messages From */}
            <View style={styles.privacyRow}>
              <View style={styles.privacyLeft}>
                <Ionicons name="people-outline" size={20} color="#374151" />
                <View>
                  <Text style={styles.privacyRowTitle}>Accept Messages From</Text>
                  <Text style={styles.privacyRowSub}>{messagesFromLabel()}</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.changeBtn} onPress={() => setShowMessagesFromModal(true)}>
                <Text style={styles.changeBtnText}>Edit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Account Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Settings</Text>
          <View style={styles.menuCard}>
            {[
              { icon: 'person-outline' as const,      label: 'Edit Profile',      onPress: () => router.push('/edit-profile') },
              { icon: 'notifications-outline' as const, label: 'Notifications',   onPress: () => router.push('/notifications') },
              { icon: 'stats-chart-outline' as const, label: 'My Statistics',   onPress: () => router.push('/statistics') },
              { icon: 'time-outline' as const,        label: 'Match History',   onPress: () => user && router.push({ pathname: '/match-history', params: { userId: user.id, name: displayName } }) },
              { icon: 'people-outline' as const,      label: 'My Teams',          onPress: () => router.push('/my-teams') },
              { icon: 'medal-outline' as const,       label: 'Ratings & Badges',  onPress: () => user && router.push({ pathname: '/ratings', params: { kind: 'player', id: user.id, name: displayName } }) },
              { icon: 'card-outline' as const,        label: 'Payment Methods',   onPress: () => Alert.alert('Payment Methods', 'Online payments are coming soon. For now, pay at the venue on the day of your booking or event.') },
              { icon: 'shield-outline' as const,      label: 'Privacy & Security', onPress: () => router.push('/privacy') },
              { icon: 'help-circle-outline' as const, label: 'Help & Support',    onPress: () => router.push('/help') },
            ].map((item, i, arr) => (
              <React.Fragment key={item.label}>
                <TouchableOpacity style={styles.menuRow} onPress={item.onPress}>
                  <View style={styles.menuLeft}>
                    <View style={styles.menuIconBox}>
                      <Ionicons name={item.icon} size={20} color="#374151" />
                    </View>
                    <Text style={styles.menuLabel}>{item.label}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
                </TouchableOpacity>
                {i < arr.length - 1 && <View style={styles.divider} />}
              </React.Fragment>
            ))}
          </View>
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={() => setShowLogoutConfirm(true)}>
          <Ionicons name="log-out-outline" size={20} color="#ef4444" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        <Text style={styles.version}>Version 1.0.0</Text>
      </ScrollView>

      {/* Profile Visibility Modal */}
      <Modal visible={showVisibilityModal} animationType="fade" transparent>
        <View style={styles.centeredOverlay}>
          <View style={styles.alertBox}>
            <Text style={styles.alertTitle}>Profile Visibility</Text>
            <Text style={styles.alertSub}>Friends Only: only people you follow can see your profile</Text>
            {(['Public', 'Friends Only'] as const).map((opt) => (
              <TouchableOpacity
                key={opt}
                style={[styles.optionRow, profileVisibility === opt && styles.optionRowActive]}
                onPress={() => changeVisibility(opt)}
              >
                <Text style={[styles.optionText, profileVisibility === opt && styles.optionTextActive]}>
                  {opt}
                </Text>
                {profileVisibility === opt && <Ionicons name="checkmark-circle" size={18} color="#16a34a" />}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowVisibilityModal(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Messages From Modal */}
      <Modal visible={showMessagesFromModal} animationType="fade" transparent>
        <View style={styles.centeredOverlay}>
          <View style={styles.alertBox}>
            <Text style={styles.alertTitle}>Accept Messages From</Text>
            <Text style={styles.alertSub}>Select which genders can message you</Text>
            {([
              { key: 'male' as const, label: 'Male' },
              { key: 'female' as const, label: 'Female' },
              { key: 'undisclosed' as const, label: 'Undisclosed' },
            ]).map(({ key, label }) => (
              <TouchableOpacity
                key={key}
                style={[styles.optionRow, messagesFrom[key] && styles.optionRowActive]}
                onPress={() => toggleGender(key)}
              >
                <Text style={[styles.optionText, messagesFrom[key] && styles.optionTextActive]}>{label}</Text>
                {messagesFrom[key] && <Ionicons name="checkmark-circle" size={18} color="#16a34a" />}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.confirmBtn} onPress={saveMessagesFrom}>
              <Text style={styles.confirmBtnText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Logout Confirm */}
      <Modal visible={showLogoutConfirm} animationType="fade" transparent>
        <View style={styles.centeredOverlay}>
          <View style={styles.alertBox}>
            <Ionicons name="log-out-outline" size={40} color="#ef4444" style={{ marginBottom: 10 }} />
            <Text style={styles.alertTitle}>Logout</Text>
            <Text style={styles.alertSub}>Are you sure you want to logout?</Text>
            <View style={styles.twoButtons}>
              <TouchableOpacity style={styles.cancelBtn2} onPress={() => setShowLogoutConfirm(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.logoutConfirmBtn}
                onPress={async () => {
                  setShowLogoutConfirm(false);
                  await signOut();
                  // _layout.tsx will redirect to sign-in automatically
                }}
              >
                <Text style={styles.logoutConfirmText}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Record Stats Modal */}
      <Modal visible={showRecordStats} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
          <SafeAreaView style={{ flex: 1 }}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {playerStats.find((s) => s.sport === recordingSport) ? 'Edit' : 'Record'} {recordingSport} Stats
              </Text>
              <TouchableOpacity onPress={() => setShowRecordStats(false)}>
                <Ionicons name="close" size={24} color="#111827" />
              </TouchableOpacity>
            </View>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.modalBody}>
              {/* Match record row */}
              <Text style={styles.fieldLabel}>Match Record</Text>
              <Text style={styles.recordHint}>
                Results recorded in MatchDay (challenges, events, pickup games) are counted automatically — only add games you played elsewhere.
              </Text>
              <View style={styles.matchRecordRow}>
                {([
                  { label: 'Played', value: recordMatches, set: setRecordMatches },
                  { label: 'Won',    value: recordWins,    set: setRecordWins    },
                  { label: 'Lost',   value: recordLosses,  set: setRecordLosses  },
                  { label: 'Draw',   value: recordDraws,   set: setRecordDraws   },
                ] as const).map(({ label, value, set }) => (
                  <View key={label} style={styles.matchRecordCell}>
                    <Text style={styles.matchRecordLabel}>{label}</Text>
                    <TextInput
                      style={styles.matchRecordInput}
                      value={value}
                      onChangeText={set}
                      keyboardType="numeric"
                      maxLength={5}
                      selectTextOnFocus
                    />
                  </View>
                ))}
              </View>

              {/* Sport-specific stat fields */}
              {(SPORT_STAT_FIELDS[recordingSport] ?? []).map((field) => (
                <View key={field.key}>
                  <Text style={styles.fieldLabel}>{field.label}</Text>
                  <TextInput
                    style={styles.statTextInput}
                    value={recordSportStats[field.key] ?? ''}
                    onChangeText={(v) => setRecordSportStats((prev) => ({ ...prev, [field.key]: v }))}
                    keyboardType={field.numeric ? 'numeric' : 'default'}
                    placeholder="0"
                    placeholderTextColor="#9ca3af"
                    selectTextOnFocus
                  />
                </View>
              ))}

              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveStats} disabled={savingStats}>
                {savingStats
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.saveBtnText}>Save Stats</Text>}
              </TouchableOpacity>
              <View style={{ height: 20 }} />
            </ScrollView>
            </KeyboardAvoidingView>
          </SafeAreaView>
          </View>
        </View>
      </Modal>

      {/* Add Sport Modal */}
      <Modal visible={showAddSport} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
          <SafeAreaView style={{ flex: 1 }}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingSport ? `Edit ${newSport}` : 'Add Sport'}</Text>
              <TouchableOpacity onPress={() => { setShowAddSport(false); setNewDetails({}); }}>
                <Ionicons name="close" size={24} color="#111827" />
              </TouchableOpacity>
            </View>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.modalBody}>
              {!editingSport && (
                <>
                <Text style={styles.fieldLabel}>Sport</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {Object.keys(SPORT_EMOJIS).map((s) => (
                      <TouchableOpacity
                        key={s}
                        style={[styles.sportChip, newSport === s && styles.sportChipActive]}
                        onPress={() => { setNewSport(s); setNewDetails({}); }}
                      >
                        <Text style={styles.sportChipEmoji}>{SPORT_EMOJIS[s]}</Text>
                        <Text style={[styles.sportChipText, newSport === s && { color: '#fff' }]}>{s}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
                </>
              )}

              <SportDetailsEditor
                key={newSport}
                sport={newSport}
                skill={newSkill}
                details={newDetails}
                onChange={(skill, details) => { setNewSkill(skill); setNewDetails(details); }}
              />
              <View style={{ height: 18 }} />

              {editingSport && (
                <TouchableOpacity
                  style={styles.askRatingsBtn}
                  onPress={() => { setShowAddSport(false); setAskSport(newSport); }}
                >
                  <Ionicons name="paper-plane-outline" size={18} color="#16a34a" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.askRatingsTitle}>Ask players to rate my {newSport}</Text>
                    <Text style={styles.askRatingsSub}>Ratings from people you’ve played earn badges and build trust</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#16a34a" />
                </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.saveBtn} onPress={handleAddSport} disabled={addingSport}>
                {addingSport
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.saveBtnText}>{editingSport ? 'Save Changes' : 'Save Sport'}</Text>}
              </TouchableOpacity>
              <View style={{ height: 20 }} />
            </ScrollView>
            </KeyboardAvoidingView>
          </SafeAreaView>
          </View>
        </View>
      </Modal>
      {user && (
        <AskRatingsModal
          visible={!!askSport}
          kind="player"
          subjectId={user.id}
          subjectName={displayName}
          sports={mySports.map((s) => s.name)}
          initialSport={askSport ?? undefined}
          onClose={() => setAskSport(null)}
        />
      )}
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  bgOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,10,2,0.38)' },
  scroll: { flex: 1 },
  content: { paddingBottom: 32 },
  profileHeader: {
    paddingBottom: 48,
    overflow: 'hidden',
  },
  profileHeaderOverlay: {
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 8 : 4,
    paddingBottom: 8,
  },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: '800' },
  headerIcons: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatarSection: { alignItems: 'center', paddingBottom: 8 },
  avatarCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.5)',
    marginBottom: 12,
    overflow: 'hidden',
  },
  avatarImage: { width: 88, height: 88, borderRadius: 44 },
  avatarInitials: { color: '#fff', fontSize: 30, fontWeight: '800' },
  profileName: { color: '#fff', fontSize: 24, fontWeight: '700' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  profileLocation: { color: 'rgba(255,255,255,0.8)', fontSize: 14 },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.93)',
    marginHorizontal: 16,
    marginTop: -28,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    zIndex: 10,
    marginBottom: 20,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 22, fontWeight: '800', color: '#111827' },
  statLbl: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  statDivider: { width: 1, backgroundColor: '#e5e7eb' },
  section: { marginHorizontal: 16, marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#fff' },
  addSportBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addSportText: { color: '#16a34a', fontWeight: '600', fontSize: 14 },
  sportsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  sportCard: {
    backgroundColor: 'rgba(255,255,255,0.93)',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    minWidth: 100,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  sportEmoji: { fontSize: 30, marginBottom: 6 },
  sportName: { fontSize: 13, fontWeight: '600', color: '#111827', marginBottom: 6 },
  skillBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  skillBadgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  addSportCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 100,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
  },
  addSportCardText: { fontSize: 13, color: '#9ca3af', marginTop: 4 },
  privacyCard: {
    backgroundColor: 'rgba(255,255,255,0.93)',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  privacyLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  privacyRowTitle: { fontWeight: '600', color: '#111827', fontSize: 14 },
  privacyRowSub: { color: '#9ca3af', fontSize: 12, marginTop: 1 },
  changeBtn: { backgroundColor: '#f0fdf4', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  changeBtnText: { color: '#16a34a', fontWeight: '600', fontSize: 13 },
  divider: { height: 1, backgroundColor: '#f3f4f6', marginLeft: 14 },
  menuCard: {
    backgroundColor: 'rgba(255,255,255,0.93)',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  menuLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  menuIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: { fontSize: 15, color: '#111827', fontWeight: '500' },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#fecaca',
    backgroundColor: '#fff5f5',
    marginBottom: 12,
  },
  logoutText: { color: '#ef4444', fontWeight: '700', fontSize: 16 },
  version: { textAlign: 'center', color: '#9ca3af', fontSize: 13 },
  centeredOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  alertBox: { backgroundColor: '#fff', borderRadius: 20, padding: 24, width: '82%', maxWidth: 360, alignItems: 'center' },
  alertTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 6 },
  alertSub: { fontSize: 13, color: '#6b7280', textAlign: 'center', marginBottom: 16 },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    marginBottom: 8,
  },
  optionRowActive: { borderColor: '#16a34a', backgroundColor: '#f0fdf4' },
  optionText: { fontSize: 14, color: '#374151', fontWeight: '500' },
  optionTextActive: { color: '#16a34a', fontWeight: '700' },
  cancelBtn: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginTop: 4,
  },
  cancelBtnText: { color: '#6b7280', fontWeight: '600' },
  confirmBtn: {
    width: '100%',
    backgroundColor: '#16a34a',
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  confirmBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  twoButtons: { flexDirection: 'row', gap: 10, width: '100%', marginTop: 8 },
  cancelBtn2: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  logoutConfirmBtn: {
    flex: 1,
    backgroundColor: '#ef4444',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  logoutConfirmText: { color: '#fff', fontWeight: '700' },
  longPressHint: { color: '#9ca3af', fontSize: 11, textAlign: 'center', marginTop: 4 },
  sourceRow: {
    flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8,
    paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  verifiedPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#f0fdf4', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  verifiedText: { fontSize: 11, fontWeight: '700', color: '#166534' },
  manualText: { fontSize: 11, color: '#6b7280', fontWeight: '600' },
  historyLink: { fontSize: 13, fontWeight: '700', color: '#16a34a' },
  recordHint: { fontSize: 12, color: '#6b7280', lineHeight: 17, marginTop: -4, marginBottom: 10 },
  askRatingsBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14,
    backgroundColor: '#f0fdf4', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#bbf7d0',
  },
  askRatingsTitle: { fontSize: 14, fontWeight: '700', color: '#166534' },
  askRatingsSub: { fontSize: 12, color: '#4b5563', marginTop: 1 },
  setupCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10,
    backgroundColor: '#f0fdf4', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#bbf7d0',
  },
  setupTitle: { fontSize: 15, fontWeight: '800', color: '#166534' },
  setupSub: { fontSize: 12, color: '#4b5563', marginTop: 2 },
  sportDetail: { fontSize: 10, color: '#6b7280', marginTop: 2 },
  // Add Sport Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '85%',
    overflow: 'hidden',
  },
  modalHandle: {
    width: 40, height: 4, backgroundColor: '#d1d5db',
    borderRadius: 2, alignSelf: 'center', marginTop: 10,
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  modalBody: { padding: 16 },
  fieldLabel: { fontWeight: '700', color: '#111827', fontSize: 14, marginBottom: 8 },
  sportChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#f9fafb',
  },
  sportChipActive: { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  sportChipEmoji: { fontSize: 16 },
  sportChipText: { color: '#374151', fontWeight: '500', fontSize: 13 },
  skillRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  skillChip: {
    flex: 1, paddingVertical: 8, borderRadius: 8,
    borderWidth: 1, borderColor: '#e5e7eb', alignItems: 'center',
  },
  skillChipText: { color: '#374151', fontWeight: '600', fontSize: 13 },
  optionPill: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#f9fafb',
  },
  optionPillActive: { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  optionPillText: { color: '#374151', fontWeight: '500', fontSize: 13 },
  saveBtn: {
    backgroundColor: '#16a34a', paddingVertical: 14,
    borderRadius: 12, alignItems: 'center', marginTop: 8,
  },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  // Record Stats prompt (when no stats exist for a sport yet)
  recordStatsPrompt: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#f0fdf4', borderRadius: 12, paddingVertical: 20,
    borderWidth: 1.5, borderColor: '#bbf7d0', borderStyle: 'dashed',
  },
  recordStatsPromptText: { color: '#16a34a', fontWeight: '600', fontSize: 15 },
  // Stats card header with Edit button
  statsCardHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  statsCardTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
  editStatsBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#f0fdf4', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
  },
  editStatsBtnText: { color: '#16a34a', fontWeight: '600', fontSize: 13 },
  // Match record row in Record Stats modal
  matchRecordRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  matchRecordCell: { flex: 1, alignItems: 'center' },
  matchRecordLabel: { fontSize: 11, color: '#6b7280', marginBottom: 4, fontWeight: '600' },
  matchRecordInput: {
    width: '100%', textAlign: 'center', fontSize: 18, fontWeight: '700',
    color: '#111827', backgroundColor: '#f9fafb', borderRadius: 10,
    borderWidth: 1, borderColor: '#e5e7eb', paddingVertical: 10,
  },
  statTextInput: {
    backgroundColor: '#f9fafb', borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb',
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#111827', marginBottom: 14,
  },
  // Player Stats section
  emptyStatsCard: {
    backgroundColor: 'rgba(255,255,255,0.93)',
    borderRadius: 14,
    padding: 32,
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  emptyStatsText: { color: '#9ca3af', fontSize: 14 },
  statSportTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  statSportTabActive: { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  statSportTabEmoji: { fontSize: 16 },
  statSportTabText: { color: '#374151', fontWeight: '600', fontSize: 13 },
  statSportTabTextActive: { color: '#fff' },
  statsDetailCard: {
    backgroundColor: 'rgba(255,255,255,0.93)',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  wldRow: {
    flexDirection: 'row',
    paddingVertical: 18,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  wldItem: { flex: 1, alignItems: 'center' },
  wldNum: { fontSize: 24, fontWeight: '800', color: '#111827' },
  wldLbl: { fontSize: 11, color: '#6b7280', marginTop: 2 },
  wldDivider: { width: 1, backgroundColor: '#e5e7eb' },
  winRateSection: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  winRateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  winRateLabel: { fontSize: 13, fontWeight: '600', color: '#374151' },
  winRatePct: { fontSize: 13, fontWeight: '700', color: '#16a34a' },
  winRateBarBg: {
    height: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 4,
    overflow: 'hidden',
  },
  winRateBarFill: {
    height: 8,
    backgroundColor: '#16a34a',
    borderRadius: 4,
  },
  sportStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  sportStatCell: {
    width: '50%',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    borderRightWidth: 1,
    borderRightColor: '#f3f4f6',
    alignItems: 'center',
  },
  sportStatValue: { fontSize: 22, fontWeight: '800', color: '#111827' },
  sportStatLabel: { fontSize: 11, color: '#6b7280', marginTop: 3 },
});
