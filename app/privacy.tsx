import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, Switch,
  ActivityIndicator, Platform, Alert, Modal, TextInput, KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import { unregisterPush } from '../lib/push';
import {
  fetchSettings, saveSettings, changePassword, deleteMyAccount, EVENT_ALERT_RADII,
  DEFAULT_SETTINGS, type UserSettings,
} from '../lib/settings';

export default function PrivacyScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading]   = useState(true);

  const [showPassword, setShowPassword] = useState(false);
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  const [showDelete, setShowDelete] = useState(false);
  const [deleteText, setDeleteText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const provider = (user?.app_metadata?.provider as string | undefined) ?? 'email';
  const isEmailUser = provider === 'email';

  useEffect(() => {
    if (!user) return;
    fetchSettings(user.id).then((s) => { setSettings(s); setLoading(false); });
  }, [user]);

  const toggle = async (key: 'showInNearby' | 'pushEnabled' | 'eventAlerts', value: boolean) => {
    if (!user) return;
    setSettings((prev) => ({ ...prev, [key]: value }));
    const ok = await saveSettings(user.id, { [key]: value });
    if (!ok) {
      setSettings((prev) => ({ ...prev, [key]: !value }));
      Alert.alert('Not saved', 'Could not save your setting. Please try again.');
    }
  };

  const setRadius = async (km: number) => {
    if (!user) return;
    const prevKm = settings.eventAlertRadiusKm;
    setSettings((prev) => ({ ...prev, eventAlertRadiusKm: km }));
    const ok = await saveSettings(user.id, { eventAlertRadiusKm: km });
    if (!ok) {
      setSettings((prev) => ({ ...prev, eventAlertRadiusKm: prevKm }));
      Alert.alert('Not saved', 'Could not save your setting. Please try again.');
    }
  };

  const submitPassword = async () => {
    if (pw1.length < 6) { setPwError('Password must be at least 6 characters.'); return; }
    if (pw1 !== pw2)    { setPwError('Passwords do not match.'); return; }
    setPwError('');
    setPwSaving(true);
    const res = await changePassword(pw1);
    setPwSaving(false);
    if (!res.ok) { setPwError(res.error ?? 'Could not change password.'); return; }
    setShowPassword(false);
    setPw1(''); setPw2('');
    Alert.alert('Password updated', 'Your new password is saved.');
  };

  const [showSignOutAll, setShowSignOutAll] = useState(false);

  const submitDelete = async () => {
    setDeleting(true);
    const ok = await deleteMyAccount();
    setDeleting(false);
    if (!ok) {
      Alert.alert('Error', 'Could not delete your account. Please try again or contact support.');
      return;
    }
    setShowDelete(false);
    // Signed out — the root layout redirects to sign-in automatically
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#16a34a" />
      <SafeAreaView style={styles.header} edges={['top']}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy & Security</Text>
      </SafeAreaView>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#16a34a" /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          <Text style={styles.sectionTitle}>Privacy</Text>
          <View style={styles.card}>
            <Row
              icon="location-outline"
              title="Show me in Nearby Players"
              sub={settings.showInNearby ? 'Players near you can find you' : 'Hidden from nearby search'}
              right={
                <Switch
                  value={settings.showInNearby}
                  onValueChange={(v) => toggle('showInNearby', v)}
                  trackColor={{ false: '#d1d5db', true: '#86efac' }}
                  thumbColor={settings.showInNearby ? '#16a34a' : '#9ca3af'}
                />
              }
            />
            <View style={styles.divider} />
            <Row
              icon="notifications-outline"
              title="Push Notifications"
              sub={settings.pushEnabled ? 'Alerts on your phone for messages, joins and invites' : 'Only shown inside the app'}
              right={
                <Switch
                  value={settings.pushEnabled}
                  onValueChange={(v) => toggle('pushEnabled', v)}
                  trackColor={{ false: '#d1d5db', true: '#86efac' }}
                  thumbColor={settings.pushEnabled ? '#16a34a' : '#9ca3af'}
                />
              }
            />
            <View style={styles.divider} />
            <Row
              icon="trophy-outline"
              title="Nearby Event Alerts"
              sub={settings.eventAlerts
                ? `New tournaments, leagues and paid matches within ${settings.eventAlertRadiusKm} km, for the sports on your profile`
                : 'Off — you won’t be told about new events near you'}
              right={
                <Switch
                  value={settings.eventAlerts}
                  onValueChange={(v) => toggle('eventAlerts', v)}
                  trackColor={{ false: '#d1d5db', true: '#86efac' }}
                  thumbColor={settings.eventAlerts ? '#16a34a' : '#9ca3af'}
                />
              }
            />
            {settings.eventAlerts && (
              <View style={styles.radiusRow}>
                <Text style={styles.radiusLabel}>Alert radius</Text>
                {EVENT_ALERT_RADII.map((km) => (
                  <TouchableOpacity
                    key={km}
                    style={[styles.radiusChip, settings.eventAlertRadiusKm === km && styles.radiusChipOn]}
                    onPress={() => setRadius(km)}
                  >
                    <Text style={[styles.radiusText, settings.eventAlertRadiusKm === km && styles.radiusTextOn]}>{km} km</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
          <Text style={styles.hint}>
            Event alerts use the location saved when you open The Hood, at most 3 a day. Profile visibility and who can message you are under Privacy & Messaging on your Profile tab.
          </Text>

          <Text style={styles.sectionTitle}>Security</Text>
          <View style={styles.card}>
            {isEmailUser ? (
              <TouchableOpacity onPress={() => { setPwError(''); setShowPassword(true); }}>
                <Row icon="key-outline" title="Change Password" sub={user?.email ?? ''} chevron />
              </TouchableOpacity>
            ) : (
              <Row
                icon="logo-google"
                title="Signed in with Google"
                sub="Your password is managed by your Google account"
              />
            )}
            <View style={styles.divider} />
            <TouchableOpacity onPress={() => setShowSignOutAll(true)}>
              <Row icon="phone-portrait-outline" title="Sign out of all devices" chevron />
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionTitle}>Danger Zone</Text>
          <TouchableOpacity style={styles.deleteBtn} onPress={() => { setDeleteText(''); setShowDelete(true); }}>
            <Ionicons name="trash-outline" size={18} color="#ef4444" />
            <Text style={styles.deleteText}>Delete My Account</Text>
          </TouchableOpacity>
          <Text style={styles.hint}>
            Permanently removes your profile, bookings, posts, teams and stats.
          </Text>
        </ScrollView>
      )}

      {/* Change password */}
      <Modal visible={showPassword} animationType="fade" transparent onRequestClose={() => setShowPassword(false)}>
        <KeyboardAvoidingView style={styles.centerOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.alertBox}>
            <Text style={styles.alertTitle}>Change Password</Text>
            <TextInput
              style={styles.input}
              value={pw1}
              onChangeText={setPw1}
              placeholder="New password"
              placeholderTextColor="#9ca3af"
              secureTextEntry
              autoCapitalize="none"
            />
            <TextInput
              style={styles.input}
              value={pw2}
              onChangeText={setPw2}
              placeholder="Confirm new password"
              placeholderTextColor="#9ca3af"
              secureTextEntry
              autoCapitalize="none"
            />
            {!!pwError && <Text style={styles.errorText}>{pwError}</Text>}
            <View style={styles.twoBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowPassword(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.greenBtn} onPress={submitPassword} disabled={pwSaving}>
                {pwSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Sign out everywhere */}
      <Modal visible={showSignOutAll} animationType="fade" transparent onRequestClose={() => setShowSignOutAll(false)}>
        <View style={styles.centerOverlay}>
          <View style={styles.alertBox}>
            <Ionicons name="phone-portrait-outline" size={36} color="#16a34a" />
            <Text style={styles.alertTitle}>Sign out everywhere?</Text>
            <Text style={styles.alertBody}>You'll be signed out on all your devices, including this one.</Text>
            <View style={styles.twoBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowSignOutAll(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.redBtn}
                onPress={async () => {
                  setShowSignOutAll(false);
                  if (user) await unregisterPush(user.id).catch(() => {});
                  await supabase.auth.signOut({ scope: 'global' });
                }}
              >
                <Text style={styles.btnText}>Sign out</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete account */}
      <Modal visible={showDelete} animationType="fade" transparent onRequestClose={() => setShowDelete(false)}>
        <KeyboardAvoidingView style={styles.centerOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.alertBox}>
            <Ionicons name="warning-outline" size={40} color="#ef4444" />
            <Text style={styles.alertTitle}>Delete account?</Text>
            <Text style={styles.alertBody}>
              This can't be undone. Type DELETE to confirm.
            </Text>
            <TextInput
              style={styles.input}
              value={deleteText}
              onChangeText={setDeleteText}
              placeholder="DELETE"
              placeholderTextColor="#9ca3af"
              autoCapitalize="characters"
            />
            <View style={styles.twoBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowDelete(false)} disabled={deleting}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.redBtn, deleteText.trim() !== 'DELETE' && { opacity: 0.4 }]}
                onPress={submitDelete}
                disabled={deleteText.trim() !== 'DELETE' || deleting}
              >
                {deleting ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Delete</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function Row({ icon, title, sub, right, chevron }: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  sub?: string;
  right?: React.ReactNode;
  chevron?: boolean;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}><Ionicons name={icon} size={19} color="#374151" /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        {!!sub && <Text style={styles.rowSub}>{sub}</Text>}
      </View>
      {right}
      {chevron && <Ionicons name="chevron-forward" size={18} color="#9ca3af" />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f3f4f6' },
  header: {
    backgroundColor: '#16a34a', flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingTop: Platform.OS === 'android' ? 8 : 4, paddingBottom: 12, gap: 10,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, color: '#fff', fontSize: 18, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { padding: 16, paddingBottom: 40 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 8, marginTop: 8 },
  card: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#e5e7eb', overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  rowIcon: { width: 34, height: 34, borderRadius: 9, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 15, fontWeight: '600', color: '#111827' },
  rowSub: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  divider: { height: 1, backgroundColor: '#f3f4f6', marginLeft: 14 },
  radiusRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, paddingHorizontal: 14, paddingBottom: 14 },
  radiusLabel: { fontSize: 12, color: '#6b7280', fontWeight: '600', marginRight: 4 },
  radiusChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#f9fafb' },
  radiusChipOn: { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  radiusText: { fontSize: 12, fontWeight: '600', color: '#374151' },
  radiusTextOn: { color: '#fff' },
  hint: { fontSize: 12, color: '#9ca3af', marginTop: 8, marginBottom: 12, lineHeight: 17 },
  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 13, borderRadius: 12, borderWidth: 1.5, borderColor: '#fecaca', backgroundColor: '#fff5f5',
  },
  deleteText: { color: '#ef4444', fontWeight: '700', fontSize: 15 },
  centerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  alertBox: { backgroundColor: '#fff', borderRadius: 20, padding: 22, width: '86%', maxWidth: 380, alignItems: 'center' },
  alertTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginVertical: 8 },
  alertBody: { fontSize: 14, color: '#6b7280', textAlign: 'center', marginBottom: 12 },
  input: {
    width: '100%', backgroundColor: '#f9fafb', borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb',
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#111827', marginBottom: 10,
  },
  errorText: { color: '#dc2626', fontSize: 13, marginBottom: 8, alignSelf: 'flex-start' },
  twoBtns: { flexDirection: 'row', gap: 10, width: '100%', marginTop: 4 },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#e5e7eb' },
  cancelText: { color: '#6b7280', fontWeight: '600' },
  greenBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', backgroundColor: '#16a34a' },
  redBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', backgroundColor: '#ef4444' },
  btnText: { color: '#fff', fontWeight: '700' },
});
