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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../lib/AuthContext';
import { fetchMySports, addSport, removeSport, fetchMyRanking, fetchPlayerStats, upsertSportStats, type ProfileSport, type MyRanking, type PlayerStat } from '../../lib/profile';

const FIELD_IMAGE = 'https://images.unsplash.com/photo-1537020724888-8c2fb2b2ae7e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxicmlnaHQlMjBmb290YmFsbCUyMGZpZWxkJTIwZ3Jhc3N8ZW58MXx8fHwxNzY1NzM5NzA0fDA&ixlib=rb-4.1.0&q=80&w=1080';
import { useRouter } from 'expo-router';

const SKILL_COLORS: Record<string, string> = {
  Beginner: '#3b82f6',
  Intermediate: '#f59e0b',
  Advanced: '#ef4444',
};

const SPORT_EMOJIS: Record<string, string> = {
  Football: '⚽', Cricket: '🏏', Tennis: '🎾',
  Basketball: '🏀', Hockey: '🏑', Badminton: '🏸', Baseball: '⚾',
};

const SPORT_DETAILS_FIELDS: Record<string, { label: string; options: string[] }[]> = {
  Tennis:     [{ label: 'NTRP Rating', options: ['1.0','1.5','2.0','2.5','3.0','3.5','4.0','4.5','5.0','5.5','6.0','7.0'] }],
  Cricket:    [{ label: 'Role', options: ['Batsman','Bowler','All-rounder','Wicket-keeper'] }, { label: 'Batting Hand', options: ['Right','Left'] }],
  Football:   [{ label: 'Position', options: ['Forward','Midfielder','Defender','Goalkeeper'] }],
  Basketball: [{ label: 'Position', options: ['Point Guard','Shooting Guard','Small Forward','Power Forward','Center'] }],
  Badminton:  [{ label: 'Style', options: ['Singles','Doubles','Mixed'] }],
  Baseball:   [{ label: 'Position', options: ['Pitcher','Catcher','First Base','Second Base','Shortstop','Third Base','Outfield'] }],
  Hockey:     [{ label: 'Position', options: ['Forward','Midfielder','Defender','Goalkeeper'] }],
};

// Used for both the Record Stats form and the stats display card
const SPORT_STAT_FIELDS: Record<string, { key: string; label: string; numeric: boolean }[]> = {
  Football: [
    { key: 'goals',        label: 'Goals',        numeric: true  },
    { key: 'assists',      label: 'Assists',       numeric: true  },
    { key: 'clean_sheets', label: 'Clean Sheets',  numeric: true  },
    { key: 'yellow_cards', label: 'Yellow Cards',  numeric: true  },
    { key: 'red_cards',    label: 'Red Cards',     numeric: true  },
  ],
  Cricket: [
    { key: 'runs',         label: 'Total Runs',    numeric: true  },
    { key: 'wickets',      label: 'Wickets',       numeric: true  },
    { key: 'batting_avg',  label: 'Batting Avg',   numeric: false },
    { key: 'bowling_avg',  label: 'Bowling Avg',   numeric: false },
    { key: 'centuries',    label: 'Centuries',     numeric: true  },
    { key: 'fifties',      label: 'Fifties',       numeric: true  },
  ],
  Tennis: [
    { key: 'aces',            label: 'Aces',           numeric: true  },
    { key: 'double_faults',   label: 'Double Faults',  numeric: true  },
    { key: 'sets_won',        label: 'Sets Won',        numeric: true  },
    { key: 'games_won',       label: 'Games Won',       numeric: true  },
    { key: 'first_serve_pct', label: 'First Serve %',   numeric: false },
  ],
  Basketball: [
    { key: 'points',         label: 'Points',      numeric: true },
    { key: 'rebounds',       label: 'Rebounds',    numeric: true },
    { key: 'assists',        label: 'Assists',      numeric: true },
    { key: 'blocks',         label: 'Blocks',       numeric: true },
    { key: 'steals',         label: 'Steals',       numeric: true },
    { key: 'three_pointers', label: '3-Pointers',   numeric: true },
  ],
  Badminton: [
    { key: 'sets_won',      label: 'Sets Won',       numeric: true },
    { key: 'points_scored', label: 'Points Scored',  numeric: true },
    { key: 'smashes',       label: 'Smashes',        numeric: true },
    { key: 'drop_shots',    label: 'Drop Shots',     numeric: true },
  ],
  Baseball: [
    { key: 'home_runs',    label: 'Home Runs',    numeric: true  },
    { key: 'hits',         label: 'Hits',          numeric: true  },
    { key: 'rbis',         label: 'RBIs',          numeric: true  },
    { key: 'batting_avg',  label: 'Batting Avg',   numeric: false },
    { key: 'stolen_bases', label: 'Stolen Bases',  numeric: true  },
  ],
  Hockey: [
    { key: 'goals',           label: 'Goals',           numeric: true },
    { key: 'assists',         label: 'Assists',          numeric: true },
    { key: 'saves',           label: 'Saves',            numeric: true },
    { key: 'penalty_minutes', label: 'Penalty Minutes',  numeric: true },
  ],
};

