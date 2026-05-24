import React, { useEffect } from 'react';
import { Stack, router, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../lib/AuthContext';

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
