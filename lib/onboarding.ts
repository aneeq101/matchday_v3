import type { User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { fetchMySports } from './profile';

// First-run welcome flow (app/welcome.tsx).
// Shown once, automatically, to signed-in users who haven't added any sports.
// "Seen" is stored on the auth account (user_metadata.onboarding_done), so it
// follows the user across devices and needs no database table. Opening the
// flow marks it seen — skipping or closing it never brings it back by itself;
// the Profile tab offers a "Set up my sports" button instead.

// One check per user per app session; repeated calls share the same answer
// (effects can run twice in development).
const checks = new Map<string, Promise<boolean>>();
let opened = false;

export function shouldShowWelcome(user: User): Promise<boolean> {
  let p = checks.get(user.id);
  if (!p) {
    p = (async () => {
      if (user.user_metadata?.onboarding_done) return false;
      const sports = await fetchMySports(user.id);
      if (sports.length > 0) {
        markWelcomeSeen().catch(() => {});   // existing players: never show it
        return false;
      }
      return true;
    })();
    checks.set(user.id, p);
  }
  return p;
}

/** True the first time only — so the flow is opened at most once per session. */
export function claimWelcomeOpen(): boolean {
  if (opened) return false;
  opened = true;
  return true;
}

export async function markWelcomeSeen(): Promise<void> {
  await supabase.auth.updateUser({ data: { onboarding_done: true } });
}
