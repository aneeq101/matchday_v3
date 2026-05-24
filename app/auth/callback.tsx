import * as WebBrowser from 'expo-web-browser';
import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { exchangeOnce } from '../../lib/supabase';

// Signals the in-app browser session to close on iOS.
WebBrowser.maybeCompleteAuthSession();

export default function AuthCallback() {
  // expo-router extracts ?code= from the deep link URL into params.
  // On Android: Chrome Custom Tab closes, OS routes exp://... to Expo Go,
  // expo-router navigates here with the code as a query param.
  const { code } = useLocalSearchParams<{ code?: string }>();

  useEffect(() => {
    if (!code) {
      // No code in the URL — something went wrong upstream.
      router.replace('/(auth)/sign-in');
      return;
    }

    exchangeOnce(code)
      .then(({ error }) => {
        if (error) {
          Alert.alert('Sign-in failed', error.message, [
            { text: 'OK', onPress: () => router.replace('/(auth)/sign-in') },
          ]);
        } else {
          // Navigate immediately — don't wait for onAuthStateChange.
          router.replace('/(tabs)');
        }
      })
      .catch(() => router.replace('/(auth)/sign-in'));
  }, [code]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#16a34a" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
});
