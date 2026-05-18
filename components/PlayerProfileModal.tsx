import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Player } from '../data/mockData';

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

export default function PlayerProfileModal({ player, onClose, onMessage }: Props) {
  if (!player) return null;

  return (
    <Modal visible={!!player} animationType="slide" transparent>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.container}>
          <View style={styles.handle} />

          {/* Header */}
          <View style={[styles.profileHeader, { backgroundColor: player.avatarColor }]}>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={22} color="#fff" />
            </TouchableOpacity>
            <View style={styles.avatarLg}>
              <Text style={styles.avatarInitialsLg}>{player.initials}</Text>
            </View>
            <Text style={styles.profileName}>{player.name}</Text>
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={14} color="rgba(255,255,255,0.85)" />
              <Text style={styles.profileLocation}>{player.area}, Lahore</Text>
            </View>
            <View style={styles.joinRow}>
              <Ionicons name="calendar-outline" size={12} color="rgba(255,255,255,0.7)" />
              <Text style={styles.joinText}>Member since {player.joinDate}</Text>
            </View>
          </View>

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            {/* Stats */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statNum}>{player.stats.matches}</Text>
                <Text style={styles.statLbl}>Matches</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNum}>{player.stats.wins}</Text>
                <Text style={styles.statLbl}>Wins</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={[styles.statNum, { color: '#f59e0b' }]}>{player.stats.rank}</Text>
                <Text style={styles.statLbl}>Rank</Text>
              </View>
            </View>

            {/* Privacy */}
            {player.privacy === 'private' && (
              <View style={styles.privacyBadge}>
                <Ionicons name="lock-closed" size={14} color="#6b7280" />
                <Text style={styles.privacyText}>Private Profile</Text>
              </View>
            )}

            {/* Bio */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About</Text>
              <Text style={styles.bioText}>{player.bio}</Text>
            </View>

            {/* Sports */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Sports & Skills</Text>
              <View style={styles.sportsGrid}>
                {player.sports.map((s, i) => (
                  <View key={i} style={styles.sportCard}>
                    <Text style={styles.sportEmoji}>{s.emoji}</Text>
                    <Text style={styles.sportName}>{s.name}</Text>
                    <View style={[styles.skillBadge, { backgroundColor: SKILL_COLORS[s.skill] }]}>
                      <Text style={styles.skillBadgeText}>{s.skill}</Text>
                    </View>
                  </View>
                ))}
              </View>
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
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#d1d5db',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 0,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    position: 'relative',
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  avatarInitialsLg: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
  },
  profileName: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    marginTop: 12,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  profileLocation: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
  },
  joinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  joinText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
  },
  scroll: {
    flex: 1,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNum: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
  },
  statLbl: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#e5e7eb',
  },
  privacyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f3f4f6',
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  privacyText: {
    color: '#6b7280',
    fontSize: 13,
  },
  section: {
    marginHorizontal: 16,
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 10,
  },
  bioText: {
    color: '#6b7280',
    fontSize: 14,
    lineHeight: 22,
  },
  sportsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  sportCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    minWidth: 100,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  sportEmoji: {
    fontSize: 28,
    marginBottom: 6,
  },
  sportName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 6,
  },
  skillBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  skillBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  messageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#16a34a',
    marginHorizontal: 16,
    marginTop: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  messageBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  privateNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 12,
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
  },
  privateNoteText: {
    color: '#6b7280',
    fontSize: 13,
  },
});
