import { supabase } from './supabase';

export interface MessagesFrom {
  male: boolean;
  female: boolean;
  undisclosed: boolean;
}

export interface UserSettings {
  privacy: 'public' | 'private';   // 'private' = Friends Only
  allowMessages: boolean;
  messagesFrom: MessagesFrom;
  showInNearby: boolean;
  pushEnabled: boolean;
}

export const DEFAULT_SETTINGS: UserSettings = {
  privacy: 'public',
  allowMessages: true,
  messagesFrom: { male: true, female: true, undisclosed: true },
  showInNearby: true,
  pushEnabled: true,
};

export async function fetchSettings(userId: string): Promise<UserSettings> {
  const { data, error } = await supabase
    .from('profiles')
    .select('privacy, allow_messages, messages_from, show_in_nearby, push_enabled')
    .eq('id', userId)
    .single();
  if (error || !data) return DEFAULT_SETTINGS;
  const row = data as Record<string, unknown>;
  const mf = (row.messages_from as Partial<MessagesFrom> | null) ?? {};
  return {
    privacy: row.privacy === 'private' ? 'private' : 'public',
    allowMessages: (row.allow_messages as boolean) ?? true,
    messagesFrom: {
      male: mf.male ?? true,
      female: mf.female ?? true,
      undisclosed: mf.undisclosed ?? true,
    },
    showInNearby: (row.show_in_nearby as boolean) ?? true,
    pushEnabled: (row.push_enabled as boolean) ?? true,
  };
}

export async function saveSettings(userId: string, patch: Partial<UserSettings>): Promise<boolean> {
  const row: Record<string, unknown> = {};
  if (patch.privacy !== undefined)      row.privacy = patch.privacy;
  if (patch.allowMessages !== undefined) row.allow_messages = patch.allowMessages;
  if (patch.messagesFrom !== undefined)  row.messages_from = patch.messagesFrom;
  if (patch.showInNearby !== undefined)  row.show_in_nearby = patch.showInNearby;
  if (patch.pushEnabled !== undefined)   row.push_enabled = patch.pushEnabled;
  if (!Object.keys(row).length) return true;
  const { error } = await supabase.from('profiles').update(row).eq('id', userId);
  return !error;
}

export async function saveMyLocation(userId: string, latitude: number, longitude: number): Promise<void> {
  await supabase
    .from('profiles')
    .update({ latitude, longitude, location_updated_at: new Date().toISOString() })
    .eq('id', userId);
}

export async function changePassword(newPassword: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteMyAccount(): Promise<boolean> {
  const { error } = await supabase.rpc('delete_my_account');
  if (error) return false;
  await supabase.auth.signOut();
  return true;
}
