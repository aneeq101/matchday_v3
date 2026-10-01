import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { supabase } from './supabase';

// Push notifications flow:
//   1. registerForPush() asks permission, gets an Expo push token, saves it to push_tokens
//   2. Anything inserted into the `notifications` table fires a DB trigger
//      (lib/db/patch_phase4_complete.sql) that sends the push via Expo's push service.
//
// Not supported: web, and Expo Go on Android (removed by Expo in SDK 53+).
// Needs an EAS projectId in app.json (run `npx eas init` once) for real devices.

function pushUnsupported(): boolean {
  if (Platform.OS === 'web') return true;
  if (Platform.OS === 'android' && Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return true;
  return false;
}

function projectId(): string | undefined {
  return (
    (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ??
    Constants.easConfig?.projectId
  );
}

let handlerSet = false;

/** Shows notifications while the app is open and routes taps. Safe to call repeatedly. */
export async function setupNotificationHandlers(onTap: (data: Record<string, unknown>) => void): Promise<() => void> {
  if (pushUnsupported()) return () => {};
  try {
    const Notifications = await import('expo-notifications');
    if (!handlerSet) {
      Notifications.setNotificationHandler({
        handleNotification: async (n) => {
          // App is open: new challenges and challenge updates already appear as
          // in-app popups (components/ChallengePopup.tsx), so don't also show a banner.
          const type = (n.request.content.data as { type?: string } | undefined)?.type;
          const inAppPopup = type === 'challenge' || type === 'challenge_update';
          return {
            shouldShowBanner: !inAppPopup,
            shouldShowList: true,
            shouldPlaySound: !inAppPopup,
            shouldSetBadge: false,
          };
        },
      });
      handlerSet = true;
    }
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      onTap((response.notification.request.content.data ?? {}) as Record<string, unknown>);
    });
    return () => sub.remove();
  } catch {
    return () => {};
  }
}

/** Ask permission + store this device's push token on the user's profile. Silent on failure. */
export async function registerForPush(userId: string): Promise<void> {
  if (pushUnsupported()) return;
  try {
    const Device = await import('expo-device');
    if (!Device.isDevice) return;
    const Notifications = await import('expo-notifications');

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }

    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      ({ status } = await Notifications.requestPermissionsAsync());
    }
    if (status !== 'granted') return;

    const pid = projectId();
    if (!pid) {
      console.warn('[push] No EAS projectId — run `npx eas init` to enable push notifications.');
      return;
    }
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: pid });
    if (token) {
      // delete + insert (upsert is unreliable in this project — see Supabase patterns notes)
      await supabase.from('push_tokens').delete().eq('user_id', userId);
      await supabase.from('push_tokens').insert({ user_id: userId, token });
    }
  } catch (e) {
    console.warn('[push] registration skipped:', (e as Error)?.message);
  }
}

/** Clear the token so this device stops receiving pushes (e.g. on sign-out). */
export async function unregisterPush(userId: string): Promise<void> {
  await supabase.from('push_tokens').delete().eq('user_id', userId);
}
