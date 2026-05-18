import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
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
    </SafeAreaProvider>
  );
}
