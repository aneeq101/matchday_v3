import React, { useEffect } from 'react';
import { Stack, router, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../lib/AuthContext';
import { registerForPush, setupNotificationHandlers } from '../lib/push';

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

  // Push notifications: register this device once signed in, route taps
  const userId = session?.user?.id;
  useEffect(() => {
    if (!userId) return;
    registerForPush(userId);
    let cleanup = () => {};
    setupNotificationHandlers((data) => {
      if (data.type === 'new_message') router.push('/messages');
      else if (typeof data.team_id === 'string') router.push({ pathname: '/team', params: { id: data.team_id } });
      else router.push('/notifications');
    }).then((c) => { cleanup = c; });
    return () => cleanup();
  }, [userId]);

  return (
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
      <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
    </Stack>
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
