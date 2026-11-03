import { useState } from 'react';
import { signInPdv } from '../lib/pdvAuth';
import { GtechPayLogo } from './GtechPayLogo';

type Props = {
  onSuccess: () => void;
  error?: string;
  loading?: boolean;
};

export function PdvLoginPanel({ onSuccess, error: externalError, loading: externalLoading }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      await signInPdv(email, password);
      onSuccess();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'E-mail ou senha incorretos.');
    } finally {
      setLoading(false);
    }
  };

  const busy = loading || externalLoading;
  const message = err || externalError;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950">
      <form
        onSubmit={(e) => void submit(e)}
        className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4"
      >
        <div className="text-center space-y-3">
          <GtechPayLogo className="w-32 h-32 mx-auto rounded-3xl object-cover shadow-xl ring-1 ring-cyan-500/20" />
          <h1 className="font-black text-lg uppercase tracking-wide">Entrar no PDV</h1>
          <p className="text-xs text-slate-400 leading-relaxed">
            Use o mesmo <strong className="text-slate-300">e-mail e senha</strong> do dashboard.
          </p>
        </div>

        {message && <p className="text-red-400 text-xs text-center font-bold">{message}</p>}

        <label className="block space-y-1">
          <span className="text-[10px] font-bold uppercase text-slate-500">E-mail</span>
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm"
            required
          />
        </label>

        <label className="block space-y-1">
          <span className="text-[10px] font-bold uppercase text-slate-500">Senha</span>
          <div className="flex gap-2">
            <input
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="px-3 rounded-xl border border-slate-700 text-[10px] font-bold"
            >
              {showPassword ? 'Ocultar' : 'Ver'}
            </button>
          </div>
        </label>

        <button
          type="submit"
          disabled={busy || !email.trim() || !password}
          className="w-full py-3 rounded-2xl bg-indigo-600 disabled:bg-slate-700 font-black text-xs uppercase"
        >
          {busy ? 'Entrando…' : 'Entrar no PDV'}
        </button>

        <p className="text-[10px] text-center text-slate-500 leading-snug">
          A sessão fica salva neste tablet. Toque em <strong className="text-slate-400">Sair</strong> para trocar de
          conta.
        </p>
      </form>
    </div>
  );
}
