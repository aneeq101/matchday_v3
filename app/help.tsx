import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, TextInput,
  ActivityIndicator, Platform, KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../lib/AuthContext';
import { submitSupportTicket, fetchMyTickets, type SupportTicket } from '../lib/support';

const FAQS: { q: string; a: string }[] = [
  {
    q: 'How do I book a venue?',
    a: 'Go to the Book tab, pick a sport, choose a venue from the list or map, then tap Book. Pick a date, time slot and duration, and confirm. Your booking shows up in My Turf.',
  },
  {
    q: 'How do I pay for a booking or tournament?',
    a: 'For now, payment is made at the venue on the day. Online payments are coming soon.',
  },
  {
    q: 'How do I cancel a booking?',
    a: 'Open My Turf, tap the booking, then tap Cancel Booking.',
  },
  {
    q: 'How do I organize or join a match?',
    a: 'In My Turf, tap Organize to create a match. Other players see it under Open Matches Near You and can join with one tap.',
  },
  {
    q: 'How do teams work?',
    a: 'Open My Teams from My Turf or your Profile. Create a team, then add players, or join an open team from Discover Teams. The captain can edit the team and remove players.',
  },
  {
    q: 'Why can’t I see players near me?',
    a: 'Allow location access for MatchDay. Players only appear if they are within your chosen radius and have "Show me in Nearby Players" turned on.',
  },
  {
    q: 'How do I stop people from messaging me?',
    a: 'On your Profile tab, under Privacy & Messaging, turn off Allow Messages or choose who can message you.',
  },
  {
    q: 'How do I record my stats?',
    a: 'On your Profile tab, add a sport, then tap "Record your stats". See everything together under My Statistics.',
  },
];

const CATEGORIES = ['General', 'Booking', 'Account', 'Bug Report', 'Feedback'];

function formatDate(iso: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function HelpScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [open, setOpen]         = useState<number | null>(null);
  const [category, setCategory] = useState('General');
  const [message, setMessage]   = useState('');
  const [sending, setSending]   = useState(false);
  const [error, setError]       = useState('');
  const [sent, setSent]         = useState(false);
  const [tickets, setTickets]   = useState<SupportTicket[]>([]);

  const loadTickets = useCallback(async () => {
    if (!user) return;
    setTickets(await fetchMyTickets(user.id));
  }, [user]);

  useEffect(() => { loadTickets(); }, [loadTickets]);

  const send = async () => {
    if (!user) return;
    if (message.trim().length < 10) { setError('Please describe your issue (at least 10 characters).'); return; }
    setError('');
    setSending(true);
    const ok = await submitSupportTicket({ userId: user.id, email: user.email ?? '', category, message });
    setSending(false);
    if (!ok) { setError('Could not send your message. Please check your connection and try again.'); return; }
    setMessage('');
    setSent(true);
    loadTickets();
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#16a34a" />
      <SafeAreaView style={styles.header} edges={['top']}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help & Support</Text>
      </SafeAreaView>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
          <View style={styles.card}>
            {FAQS.map((f, i) => (
              <View key={f.q} style={i > 0 && styles.divider}>
                <TouchableOpacity style={styles.faqRow} onPress={() => setOpen(open === i ? null : i)}>
                  <Text style={styles.faqQ}>{f.q}</Text>
                  <Ionicons name={open === i ? 'chevron-up' : 'chevron-down'} size={18} color="#9ca3af" />
                </TouchableOpacity>
                {open === i && <Text style={styles.faqA}>{f.a}</Text>}
              </View>
            ))}
          </View>

          <Text style={styles.sectionTitle}>Contact Us</Text>
          <View style={[styles.card, { padding: 14 }]}>
            {sent ? (
              <View style={styles.sentBox}>
                <Ionicons name="checkmark-circle" size={40} color="#16a34a" />
                <Text style={styles.sentTitle}>Message sent</Text>
                <Text style={styles.sentSub}>We'll reply to {user?.email ?? 'your email'} as soon as we can.</Text>
                <TouchableOpacity onPress={() => setSent(false)}>
                  <Text style={styles.link}>Send another message</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <Text style={styles.label}>What's it about?</Text>
                <View style={styles.chips}>
                  {CATEGORIES.map((c) => (
                    <TouchableOpacity
                      key={c}
                      style={[styles.chip, category === c && styles.chipActive]}
                      onPress={() => setCategory(c)}
                    >
                      <Text style={[styles.chipText, category === c && { color: '#fff' }]}>{c}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.label}>Message</Text>
                <TextInput
                  style={styles.input}
                  value={message}
                  onChangeText={setMessage}
                  placeholder="Tell us what happened or what you need help with"
                  placeholderTextColor="#9ca3af"
                  multiline
                  maxLength={1000}
                  textAlignVertical="top"
                />
                {!!error && <Text style={styles.error}>{error}</Text>}
                <TouchableOpacity style={styles.sendBtn} onPress={send} disabled={sending}>
                  {sending ? <ActivityIndicator color="#fff" /> : (
                    <>
                      <Ionicons name="send" size={16} color="#fff" />
                      <Text style={styles.sendText}>Send</Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>

          {tickets.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Your Requests</Text>
              <View style={styles.card}>
                {tickets.map((t, i) => (
                  <View key={t.id} style={[styles.ticketRow, i > 0 && styles.divider]}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.ticketCat}>{t.category} · {formatDate(t.createdAt)}</Text>
                      <Text style={styles.ticketMsg} numberOfLines={2}>{t.message}</Text>
                    </View>
                    <View style={[styles.statusPill, t.status !== 'open' && { backgroundColor: '#dcfce7' }]}>
                      <Text style={[styles.statusText, t.status !== 'open' && { color: '#16a34a' }]}>
                        {t.status === 'open' ? 'Open' : 'Resolved'}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </>
          )}

          <Text style={styles.version}>MatchDay · Version 1.0.0</Text>
        </ScrollView>
      </KeyboardAvoidingView>
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
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 8, marginTop: 8 },
  card: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#e5e7eb', overflow: 'hidden', marginBottom: 12 },
  divider: { borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  faqRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  faqQ: { flex: 1, fontSize: 14, fontWeight: '600', color: '#111827' },
  faqA: { fontSize: 14, color: '#4b5563', lineHeight: 20, paddingHorizontal: 14, paddingBottom: 14 },
  label: { fontWeight: '700', color: '#111827', fontSize: 14, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#f9fafb' },
  chipActive: { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  chipText: { color: '#374151', fontSize: 13, fontWeight: '500' },
  input: {
    backgroundColor: '#f9fafb', borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb',
    padding: 12, fontSize: 15, color: '#111827', minHeight: 110, marginBottom: 10,
  },
  error: { color: '#dc2626', fontSize: 13, marginBottom: 10 },
  sendBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#16a34a', paddingVertical: 13, borderRadius: 10,
  },
  sendText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  sentBox: { alignItems: 'center', gap: 6, paddingVertical: 10 },
  sentTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  sentSub: { fontSize: 13, color: '#6b7280', textAlign: 'center' },
  link: { color: '#16a34a', fontWeight: '600', marginTop: 6 },
  ticketRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  ticketCat: { fontSize: 12, color: '#6b7280', fontWeight: '600' },
  ticketMsg: { fontSize: 14, color: '#111827', marginTop: 2 },
  statusPill: { backgroundColor: '#fef3c7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusText: { color: '#b45309', fontSize: 11, fontWeight: '700' },
  version: { textAlign: 'center', color: '#9ca3af', fontSize: 12, marginTop: 12 },
});
