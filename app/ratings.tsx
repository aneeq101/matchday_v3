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
import AskRatingsModal from '../components/AskRatingsModal';
import { fetchIncomingRequest, declineRatingRequest, type IncomingRequest } from '../lib/ratingRequests';
import type { RatingTargetKind } from '../lib/ratingRules';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// All ratings & reviews for one player or team.
// /ratings?kind=player|team&id=<uuid>&name=<display name>[&rate=<sport>]
// `rate` (from a rating-request notification) opens the rating sheet for that sport.
export default function RatingsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ kind?: string; id?: string; name?: string; rate?: string }>();
  const kind: RatingTargetKind = params.kind === 'team' ? 'team' : 'player';
  const id = params.id ?? '';

  const [name, setName]       = useState(params.name ?? '');
  const [sports, setSports]   = useState<string[]>([]);
  const [canRate, setCanRate] = useState(false);
  const [ready, setReady]     = useState(false);
  const [isCaptain, setIsCaptain] = useState(false);
  const [showAsk, setShowAsk] = useState(false);
  const [request, setRequest] = useState<IncomingRequest | null>(null);
  const [rateNow, setRateNow] = useState<{ sport: string; n: number } | null>(null);
  const openRating = (sport: string) => setRateNow((prev) => ({ sport, n: (prev?.n ?? 0) + 1 }));

  useEffect(() => {
    if (!id || !UUID_RE.test(id)) { setReady(true); return; }
    (async () => {
      if (kind === 'team') {
        const [t, members] = await Promise.all([fetchTeam(id), fetchTeamMembers(id)]);
        if (t) { setName((n) => n || t.name); setSports([t.sport]); setIsCaptain(t.ownerId === user?.id); }
        setCanRate(!!user && !members.some((m) => m.userId === user.id));
      } else {
        const [sp, p] = await Promise.all([fetchMySports(id), params.name ? Promise.resolve(null) : fetchPlayer(id)]);
        if (p) setName(p.name);
        setSports(sp.map((s) => s.name));
        setCanRate(!!user && user.id !== id);
      }
      if (user) setRequest(await fetchIncomingRequest(user.id, id, params.rate));
      setReady(true);
    })();
  }, [id, kind, user?.id]);

  // Opened from "X asked you to rate them": go straight to the rating sheet
  useEffect(() => {
    if (ready && canRate && params.rate) openRating(params.rate);
  }, [ready, canRate, params.rate]);

  const isMe = kind === 'player' && user?.id === id;
  const canAsk = isMe || (kind === 'team' && isCaptain);

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
        {request && canRate && (
          <View style={styles.request}>
            <Ionicons name="star" size={18} color="#f59e0b" />
            <View style={{ flex: 1 }}>
              <Text style={styles.requestText}>
                {kind === 'team' ? `${name}’s captain asked` : `${name} asked`} you to rate their {request.sport} {kind === 'team' ? 'team' : 'game'}.
              </Text>
              {!!request.note && <Text style={styles.requestNote}>“{request.note}”</Text>}
              <View style={styles.requestBtns}>
                <TouchableOpacity style={styles.requestRate} onPress={() => openRating(request.sport)}>
                  <Text style={styles.requestRateText}>Rate now</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.requestLater}
                  onPress={() => { declineRatingRequest(request.id).catch(() => {}); setRequest(null); }}
                >
                  <Text style={styles.requestLaterText}>Not now</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
        {ready && id ? (
          <RatingsSection
            kind={kind}
            id={id}
            name={name || 'this player'}
            sports={sports}
            canRate={canRate}
            full
            onAsk={canAsk && sports.length ? () => setShowAsk(true) : undefined}
            autoRateSport={rateNow?.sport}
            autoRateKey={rateNow?.n}
            onRated={() => setRequest(null)}
          />
        ) : null}
        {isMe && ready && !sports.length && (
          <Text style={styles.noSports}>Add your sports on the Profile tab to ask players for ratings.</Text>
        )}
      </ScrollView>

      {canAsk && (
        <AskRatingsModal
          visible={showAsk}
          kind={kind}
          subjectId={id}
          subjectName={name}
          sports={sports}
          onClose={() => setShowAsk(false)}
        />
      )}
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
  request: {
    flexDirection: 'row', gap: 10, backgroundColor: '#fff', borderRadius: 14,
    borderWidth: 1, borderColor: '#fde68a', padding: 14, marginBottom: 16,
  },
  requestText: { fontSize: 14, color: '#111827', fontWeight: '600', lineHeight: 20 },
  requestNote: { fontSize: 13, color: '#6b7280', fontStyle: 'italic', marginTop: 4 },
  requestBtns: { flexDirection: 'row', gap: 10, marginTop: 10 },
  requestRate: { backgroundColor: '#16a34a', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 9 },
  requestRateText: { color: '#fff', fontWeight: '700' },
  requestLater: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: '#f3f4f6' },
  requestLaterText: { color: '#374151', fontWeight: '600' },
  noSports: { fontSize: 13, color: '#6b7280', textAlign: 'center', marginTop: 12 },
});