const MENU_ITEMS = [
  { icon: 'person-outline' as const, label: 'Edit Profile', color: '#374151' },
  { icon: 'notifications-outline' as const, label: 'Notifications', color: '#374151' },
  { icon: 'card-outline' as const, label: 'Payment Methods', color: '#374151' },
  { icon: 'shield-outline' as const, label: 'Privacy & Security', color: '#374151' },
  { icon: 'help-circle-outline' as const, label: 'Help & Support', color: '#374151' },
];

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

  // Sports & stats
  const [mySports, setMySports] = useState<ProfileSport[]>([]);
  const [ranking, setRanking] = useState<MyRanking | null>(null);
  const [playerStats, setPlayerStats] = useState<PlayerStat[]>([]);
  const [selectedStatSport, setSelectedStatSport] = useState('');
  const [showAddSport, setShowAddSport] = useState(false);
  const [addingSport, setAddingSport] = useState(false);
  const [newSport, setNewSport] = useState('Football');
  const [newSkill, setNewSkill] = useState<'Beginner' | 'Intermediate' | 'Advanced'>('Intermediate');
  const [newDetails, setNewDetails] = useState<Record<string, string>>({});

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

    const [sports, rank, stats] = await Promise.all([
      fetchMySports(user.id),
      fetchMyRanking(),
      fetchPlayerStats(user.id),
    ]);

    // Discard result if a newer loadProfile call has already started
    if (key !== loadKey.current) return;

    setRanking(rank);
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

  const messagesFromLabel = () => {
    const selected = Object.entries(messagesFrom)
      .filter(([, v]) => v)
      .map(([k]) => k.charAt(0).toUpperCase() + k.slice(1));
    return selected.length === 3 ? 'Everyone' : selected.join(', ') || 'Nobody';
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Header */}
        <ImageBackground source={{ uri: FIELD_IMAGE }} style={styles.profileHeader} resizeMode="cover">
          <View style={styles.profileHeaderOverlay}>
          <SafeAreaView edges={['top']}>
            <View style={styles.headerTop}>
              <Text style={styles.headerTitle}>Profile</Text>
              <TouchableOpacity onPress={() => router.push('/messages')}>
                <Ionicons name="chatbubbles-outline" size={24} color="#fff" />
              </TouchableOpacity>
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
        </ImageBackground>

        {/* Stats Card */}
        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <Text style={styles.statNum}>{ranking?.matches ?? '—'}</Text>
            <Text style={styles.statLbl}>Matches</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNum}>{ranking?.wins ?? '—'}</Text>
            <Text style={styles.statLbl}>Wins</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statNum, { color: '#f59e0b' }]}>
              {ranking ? `${ranking.winRate}%` : '—'}
            </Text>
            <Text style={styles.statLbl}>Win Rate</Text>
          </View>
        </View>

        {/* Area Ranking */}
        {ranking && ranking.areaTotal > 1 && (
          <View style={styles.rankCard}>
            <View style={styles.rankLeft}>
              <Ionicons name="trophy-outline" size={20} color="#f59e0b" />
              <View>
                <Text style={styles.rankTitle}>Area Ranking</Text>
                <Text style={styles.rankSub}>{ranking.area || 'Your area'}</Text>
              </View>
            </View>
            <Text style={styles.rankBadge}>
              #{ranking.areaRank} <Text style={styles.rankOf}>of {ranking.areaTotal}</Text>
            </Text>
          </View>
        )}

        {/* Player Stats */}
        {(() => {
          const currentStat = playerStats.find((s) => s.sport === selectedStatSport);
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
            <TouchableOpacity style={styles.addSportBtn} onPress={() => setShowAddSport(true)}>
              <Ionicons name="add" size={18} color="#16a34a" />
              <Text style={styles.addSportText}>Add Sport</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.sportsGrid}>
            {mySports.map((s) => (
              <TouchableOpacity
                key={s.id}
                style={styles.sportCard}
                onLongPress={() => handleRemoveSport(s)}
              >
                <Text style={styles.sportEmoji}>{s.emoji}</Text>
                <Text style={styles.sportName}>{s.name}</Text>
                <View style={[styles.skillBadge, { backgroundColor: SKILL_COLORS[s.skill] }]}>
                  <Text style={styles.skillBadgeText}>{s.skill}</Text>
                </View>
                {Object.entries(s.details).map(([k, v]) => (
                  <Text key={k} style={styles.sportDetail}>{k}: {v}</Text>
                ))}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.addSportCard} onPress={() => setShowAddSport(true)}>
              <Ionicons name="add" size={28} color="#d1d5db" />
              <Text style={styles.addSportCardText}>Add</Text>
            </TouchableOpacity>
          </View>
          {mySports.length > 0 && (
            <Text style={styles.longPressHint}>Long press a sport to remove it</Text>
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
                onValueChange={setAllowMessages}
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
            {MENU_ITEMS.map((item, i) => (
              <React.Fragment key={item.label}>
                <TouchableOpacity style={styles.menuRow}>
                  <View style={styles.menuLeft}>
                    <View style={styles.menuIconBox}>
                      <Ionicons name={item.icon} size={20} color="#374151" />
                    </View>
                    <Text style={styles.menuLabel}>{item.label}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
                </TouchableOpacity>
                {i < MENU_ITEMS.length - 1 && <View style={styles.divider} />}
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
            <Text style={styles.alertSub}>Choose who can see your profile</Text>
            {(['Public', 'Friends Only'] as const).map((opt) => (
              <TouchableOpacity
                key={opt}
                style={[styles.optionRow, profileVisibility === opt && styles.optionRowActive]}
                onPress={() => {
                  setProfileVisibility(opt);
                  setShowVisibilityModal(false);
                }}
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
            <TouchableOpacity style={styles.confirmBtn} onPress={() => setShowMessagesFromModal(false)}>
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
            <ScrollView contentContainerStyle={styles.modalBody}>
              {/* Match record row */}
              <Text style={styles.fieldLabel}>Match Record</Text>
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
              <Text style={styles.modalTitle}>Add Sport</Text>
              <TouchableOpacity onPress={() => { setShowAddSport(false); setNewDetails({}); }}>
                <Ionicons name="close" size={24} color="#111827" />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalBody}>
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

              <Text style={styles.fieldLabel}>Skill Level</Text>
              <View style={styles.skillRow}>
                {(['Beginner', 'Intermediate', 'Advanced'] as const).map((lvl) => (
                  <TouchableOpacity
                    key={lvl}
                    style={[styles.skillChip, newSkill === lvl && { backgroundColor: SKILL_COLORS[lvl], borderColor: SKILL_COLORS[lvl] }]}
                    onPress={() => setNewSkill(lvl)}
                  >
                    <Text style={[styles.skillChipText, newSkill === lvl && { color: '#fff' }]}>{lvl}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Sport-specific fields */}
              {(SPORT_DETAILS_FIELDS[newSport] ?? []).map((field) => (
                <View key={field.label}>
                  <Text style={styles.fieldLabel}>{field.label}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {field.options.map((opt) => (
                        <TouchableOpacity
                          key={opt}
                          style={[styles.optionPill, newDetails[field.label] === opt && styles.optionPillActive]}
                          onPress={() => setNewDetails((prev) => ({ ...prev, [field.label]: opt }))}
                        >
                          <Text style={[styles.optionPillText, newDetails[field.label] === opt && { color: '#fff' }]}>
                            {opt}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              ))}

              <TouchableOpacity style={styles.saveBtn} onPress={handleAddSport} disabled={addingSport}>
                {addingSport
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.saveBtnText}>Save Sport</Text>}
              </TouchableOpacity>
              <View style={{ height: 20 }} />
            </ScrollView>
          </SafeAreaView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f3f4f6' },
  scroll: { flex: 1 },
  content: { paddingBottom: 32 },
  profileHeader: {
    paddingBottom: 48,
    overflow: 'hidden',
  },
  profileHeaderOverlay: {
    backgroundColor: 'rgba(0,0,0,0.40)',
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
    backgroundColor: '#fff',
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
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  addSportBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addSportText: { color: '#16a34a', fontWeight: '600', fontSize: 14 },
  sportsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  sportCard: {
    backgroundColor: '#fff',
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
    backgroundColor: '#fff',
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
    backgroundColor: '#fff',
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
  // Ranking
  rankCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: -8,
    marginBottom: 8,
    borderRadius: 12,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  rankLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rankTitle: { fontWeight: '700', color: '#111827', fontSize: 14 },
  rankSub: { color: '#6b7280', fontSize: 12 },
  rankBadge: { fontSize: 22, fontWeight: '800', color: '#f59e0b' },
  rankOf: { fontSize: 14, fontWeight: '400', color: '#6b7280' },
  longPressHint: { color: '#9ca3af', fontSize: 11, textAlign: 'center', marginTop: 4 },
  sportDetail: { fontSize: 10, color: '#6b7280', marginTop: 2 },
  // Add Sport Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#fff',
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
    backgroundColor: '#fff',
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
    backgroundColor: '#fff',
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
