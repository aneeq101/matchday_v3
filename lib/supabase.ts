import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const supabaseUrl  = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// expo-secure-store is native only; fall back to memory/localStorage on web
const storage = Platform.OS === 'web'
  ? undefined
  : {
      getItem:    (key: string) => SecureStore.getItemAsync(key),
      setItem:    (key: string, value: string) => SecureStore.setItemAsync(key, value),
      removeItem: (key: string) => SecureStore.deleteItemAsync(key),
    };

export const supabase = createClient(supabaseUrl, supabaseAnon, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession:   true,
    // Force PKCE so the OAuth redirect returns ?code= (not #access_token=).
    // Without this, Supabase defaults to implicit flow and exchangeCodeForSession
    // fails because there is no code in the redirect URL.
    flowType: 'pkce',
    // On web, Supabase auto-exchanges the ?code= from the redirect URL.
    // On native we call exchangeOnce() manually after openAuthSessionAsync.
    detectSessionInUrl: Platform.OS === 'web',
  },
});

// Dedup guard — PKCE code verifier is deleted after first exchange,
// so calling exchangeCodeForSession twice for the same code causes the
// "both auth code and code verifier should be non empty" error.
const _exchangedCodes = new Set<string>();

export async function exchangeOnce(codeOrUrl: string): Promise<{ error: Error | null }> {
  let code: string;
  try {
    code = new URL(codeOrUrl).searchParams.get('code') ?? codeOrUrl;
  } catch {
    code = codeOrUrl;
  }
  if (!code || _exchangedCodes.has(code)) return { error: null };
  _exchangedCodes.add(code);
  const { error } = await supabase.auth.exchangeCodeForSession(codeOrUrl);
  if (error) _exchangedCodes.delete(code);
  return { error: error as Error | null };
}
