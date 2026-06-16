import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, StatusBar, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../lib/AuthContext';
import { fetchMyProfile, updateProfile } from '../lib/profile';

export default function EditProfileScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [name, setName]   = useState('');
  const [bio, setBio]     = useState('');
  const [area, setArea]   = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    if (!user) return;
    // Pre-fill name from auth metadata while DB loads
    const authName =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email?.split('@')[0] || '';
    setName(authName);

    fetchMyProfile(user.id).then((p) => {
      if (p) {
        if (p.name) setName(p.name);
        setBio(p.bio);
        setArea(p.area);
      }
      setLoading(false);
    });
  }, [user]);

  const save = async () => {
    if (!user) return;
    if (!name.trim()) { Alert.alert('Name required', 'Please enter your display name.'); return; }
    setSaving(true);
    const ok = await updateProfile(user.id, { name, bio, area });
    setSaving(false);
    if (ok) {
      router.back();
    } else {
      Alert.alert('Error', 'Could not save profile. Please try again.');
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#16a34a" />
      <SafeAreaView style={styles.header} edges={['top']}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={saving}>
          {saving
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.saveBtnText}>Save</Text>}
        </TouchableOpacity>
      </SafeAreaView>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#16a34a" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <View style={styles.avatarSection}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarInitials}>
                {name.trim().split(' ').map((w) => w[0] ?? '').slice(0, 2).join('').toUpperCase() || '?'}
              </Text>
            </View>
          </View>

          <Text style={styles.fieldLabel}>Display Name *</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            placeholderTextColor="#9ca3af"
            maxLength={60}
          />

          <Text style={styles.fieldLabel}>Bio</Text>
          <TextInput
            style={[styles.input, styles.bioInput]}
            value={bio}
            onChangeText={setBio}
            placeholder="Tell others about yourself — sports you play, your style..."
            placeholderTextColor="#9ca3af"
            multiline
            maxLength={300}
            textAlignVertical="top"
          />
          <Text style={styles.charCount}>{bio.length}/300</Text>

          <Text style={styles.fieldLabel}>City / Area</Text>
          <TextInput
            style={styles.input}
            value={area}
            onChangeText={setArea}
            placeholder="e.g. Toronto, ON"
            placeholderTextColor="#9ca3af"
            maxLength={80}
          />

          <Text style={styles.hint}>Email cannot be changed here. Manage it in account settings.</Text>
        </ScrollView>
      )}
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
    paddingBottom: 12,
    gap: 10,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, color: '#fff', fontSize: 18, fontWeight: '700' },
  saveBtn: { paddingHorizontal: 14, paddingVertical: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 8 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { padding: 20, paddingBottom: 40 },
  avatarSection: { alignItems: 'center', marginBottom: 28 },
  avatarCircle: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: '#16a34a',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitials: { color: '#fff', fontSize: 30, fontWeight: '800' },
  fieldLabel: { fontWeight: '700', color: '#111827', fontSize: 14, marginBottom: 8 },
  input: {
    backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb',
    paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: '#111827', marginBottom: 20,
  },
  bioInput: { minHeight: 100, textAlignVertical: 'top', marginBottom: 4 },
  charCount: { color: '#9ca3af', fontSize: 11, textAlign: 'right', marginBottom: 20 },
  hint: { color: '#9ca3af', fontSize: 12, textAlign: 'center', marginTop: 12 },
});
