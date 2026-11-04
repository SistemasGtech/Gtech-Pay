import type { Operador } from '@gtech/shared';
import type { Session, User } from '@supabase/supabase-js';
import { getConfiguredStoreId, normalizeStoreId, saveConfiguredStoreId, supabase } from './pdvApi';
import { isOnline } from './offlineStore';

export async function signInPdv(email: string, password: string): Promise<void> {
  if (!supabase) throw new Error('Supabase não configurado no PDV');
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) throw error;
}

export async function signOutPdv(): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signOut();
}

export async function getPdvAuthSession(): Promise<Session | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function getCurrentStoreIdFromAuth(): Promise<string | null> {
  return resolveStoreIdForSession({ refreshFromServer: isOnline() });
}

/** Loja do usuário logado: usa cache local offline; atualiza na nuvem quando possível. */
export async function resolveStoreIdForSession(options?: {
  refreshFromServer?: boolean;
}): Promise<string | null> {
  const cached = getConfiguredStoreId();
  if (!supabase) return cached;

  const refresh = options?.refreshFromServer ?? isOnline();
  if (!refresh) return cached;

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData.session?.user?.id;
    if (!uid) return cached;

    const { data, error } = await supabase
      .from('profiles')
      .select('store_id')
      .eq('id', uid)
      .maybeSingle();
    if (error) throw error;
    const sid = data?.store_id ? normalizeStoreId(String(data.store_id)) : null;
    if (sid) {
      saveConfiguredStoreId(sid);
      return sid;
    }
  } catch {
    return cached;
  }
  return cached;
}

export function operadorFromAuthUser(user: User): Operador {
  const email = user.email ?? '';
  const metaName =
    typeof user.user_metadata?.nome === 'string'
      ? user.user_metadata.nome
      : typeof user.user_metadata?.full_name === 'string'
        ? user.user_metadata.full_name
        : '';
  const nome = metaName.trim() || email.split('@')[0] || 'Administrador';
  const parts = nome.trim().split(/\s+/).filter(Boolean);
  const iniciais =
    parts.length >= 2
      ? `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase()
      : (parts[0]?.slice(0, 2) ?? 'AD').toUpperCase();
  return {
    id: user.id,
    nome,
    cargo: 'Dashboard',
    pin: '',
    cor: '#6366f1',
    iniciais,
  };
}
