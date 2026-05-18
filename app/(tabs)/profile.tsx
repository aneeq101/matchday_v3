import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Switch,
  StatusBar,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const MY_SPORTS = [
  { name: 'Football', skill: 'Advanced', emoji: '⚽' },
  { name: 'Cricket', skill: 'Beginner', emoji: '🏏' },
];

const SKILL_COLORS: Record<string, string> = {
  Beginner: '#3b82f6',
  Intermediate: '#f59e0b',
  Advanced: '#ef4444',
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
  const [showVisibilityModal, setShowVisibilityModal] = useState(false);
  const [showMessagesFromModal, setShowMessagesFromModal] = useState(false);
  const [profileVisibility, setProfileVisibility] = useState<'Public' | 'Friends Only'>('Public');
  const [allowMessages, setAllowMessages] = useState(true);
  const [messagesFrom, setMessagesFrom] = useState({ male: true, female: true, undisclosed: true });
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

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
      <StatusBar barStyle="light-content" backgroundColor="#16a34a" />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.profileHeader}>
          <SafeAreaView>
            <View style={styles.headerTop}>
              <Text style={styles.headerTitle}>Profile</Text>
              <TouchableOpacity onPress={() => router.push('/messages')}>
                <Ionicons name="chatbubbles-outline" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <View style={styles.avatarSection}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarInitials}>AH</Text>
              </View>
              <Text style={styles.profileName}>Ali Hassan</Text>
              <View style={styles.locationRow}>
                <Ionicons name="location-outline" size={14} color="rgba(255,255,255,0.8)" />
                <Text style={styles.profileLocation}>Model Town, Lahore</Text>
              </View>
            </View>
          </SafeAreaView>
        </View>

        {/* Stats Card (overlapping header) */}
        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <Text style={styles.statNum}>47</Text>
            <Text style={styles.statLbl}>Matches</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNum}>32</Text>
            <Text style={styles.statLbl}>Wins</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statNum, { color: '#f59e0b' }]}>Gold</Text>
            <Text style={styles.statLbl}>Rank</Text>
          </View>
        </View>

        {/* My Sports */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My Sports</Text>
            <TouchableOpacity style={styles.addSportBtn}>
              <Ionicons name="add" size={18} color="#16a34a" />
              <Text style={styles.addSportText}>Add Sport</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.sportsGrid}>
            {MY_SPORTS.map((s, i) => (
              <View key={i} style={styles.sportCard}>
                <Text style={styles.sportEmoji}>{s.emoji}</Text>
                <Text style={styles.sportName}>{s.name}</Text>
                <View style={[styles.skillBadge, { backgroundColor: SKILL_COLORS[s.skill] }]}>
                  <Text style={styles.skillBadgeText}>{s.skill}</Text>
                </View>
              </View>
            ))}
            <TouchableOpacity style={styles.addSportCard}>
              <Ionicons name="add" size={28} color="#d1d5db" />
              <Text style={styles.addSportCardText}>Add</Text>
            </TouchableOpacity>
          </View>
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
              <TouchableOpacity style={styles.logoutConfirmBtn} onPress={() => setShowLogoutConfirm(false)}>
                <Text style={styles.logoutConfirmText}>Logout</Text>
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
  scroll: { flex: 1 },
  content: { paddingBottom: 32 },
  profileHeader: {
    backgroundColor: '#16a34a',
    paddingBottom: 48,
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
  },
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
});
