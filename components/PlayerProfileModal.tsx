import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Player } from '../data/mockData';
import {
  fetchPlayerStats,
  fetchMySports,
  fetchFullProfile,
  type PlayerStat,
  type ProfileSport,
  type FullProfile,
} from '../lib/profile';

interface Props {
  player: Player | null;
  onClose: () => void;
  onMessage?: (player: Player) => void;
}

const SKILL_COLORS: Record<string, string> = {
  Beginner: '#3b82f6',
  Intermediate: '#f59e0b',
  Advanced: '#ef4444',
};

const SPORT_EMOJIS: Record<string, string> = {
  Football: '⚽', Cricket: '🏏', Tennis: '🎾',
  Basketball: '🏀', Hockey: '🏑', Badminton: '🏸', Baseball: '⚾',
};

const SPORT_STAT_FIELDS: Record<string, { key: string; label: string }[]> = {
  Football: [
    { key: 'goals',        label: 'Goals' },
    { key: 'assists',      label: 'Assists' },
    { key: 'yellow_cards', label: 'Yellow Cards' },
    { key: 'red_cards',    label: 'Red Cards' },
  ],
  Cricket: [
    { key: 'runs',        label: 'Total Runs' },
    { key: 'wickets',     label: 'Wickets' },
    { key: 'batting_avg', label: 'Batting Avg' },
    { key: 'bowling_avg', label: 'Bowling Avg' },
    { key: 'centuries',   label: 'Centuries' },
    { key: 'fifties',     label: 'Fifties' },
  ],
  Tennis: [
    { key: 'aces',            label: 'Aces' },
    { key: 'sets_won',        label: 'Sets Won' },
    { key: 'games_won',       label: 'Games Won' },
    { key: 'first_serve_pct', label: 'First Serve %' },
    { key: 'double_faults',   label: 'Double Faults' },
  ],
  Basketball: [
    { key: 'points',         label: 'Points' },
    { key: 'rebounds',       label: 'Rebounds' },
    { key: 'assists',        label: 'Assists' },
    { key: 'blocks',         label: 'Blocks' },
    { key: 'steals',         label: 'Steals' },
    { key: 'three_pointers', label: '3-Pointers' },
  ],
  Badminton: [
    { key: 'sets_won',      label: 'Sets Won' },
    { key: 'points_scored', label: 'Points Scored' },
    { key: 'smashes',       label: 'Smashes' },
    { key: 'drop_shots',    label: 'Drop Shots' },
  ],
  Baseball: [
    { key: 'home_runs',    label: 'Home Runs' },
    { key: 'hits',         label: 'Hits' },
    { key: 'rbis',         label: 'RBIs' },
    { key: 'batting_avg',  label: 'Batting Avg' },
    { key: 'stolen_bases', label: 'Stolen Bases' },
  ],
};

