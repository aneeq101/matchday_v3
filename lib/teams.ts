import { supabase } from './supabase';

export interface Team {
  id: string;
  name: string;
  sport: string;
  description: string;
  area: string;
  ownerId: string;
  isOpen: boolean;
  maxMembers: number;
  memberCount: number;
  format: string;
}

export interface TeamMember {
  userId: string;
  role: 'captain' | 'member';
  name: string;
  initials: string;
  avatarColor: string;
  avatarUrl?: string;
}

function rowToTeam(row: Record<string, unknown>): Team {
  return {
    id: row.id as string,
    name: (row.name as string) ?? 'Team',
    sport: (row.sport as string) ?? 'Football',
    description: (row.description as string) ?? '',
    area: (row.area as string) ?? '',
    ownerId: row.owner_id as string,
    isOpen: (row.is_open as boolean) ?? true,
    maxMembers: (row.max_members as number) ?? 15,
    memberCount: (row.member_count as number) ?? 0,
    format: (row.format as string) ?? '',
  };
}

function friendlyError(message?: string): string {
  if (!message) return 'Something went wrong. Please try again.';
  if (message.includes('TEAM_FULL')) return 'This team is full.';
  if (message.includes('TEAM_SIZE_INVALID')) {
    const m = message.match(/TEAM_SIZE_INVALID: ([^\n]+)/);
    return m ? `Squad size doesn't fit: ${m[1]}.` : 'That squad size doesn’t fit this format.';
  }
  if (message.includes('TEAM_TOO_SMALL')) return 'The team already has more members than that.';
  if (message.includes('TEAM_FORMAT_INVALID')) return 'Please pick a format for this sport.';
  if (message.includes('duplicate') || message.includes('23505')) return 'Already a member of this team.';
  return 'Something went wrong. Please try again.';
}

export async function fetchMyTeams(userId: string): Promise<Team[]> {
  const { data: rows, error } = await supabase
    .from('team_members')
    .select('team_id')
    .eq('user_id', userId);
  if (error || !rows?.length) return [];
  const ids = rows.map((r: Record<string, unknown>) => r.team_id as string);
  const { data, error: tErr } = await supabase
    .from('teams')
    .select('*')
    .in('id', ids)
    .order('created_at', { ascending: false });
  if (tErr || !data) return [];
  return data.map((r) => rowToTeam(r as Record<string, unknown>));
}

/** Teams the user captains, optionally for one sport — used for team sign-ups and challenges. */
export async function fetchCaptainTeams(userId: string, sport?: string): Promise<Team[]> {
  let q = supabase.from('teams').select('*').eq('owner_id', userId);
  if (sport) q = q.eq('sport', sport);
  const { data, error } = await q.order('name', { ascending: true });
  if (error || !data) return [];
  return data.map((r) => rowToTeam(r as Record<string, unknown>));
}

/** All teams for a sport except the given user's own — challenge opponents. */
export async function fetchTeamsForSport(sport: string, excludeOwnerId: string): Promise<Team[]> {
  const { data, error } = await supabase
    .from('teams')
    .select('*')
    .eq('sport', sport)
    .neq('owner_id', excludeOwnerId)
    .order('name', { ascending: true })
    .limit(100);
  if (error || !data) return [];
  return data.map((r) => rowToTeam(r as Record<string, unknown>));
}

/** Open teams the user is not in yet — for the "Discover" list. */
export async function fetchDiscoverTeams(userId: string, excludeIds: string[]): Promise<Team[]> {
  const { data, error } = await supabase
    .from('teams')
    .select('*')
    .eq('is_open', true)
    .neq('owner_id', userId)
    .order('created_at', { ascending: false })
    .limit(30);
  if (error || !data) return [];
  const exclude = new Set(excludeIds);
  return data
    .map((r) => rowToTeam(r as Record<string, unknown>))
    .filter((t) => !exclude.has(t.id));
}

export async function fetchTeam(teamId: string): Promise<Team | null> {
  const { data, error } = await supabase.from('teams').select('*').eq('id', teamId).single();
  if (error || !data) return null;
  return rowToTeam(data as Record<string, unknown>);
}

export async function fetchTeamMembers(teamId: string): Promise<TeamMember[]> {
  const { data: rows, error } = await supabase
    .from('team_members')
    .select('user_id, role, joined_at')
    .eq('team_id', teamId)
    .order('joined_at', { ascending: true });
  if (error || !rows?.length) return [];

  const ids = rows.map((r: Record<string, unknown>) => r.user_id as string);
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name, initials, avatar_color, avatar_url')
    .in('id', ids);
  const byId = new Map(
    ((profiles ?? []) as Record<string, unknown>[]).map((p) => [p.id as string, p]),
  );

  return rows.map((r: Record<string, unknown>) => {
    const p = byId.get(r.user_id as string);
    const name = (p?.name as string) ?? 'Player';
    return {
      userId: r.user_id as string,
      role: ((r.role as string) === 'captain' ? 'captain' : 'member') as TeamMember['role'],
      name,
      initials: (p?.initials as string) || name.slice(0, 2).toUpperCase(),
      avatarColor: (p?.avatar_color as string) ?? '#16a34a',
      avatarUrl: (p?.avatar_url as string) ?? undefined,
    };
  });
}

export async function createTeam(params: {
  ownerId: string;
  name: string;
  sport: string;
  description: string;
  area: string;
  isOpen: boolean;
  maxMembers: number;
  format: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from('teams').insert({
    owner_id: params.ownerId,
    name: params.name.trim(),
    sport: params.sport,
    description: params.description.trim(),
    area: params.area.trim(),
    is_open: params.isOpen,
    max_members: params.maxMembers,
    format: params.format,
  });
  if (error) return { ok: false, error: friendlyError(error.message) };
  return { ok: true };
}

export async function updateTeam(
  teamId: string,
  params: { name: string; description: string; area: string; isOpen: boolean; maxMembers: number; format: string },
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from('teams')
    .update({
      name: params.name.trim(),
      description: params.description.trim(),
      area: params.area.trim(),
      is_open: params.isOpen,
      max_members: params.maxMembers,
      format: params.format,
    })
    .eq('id', teamId);
  return error ? { ok: false, error: friendlyError(error.message) } : { ok: true };
}

export async function deleteTeam(teamId: string): Promise<boolean> {
  const { error } = await supabase.from('teams').delete().eq('id', teamId);
  return !error;
}

/** Join yourself (open team) or captain adds a player. */
export async function addTeamMember(teamId: string, userId: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from('team_members').insert({ team_id: teamId, user_id: userId, role: 'member' });
  if (error) return { ok: false, error: friendlyError(`${error.code} ${error.message}`) };
  return { ok: true };
}

/** Leave yourself or captain removes a player. */
export async function removeTeamMember(teamId: string, userId: string): Promise<boolean> {
  const { error } = await supabase
    .from('team_members')
    .delete()
    .eq('team_id', teamId)
    .eq('user_id', userId);
  return !error;
}
