import { isSupabaseEnabled, supabase } from './supabaseApi';

export async function signInWithEmail(email: string, password: string) {
  if (!supabase) throw new Error('Supabase não configurado');
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw error;
}

export async function signUpAdmin(email: string, password: string, inviteToken?: string) {
  if (!supabase) throw new Error('Supabase não configurado');
  const data: Record<string, string> = {};
  if (inviteToken?.trim()) data.invite_token = inviteToken.trim();
  const { error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: Object.keys(data).length ? { data } : undefined,
  });
  if (error) throw error;
}

export async function getCurrentUserEmail(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user?.email ?? null;
}

export async function changePassword(newPassword: string) {
  if (!supabase) throw new Error('Supabase não configurado');
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

export async function signOut() {
  if (!supabase) return;
  await supabase.auth.signOut();
}

export async function resetPassword(email: string) {
  if (!supabase) throw new Error('Supabase não configurado');
  const redirectTo = `${window.location.origin}${window.location.pathname}`;
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
  if (error) throw error;
}

export async function getSession() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export { isSupabaseEnabled };
