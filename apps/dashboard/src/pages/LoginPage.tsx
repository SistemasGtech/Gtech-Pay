import { useEffect, useMemo, useState } from 'react';
import { isSupabaseEnabled } from '../lib/authSupabase';
import { resetPassword, signInWithEmail, signUpAdmin } from '../lib/authSupabase';
import { traduzirErro } from '../lib/mensagensPt';
import { resetAdminPasswordToDefault, validateAdminLogin, DEFAULT_ADMIN_PASSWORD, DEFAULT_ADMIN_USER } from '../auth';
import { GtechPayLogo } from '../components/GtechPayLogo';

type Props = {
  onSuccess: () => void;
};

type Mode = 'login' | 'signup' | 'forgot';

export function LoginPage({ onSuccess }: Props) {
  const cloud = isSupabaseEnabled;
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);

  const inviteToken = useMemo(() => {
    const q = new URLSearchParams(window.location.search).get('invite');
    return q?.trim() || '';
  }, []);

  useEffect(() => {
    if (inviteToken && cloud) setMode('signup');
  }, [inviteToken, cloud]);

  const submitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setMsg('');
    setLoading(true);
    try {
      if (cloud) {
        await signInWithEmail(email, password);
      } else if (validateAdminLogin(user, password)) {
        /* ok */
      } else {
        setErr('Usuário ou senha incorretos.');
        setLoading(false);
        return;
      }
      onSuccess();
    } catch (ex) {
      setErr(traduzirErro(ex instanceof Error ? ex.message : 'Falha ao entrar.'));
    } finally {
      setLoading(false);
    }
  };

  const submitSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setMsg('');
    setLoading(true);
    try {
      await signUpAdmin(email, password, inviteToken || undefined);
      setMsg(
        inviteToken
          ? 'Conta criada e vinculada à loja! Confirme o e-mail (se solicitado) e faça login.'
          : 'Conta criada! Confirme o e-mail (se solicitado) e faça login. Sua loja já foi criada na nuvem.'
      );
      setMode('login');
    } catch (ex) {
      setErr(traduzirErro(ex instanceof Error ? ex.message : 'Falha no cadastro.'));
    } finally {
      setLoading(false);
    }
  };

  const submitForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setMsg('');
    setLoading(true);
    try {
      if (cloud) {
        await resetPassword(email);
        setMsg('Enviamos um link de redefinição para seu e-mail.');
        setForgotOpen(false);
      } else {
        const creds = resetAdminPasswordToDefault();
        setUser(creds.user);
        setPassword(creds.password);
        setMsg(`Senha restaurada: ${DEFAULT_ADMIN_USER} / ${DEFAULT_ADMIN_PASSWORD}`);
        setForgotOpen(false);
      }
    } catch (ex) {
      setErr(traduzirErro(ex instanceof Error ? ex.message : 'Não foi possível enviar o e-mail.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950 relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/40 via-slate-950 to-slate-950" />

      <div className="relative w-full max-w-[420px] space-y-3">
        {cloud && (
          <div className="flex justify-center gap-1 text-[11px] font-bold">
            <span className="px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">● Nuvem Supabase</span>
          </div>
        )}

        <form
          onSubmit={mode === 'signup' ? submitSignup : submitLogin}
          className="bg-slate-900/90 backdrop-blur-sm border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-4"
        >
          <div className="text-center space-y-3">
            <GtechPayLogo className="w-32 h-32 mx-auto rounded-3xl object-cover shadow-xl ring-1 ring-cyan-500/20" />
            <h1 className="text-xl font-black">{mode === 'signup' ? 'Criar conta de administrador' : 'Entrar no painel'}</h1>
            <p className="text-xs text-slate-400">
              {cloud
                ? inviteToken && mode === 'signup'
                  ? 'Convite detectado — você entrará na loja do convite.'
                  : 'Login online com e-mail e senha.'
                : 'Modo local (sem nuvem configurada).'}
            </p>
          </div>

          {err && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold">{err}</div>}
          {msg && <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold">{msg}</div>}

          {cloud ? (
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-500">E-mail</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full mt-1 bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm"
                placeholder="seu@email.com"
              />
            </div>
          ) : (
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-500">Usuário</label>
              <input
                type="text"
                required
                value={user}
                onChange={(e) => setUser(e.target.value)}
                className="w-full mt-1 bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm"
              />
            </div>
          )}

          {mode !== 'forgot' && (
            <div>
              <div className="flex justify-between mb-1">
                <label className="text-[10px] font-bold uppercase text-slate-500">Senha</label>
                <button type="button" onClick={() => setForgotOpen(true)} className="text-[11px] font-bold text-indigo-400">
                  Esqueceu a senha?
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={cloud ? 6 : 1}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 pr-16 text-sm"
                />
                <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">
                  {showPassword ? 'Ocultar' : 'Ver'}
                </button>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl font-black text-sm uppercase"
          >
            {loading ? 'Aguarde...' : mode === 'signup' ? 'Criar conta' : 'Entrar'}
          </button>

          {cloud && (
            <p className="text-center text-xs text-slate-400">
              {mode === 'signup' ? (
                <>
                  Já tem conta?{' '}
                  <button type="button" className="text-indigo-400 font-bold" onClick={() => setMode('login')}>
                    Entrar
                  </button>
                </>
              ) : (
                <>
                  Primeira vez?{' '}
                  <button type="button" className="text-indigo-400 font-bold" onClick={() => setMode('signup')}>
                    Criar conta de administrador
                  </button>
                </>
              )}
            </p>
          )}
        </form>
      </div>

      {forgotOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75">
          <form onSubmit={submitForgot} className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md space-y-4">
            <h2 className="font-black text-lg">Recuperar senha</h2>
            <p className="text-xs text-slate-400">
              {cloud
                ? 'Informe seu e-mail. Enviaremos um link para definir uma nova senha.'
                : 'Modo local: restaura usuário e senha padrão.'}
            </p>
            {cloud && (
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm"
              />
            )}
            <div className="flex gap-2">
              <button type="button" onClick={() => setForgotOpen(false)} className="flex-1 py-2 border border-slate-700 rounded-xl text-sm font-bold">
                Cancelar
              </button>
              <button type="submit" disabled={loading} className="flex-1 py-2 bg-indigo-600 rounded-xl text-sm font-bold">
                {cloud ? 'Enviar link' : 'Restaurar padrão'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
