import React, { useEffect } from 'react';
import { Stack, router, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import { AuthProvider, useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';

function RootNavigator() {
  const { session, loading } = useAuth();
  const segments = useSegments();

  // Redirect based on auth state
  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!session && !inAuthGroup) {
      router.replace('/(auth)/sign-in');
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [session, loading, segments]);

  // Handle OAuth deep-link callback (Google sign-in returns here)
  useEffect(() => {
    const subscription = Linking.addEventListener('url', ({ url }) => {
      if (url.includes('code=') || url.includes('access_token')) {
        supabase.auth.exchangeCodeForSession(url).catch(() => {});
      }
    });
    return () => subscription.remove();
  }, []);

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
