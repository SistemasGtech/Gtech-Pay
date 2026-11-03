/** Mensagens de erro comuns (Supabase/Auth em inglês) → português */
export function traduzirErro(mensagem: string): string {
  const m = mensagem.trim();
  const mapa: Record<string, string> = {
    'Invalid login credentials': 'E-mail ou senha incorretos.',
    'Email not confirmed': 'Confirme seu e-mail antes de entrar.',
    'User already registered': 'Este e-mail já está cadastrado.',
    'Password should be at least 6 characters': 'A senha deve ter pelo menos 6 caracteres.',
    'Unable to validate email address: invalid format': 'E-mail inválido.',
    'New password should be different from the old password.': 'A nova senha deve ser diferente da anterior.',
    'Auth session missing!': 'Sessão expirada. Entre novamente.',
    'JWT expired': 'Sessão expirada. Entre novamente.',
  };
  if (mapa[m]) return mapa[m];
  for (const [en, pt] of Object.entries(mapa)) {
    if (m.toLowerCase().includes(en.toLowerCase())) return pt;
  }
  if (/does not exist|relation .* does not exist|column .* does not exist/i.test(m)) {
    return 'Banco desatualizado: aplique a migration 006 no Supabase (gestão de usuários).';
  }
  if (/permission denied|row-level security|42501/i.test(m)) {
    return 'Sem permissão para ver usuários. Confirme que você é administrador da loja.';
  }
  if (/^[A-Za-z0-9\s.!?,:_-]+$/.test(m) && m.length > 12 && !/[áàâãéêíóôõúç]/i.test(m)) {
    return 'Ocorreu um erro. Tente de novo ou verifique sua conexão.';
  }
  return m;
}
