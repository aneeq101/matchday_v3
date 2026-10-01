import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../lib/AuthContext';
import { fetchMySports } from '../lib/profile';
import { fetchTeam, fetchTeamMembers } from '../lib/teams';
import { fetchPlayer } from '../lib/players';
import RatingsSection from '../components/RatingsSection';
import type { RatingTargetKind } from '../lib/ratingRules';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// All ratings & reviews for one player or team.
// /ratings?kind=player|team&id=<uuid>&name=<display name>
export default function RatingsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ kind?: string; id?: string; name?: string }>();
  const kind: RatingTargetKind = params.kind === 'team' ? 'team' : 'player';
  const id = params.id ?? '';

  const [name, setName]       = useState(params.name ?? '');
  const [sports, setSports]   = useState<string[]>([]);
  const [canRate, setCanRate] = useState(false);
  const [ready, setReady]     = useState(false);

  useEffect(() => {
    if (!id || !UUID_RE.test(id)) { setReady(true); return; }
    (async () => {
      if (kind === 'team') {
        const [t, members] = await Promise.all([fetchTeam(id), fetchTeamMembers(id)]);
        if (t) { setName((n) => n || t.name); setSports([t.sport]); }
        setCanRate(!!user && !members.some((m) => m.userId === user.id));
      } else {
        const [sp, p] = await Promise.all([fetchMySports(id), params.name ? Promise.resolve(null) : fetchPlayer(id)]);
        if (p) setName(p.name);
        setSports(sp.map((s) => s.name));
        setCanRate(!!user && user.id !== id);
      }
      setReady(true);
    })();
  }, [id, kind, user?.id]);

  const isMe = kind === 'player' && user?.id === id;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#16a34a" />
      <SafeAreaView style={styles.header} edges={['top']}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} accessibilityLabel="Back">
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {isMe ? 'My Ratings & Badges' : name ? `${name} · Ratings` : 'Ratings'}
        </Text>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.body}>
        {isMe && (
          <View style={styles.tip}>
            <Ionicons name="bulb-outline" size={16} color="#a16207" />
            <Text style={styles.tipText}>
              Ratings come from players and teams you’ve played. Challenge people and join events to collect ratings and earn badges.
            </Text>
          </View>
        )}
        {ready && id ? (
          <RatingsSection kind={kind} id={id} name={name || 'this player'} sports={sports} canRate={canRate} full />
        ) : null}
      </ScrollView>
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
  body: { padding: 16, paddingBottom: 40 },
  tip: {
    flexDirection: 'row', gap: 8, backgroundColor: '#fefce8', borderRadius: 12,
    borderWidth: 1, borderColor: '#fde68a', padding: 12, marginBottom: 16,
  },
  tipText: { flex: 1, fontSize: 13, color: '#713f12', lineHeight: 18 },
});
