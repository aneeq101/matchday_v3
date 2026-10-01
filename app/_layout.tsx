import React, { useEffect } from 'react';
import { Stack, router, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../lib/AuthContext';
import { registerForPush, setupNotificationHandlers } from '../lib/push';
import { shouldShowWelcome, claimWelcomeOpen } from '../lib/onboarding';
import InAppPopups from '../components/InAppPopups';

function RootNavigator() {
  const { session, loading } = useAuth();
  const segments = useSegments();

  // Redirect based on auth state.
  // Treat both '(auth)' and 'auth' (the auth/callback route) as the auth flow
  // so we don't bounce the user to sign-in mid-exchange.
  useEffect(() => {
    if (loading) return;
    const inAuthFlow = segments[0] === '(auth)' || segments[0] === 'auth';
    if (!session && !inAuthFlow) {
      router.replace('/(auth)/sign-in');
    } else if (session && inAuthFlow) {
      router.replace('/(tabs)');
    }
  }, [session, loading, segments]);

  // First run: once the user is inside the app, offer the sports welcome flow
  // (only if they have no sports yet; shown at most once — see lib/onboarding.ts)
  const inTabs = segments[0] === '(tabs)';
  useEffect(() => {
    if (!session?.user || !inTabs) return;
    let cancelled = false;
    shouldShowWelcome(session.user).then((show) => {
      if (show && !cancelled && claimWelcomeOpen()) router.push('/welcome');
    });
    return () => { cancelled = true; };
  }, [session?.user?.id, inTabs]);

  // Push notifications: register this device once signed in, route taps
  const userId = session?.user?.id;
  useEffect(() => {
    if (!userId) return;
    registerForPush(userId);
    let cleanup = () => {};
    setupNotificationHandlers((data) => {
      if (data.type === 'new_message') router.push('/messages');
      else if (typeof data.rating_request_id === 'string') router.push({ pathname: '/ratings', params: {
        kind: String(data.rate_kind ?? 'player'), id: String(data.rate_id ?? ''),
        name: String(data.rate_name ?? ''), rate: String(data.sport ?? ''),
      } });
      else if (typeof data.team_id === 'string') router.push({ pathname: '/team', params: { id: data.team_id } });
      else if (typeof data.tournament_id === 'string') router.push({ pathname: '/tournament', params: { id: data.tournament_id } });
      else if (typeof data.challenge_id === 'string') router.push('/challenges');
      else if (typeof data.rating_player_id === 'string') router.push({ pathname: '/ratings', params: { kind: 'player', id: data.rating_player_id } });
      else router.push('/notifications');
    }).then((c) => { cleanup = c; });
    return () => cleanup();
  }, [userId]);

  return (
    <>
    <Stack>
      <Stack.Screen name="(auth)"   options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)"   options={{ headerShown: false }} />
      <Stack.Screen
        name="messages"
        options={{
          title: 'Messages',
          headerStyle: { backgroundColor: '#16a34a' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '700' },
        }}
      />
      <Stack.Screen name="chat" options={{ headerShown: false }} />
      <Stack.Screen name="looking-now" options={{ headerShown: false }} />
      <Stack.Screen name="comments" options={{ headerShown: false }} />
      <Stack.Screen name="my-teams" options={{ headerShown: false }} />
      <Stack.Screen name="team" options={{ headerShown: false }} />
      <Stack.Screen name="statistics" options={{ headerShown: false }} />
      <Stack.Screen name="privacy" options={{ headerShown: false }} />
      <Stack.Screen name="help" options={{ headerShown: false }} />
      <Stack.Screen name="tournament" options={{ headerShown: false }} />
      <Stack.Screen name="challenges" options={{ headerShown: false }} />
      <Stack.Screen name="ratings" options={{ headerShown: false }} />
      <Stack.Screen name="welcome" options={{ headerShown: false, presentation: 'modal' }} />
      <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
    </Stack>
    {/* Challenges, rating requests, new ratings and badges pop up over any screen */}
    {userId && <InAppPopups userId={userId} />}
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