export default function PlayerProfileModal({ player, onClose, onMessage }: Props) {
  const [sports, setSports]               = useState<ProfileSport[]>([]);
  const [playerStats, setPlayerStats]     = useState<PlayerStat[]>([]);
  const [selectedStatSport, setSelectedStatSport] = useState('');
  const [fullProfile, setFullProfile]     = useState<FullProfile | null>(null);
  const [loading, setLoading]             = useState(false);

  useEffect(() => {
    if (!player) return;
    setSports([]);
    setPlayerStats([]);
    setSelectedStatSport('');
    setFullProfile(null);
    setLoading(true);

    Promise.all([
      fetchMySports(player.id),
      fetchPlayerStats(player.id),
      fetchFullProfile(player.id),
    ]).then(([sp, st, pr]) => {
      setSports(
        sp.length > 0
          ? sp
          : player.sports.map((s, i) => ({ ...s, id: String(i), details: {} }))
      );
      setPlayerStats(st);
      setFullProfile(pr);
      if (st.length > 0) setSelectedStatSport(st[0].sport);
      setLoading(false);
    }).catch((err) => {
      console.warn('[PlayerProfileModal] fetch error:', err);
      setSports(player.sports.map((s, i) => ({ ...s, id: String(i), details: {} })));
      setLoading(false);
    });
  }, [player?.id]);

  if (!player) return null;

  const currentStat = playerStats.find((s) => s.sport === selectedStatSport);
  const winRate = currentStat && currentStat.matches > 0
    ? Math.round((currentStat.wins / currentStat.matches) * 100)
    : 0;

  // Use fetched profile data where available, fall back to prop values
  const displayBio    = fullProfile?.bio      || player.bio      || '';
  const displayArea   = fullProfile?.area     || player.area     || '';
  const displayJoin   = fullProfile?.joinDate || player.joinDate || '';
  const displayStats  = fullProfile?.stats    || player.stats;

  return (
    <Modal visible={!!player} animationType="slide" transparent>
      <View style={styles.overlay}>
        {/* height: '90%' gives the ScrollView a real height budget */}
        <View style={styles.sheet}>
          <SafeAreaView style={styles.safeInner}>
            <View style={styles.handle} />

            {/* Coloured header */}
            <View style={[styles.profileHeader, { backgroundColor: player.avatarColor }]}>
              <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                <Ionicons name="close" size={22} color="#fff" />
              </TouchableOpacity>
              <View style={styles.avatarLg}>
                <Text style={styles.avatarInitialsLg}>{player.initials}</Text>
              </View>
              <Text style={styles.profileName}>{player.name}</Text>
              {displayArea ? (
                <View style={styles.locationRow}>
                  <Ionicons name="location-outline" size={14} color="rgba(255,255,255,0.85)" />
                  <Text style={styles.profileLocation}>{displayArea}</Text>
                </View>
              ) : null}
              {displayJoin ? (
                <View style={styles.joinRow}>
                  <Ionicons name="calendar-outline" size={12} color="rgba(255,255,255,0.7)" />
                  <Text style={styles.joinText}>Member since {displayJoin}</Text>
                </View>
              ) : null}
            </View>

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Summary stats row */}
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statNum}>{displayStats.matches}</Text>
                  <Text style={styles.statLbl}>Matches</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statNum}>{displayStats.wins}</Text>
                  <Text style={styles.statLbl}>Wins</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={[styles.statNum, { color: '#f59e0b' }]}>{displayStats.rank}</Text>
                  <Text style={styles.statLbl}>Rank</Text>
                </View>
              </View>

              {player.privacy === 'private' && (
                <View style={styles.privacyBadge}>
                  <Ionicons name="lock-closed" size={14} color="#6b7280" />
                  <Text style={styles.privacyText}>Private Profile</Text>
                </View>
              )}

              {/* Bio */}
              {displayBio ? (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>About</Text>
                  <Text style={styles.bioText}>{displayBio}</Text>
                </View>
              ) : null}

              {/* Sports & Skills */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Sports & Skills</Text>
                {loading ? (
                  <ActivityIndicator size="small" color="#16a34a" style={{ marginTop: 8 }} />
                ) : sports.length === 0 ? (
                  <Text style={styles.emptyText}>No sports added yet</Text>
                ) : (
                  <View style={styles.sportsGrid}>
                    {sports.map((s, i) => (
                      <View key={s.id ?? i} style={styles.sportCard}>
                        <Text style={styles.sportEmoji}>{s.emoji || SPORT_EMOJIS[s.name] || '🏆'}</Text>
                        <Text style={styles.sportName}>{s.name}</Text>
                        <View style={[styles.skillBadge, { backgroundColor: SKILL_COLORS[s.skill] }]}>
                          <Text style={styles.skillBadgeText}>{s.skill}</Text>
                        </View>
                        {Object.entries(s.details ?? {}).map(([k, v]) => (
                          <Text key={k} style={styles.sportDetail}>{k}: {v}</Text>
                        ))}
                      </View>
                    ))}
                  </View>
                )}
              </View>

              {/* Player Stats */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Player Stats</Text>
                {loading ? (
                  <ActivityIndicator size="small" color="#16a34a" style={{ marginTop: 4 }} />
                ) : playerStats.length === 0 ? (
                  <View style={styles.emptyStatsBox}>
                    <Ionicons name="stats-chart-outline" size={30} color="#d1d5db" />
                    <Text style={styles.emptyStatsText}>No stats recorded yet</Text>
                  </View>
                ) : (
                  <>
                    {/* Sport tabs */}
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={{ marginBottom: 12 }}
                      contentContainerStyle={{ gap: 8, flexDirection: 'row' }}
                    >
                      {playerStats.map((s) => (
                        <TouchableOpacity
                          key={s.sport}
                          style={[
                            styles.statSportTab,
                            selectedStatSport === s.sport && styles.statSportTabActive,
                          ]}
                          onPress={() => setSelectedStatSport(s.sport)}
                        >
                          <Text style={styles.statSportTabEmoji}>{SPORT_EMOJIS[s.sport] ?? '🏆'}</Text>
                          <Text style={[
                            styles.statSportTabText,
                            selectedStatSport === s.sport && styles.statSportTabTextActive,
                          ]}>
                            {s.sport}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>

                    {currentStat && (
                      <View style={styles.statsDetailCard}>
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
                          {currentStat.draws > 0 && (
                            <>
                              <View style={styles.wldDivider} />
                              <View style={styles.wldItem}>
                                <Text style={[styles.wldNum, { color: '#f59e0b' }]}>{currentStat.draws}</Text>
                                <Text style={styles.wldLbl}>Draw</Text>
                              </View>
                            </>
                          )}
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

                        {/* Sport-specific grid */}
                        {SPORT_STAT_FIELDS[currentStat.sport] && (
                          <View style={styles.sportStatsGrid}>
                            {SPORT_STAT_FIELDS[currentStat.sport]
                              .filter(({ key }) => currentStat.sportStats[key] !== undefined)
                              .map(({ key, label }) => (
                                <View key={key} style={styles.sportStatCell}>
                                  <Text style={styles.sportStatValue}>
                                    {String(currentStat.sportStats[key])}
                                  </Text>
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

              {/* Actions */}
              {player.privacy !== 'private' && onMessage && (
                <TouchableOpacity style={styles.messageBtn} onPress={() => onMessage(player)}>
                  <Ionicons name="chatbubble-outline" size={18} color="#fff" />
                  <Text style={styles.messageBtnText}>Send Message</Text>
                </TouchableOpacity>
              )}
              {player.privacy === 'private' && (
                <View style={styles.privateNote}>
                  <Ionicons name="information-circle-outline" size={16} color="#6b7280" />
                  <Text style={styles.privateNoteText}>This user has restricted messages.</Text>
                </View>
              )}

              <View style={{ height: 32 }} />
            </ScrollView>
          </SafeAreaView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  // Explicit height gives ScrollView a real layout budget
  sheet: {
    height: '90%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  safeInner: {
    flex: 1,
  },
  handle: {
    width: 40, height: 4, backgroundColor: '#d1d5db',
    borderRadius: 2, alignSelf: 'center',
    marginTop: 10, marginBottom: 0,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
    position: 'relative',
  },
  closeBtn: {
    position: 'absolute', top: 12, right: 16,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarLg: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.6)',
  },
  avatarInitialsLg: { color: '#fff', fontSize: 26, fontWeight: '700' },
  profileName: { color: '#fff', fontSize: 20, fontWeight: '700', marginTop: 10 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  profileLocation: { color: 'rgba(255,255,255,0.85)', fontSize: 13 },
  joinRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  joinText: { color: 'rgba(255,255,255,0.7)', fontSize: 11 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 16 },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 16, marginTop: 16,
    borderRadius: 12, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 22, fontWeight: '700', color: '#111827' },
  statLbl: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  statDivider: { width: 1, backgroundColor: '#e5e7eb' },
  privacyBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#f3f4f6', marginHorizontal: 16, marginTop: 12,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
  },
  privacyText: { color: '#6b7280', fontSize: 13 },
  section: { marginHorizontal: 16, marginTop: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 10 },
  bioText: { color: '#6b7280', fontSize: 14, lineHeight: 22 },
  emptyText: { color: '#9ca3af', fontSize: 13 },
  sportsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  sportCard: {
    backgroundColor: '#f9fafb', borderRadius: 12, padding: 14,
    alignItems: 'center', minWidth: 100,
    borderWidth: 1, borderColor: '#e5e7eb',
  },
  sportEmoji: { fontSize: 28, marginBottom: 6 },
  sportName: { fontSize: 13, fontWeight: '600', color: '#111827', marginBottom: 6 },
  skillBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  skillBadgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  sportDetail: { fontSize: 10, color: '#6b7280', marginTop: 2 },
  emptyStatsBox: {
    alignItems: 'center', gap: 8, paddingVertical: 20,
    backgroundColor: '#f9fafb', borderRadius: 12,
    borderWidth: 1, borderColor: '#e5e7eb',
  },
  emptyStatsText: { color: '#9ca3af', fontSize: 13 },
  statSportTab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1, borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  statSportTabActive: { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  statSportTabEmoji: { fontSize: 16 },
  statSportTabText: { color: '#374151', fontWeight: '600', fontSize: 13 },
  statSportTabTextActive: { color: '#fff' },
  statsDetailCard: {
    backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden',
    borderWidth: 1, borderColor: '#e5e7eb',
  },
  wldRow: {
    flexDirection: 'row', paddingVertical: 16, paddingHorizontal: 8,
    borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  wldItem: { flex: 1, alignItems: 'center' },
  wldNum: { fontSize: 22, fontWeight: '800', color: '#111827' },
  wldLbl: { fontSize: 11, color: '#6b7280', marginTop: 2 },
  wldDivider: { width: 1, backgroundColor: '#e5e7eb' },
  winRateSection: {
    padding: 14, borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  winRateHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  winRateLabel: { fontSize: 13, fontWeight: '600', color: '#374151' },
  winRatePct: { fontSize: 13, fontWeight: '700', color: '#16a34a' },
  winRateBarBg: { height: 8, backgroundColor: '#f3f4f6', borderRadius: 4, overflow: 'hidden' },
  winRateBarFill: { height: 8, backgroundColor: '#16a34a', borderRadius: 4 },
  sportStatsGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  sportStatCell: {
    width: '50%', padding: 14,
    borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
    borderRightWidth: 1, borderRightColor: '#f3f4f6',
    alignItems: 'center',
  },
  sportStatValue: { fontSize: 20, fontWeight: '800', color: '#111827' },
  sportStatLabel: { fontSize: 11, color: '#6b7280', marginTop: 3 },
  messageBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#16a34a', marginHorizontal: 16, marginTop: 24,
    paddingVertical: 14, borderRadius: 12,
  },
  messageBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  privateNote: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginTop: 16, padding: 12,
    backgroundColor: '#f3f4f6', borderRadius: 10,
  },
  privateNoteText: { color: '#6b7280', fontSize: 13 },
});
