import { useCallback, useEffect, useState } from 'react';
import type { StoreProfile } from '../lib/supabaseApi';
import {
  attachStoreMemberByEmail,
  fetchStoreProfiles,
  registerStoreUser,
  removeStoreMember,
  updateMemberRole,
} from '../lib/supabaseApi';
import { changePassword, getCurrentUserEmail, isSupabaseEnabled } from '../lib/authSupabase';
import { traduzirErro } from '../lib/mensagensPt';
import {
  getLocalAdminCredentials,
  updateLocalAdminCredentials,
  DEFAULT_ADMIN_PASSWORD,
  DEFAULT_ADMIN_USER,
} from '../auth';

type Props = {
  storeId: string | null;
  cloud: boolean;
  onNotify: (msg: string) => void;
};

type UserForm = {
  mode: 'create' | 'edit';
  userId?: string;
  email: string;
  password: string;
  role: 'admin' | 'operador';
};

const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrador',
  operador: 'Operador',
};

const emptyCreate = (): UserForm => ({
  mode: 'create',
  email: '',
  password: '',
  role: 'operador',
});

export function UsuariosPage({ storeId, cloud, onNotify }: Props) {
  const [loading, setLoading] = useState(false);
  const [myEmail, setMyEmail] = useState('');
  const [team, setTeam] = useState<StoreProfile[]>([]);
  const [myRole, setMyRole] = useState<string>('admin');
  const [pwd, setPwd] = useState({ next: '', confirm: '' });
  const [localForm, setLocalForm] = useState(() => getLocalAdminCredentials());
  const [form, setForm] = useState<UserForm | null>(null);
  const [linkForm, setLinkForm] = useState<{ email: string; role: 'admin' | 'operador' } | null>(null);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    if (!cloud || !storeId) return;
    setLoading(true);
    try {
      const profiles = await fetchStoreProfiles(storeId);
      setTeam(profiles.list);
      setMyRole(profiles.myRole);
      const email = await getCurrentUserEmail();
      setMyEmail(email ?? '');
    } catch (e) {
      onNotify(traduzirErro(e instanceof Error ? e.message : 'Erro ao carregar usuários'));
    } finally {
      setLoading(false);
    }
  }, [cloud, storeId, onNotify]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const isAdmin = myRole === 'admin';

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwd.next.length < 6) {
      onNotify('Nova senha: mínimo 6 caracteres');
      return;
    }
    if (pwd.next !== pwd.confirm) {
      onNotify('Confirmação não confere');
      return;
    }
    try {
      await changePassword(pwd.next);
      setPwd({ next: '', confirm: '' });
      onNotify('Senha atualizada');
    } catch (ex) {
      onNotify(traduzirErro(ex instanceof Error ? ex.message : 'Não foi possível alterar a senha'));
    }
  };

  const submitLocal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!localForm.user.trim() || !localForm.password) {
      onNotify('Preencha usuário e senha');
      return;
    }
    updateLocalAdminCredentials(localForm.user.trim(), localForm.password);
    onNotify('Credenciais locais salvas');
  };

  const openEdit = (m: StoreProfile) => {
    setForm({
      mode: 'edit',
      userId: m.id,
      email: m.email ?? '',
      password: '',
      role: (m.role === 'admin' ? 'admin' : 'operador') as 'admin' | 'operador',
    });
  };

  const submitUserForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    try {
      if (form.mode === 'create') {
        if (!form.email.trim() || form.password.length < 6) {
          onNotify('Informe e-mail e senha (mín. 6 caracteres)');
          return;
        }
        await registerStoreUser(form.email, form.password, form.role);
        onNotify('Usuário cadastrado');
      } else if (form.userId) {
        await updateMemberRole(form.userId, form.role);
        onNotify('Usuário atualizado');
      }
      setForm(null);
      await reload();
    } catch (err) {
      onNotify(traduzirErro(err instanceof Error ? err.message : 'Erro ao salvar usuário'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-black">Gestão de usuários</h1>
        <p className="text-sm text-slate-400 mt-1">
          Cadastre, edite ou exclua quem acessa o painel e o app PDV (mesmo e-mail e senha). Não crie usuários
          direto no painel Supabase — eles abrem outra loja. Use <strong className="text-slate-300">Novo usuário</strong>{' '}
          ou <strong className="text-slate-300">Vincular existente</strong>.
        </p>
      </div>

      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <h2 className="text-sm font-black uppercase text-indigo-300">Minha conta</h2>
        {cloud ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 text-sm">
              <div>
                <p className="text-[10px] font-bold uppercase text-slate-500">E-mail</p>
                <p className="font-bold text-slate-200">{myEmail || '—'}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase text-slate-500">Papel</p>
                <p className="font-bold text-slate-200">{ROLE_LABEL[myRole] ?? myRole}</p>
              </div>
            </div>
            <form onSubmit={(e) => void submitPassword(e)} className="space-y-3 pt-2 border-t border-slate-800">
              <p className="text-xs text-slate-400">Alterar minha senha</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  type="password"
                  placeholder="Nova senha"
                  value={pwd.next}
                  onChange={(e) => setPwd({ ...pwd, next: e.target.value })}
                  className="bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-sm"
                  minLength={6}
                />
                <input
                  type="password"
                  placeholder="Confirmar nova senha"
                  value={pwd.confirm}
                  onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })}
                  className="bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-sm"
                  minLength={6}
                />
              </div>
              <button type="submit" className="px-4 py-2 bg-emerald-600 rounded-xl text-sm font-bold">
                Salvar nova senha
              </button>
            </form>
          </>
        ) : (
          <form onSubmit={submitLocal} className="space-y-3">
            <p className="text-xs text-slate-400">Modo local — credenciais guardadas neste navegador.</p>
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-500">Usuário</label>
              <input
                value={localForm.user}
                onChange={(e) => setLocalForm({ ...localForm, user: e.target.value })}
                className="w-full mt-1 bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-sm"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-500">Senha</label>
              <input
                type="password"
                value={localForm.password}
                onChange={(e) => setLocalForm({ ...localForm, password: e.target.value })}
                className="w-full mt-1 bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-sm"
              />
            </div>
            <p className="text-[11px] text-slate-500">
              Padrão inicial: {DEFAULT_ADMIN_USER} / {DEFAULT_ADMIN_PASSWORD}
            </p>
            <button type="submit" className="px-4 py-2 bg-emerald-600 rounded-xl text-sm font-bold">
              Salvar credenciais
            </button>
          </form>
        )}
      </section>

      {cloud && isAdmin && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-black uppercase text-indigo-300">Usuários da loja</h2>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setLinkForm({ email: '', role: 'operador' })}
                className="px-4 py-2 border border-slate-700 rounded-xl text-sm font-bold"
              >
                Vincular existente
              </button>
              <button
                type="button"
                onClick={() => setForm(emptyCreate())}
                className="px-4 py-2 bg-indigo-600 rounded-xl text-sm font-bold"
              >
                + Novo usuário
              </button>
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-slate-500">Carregando…</p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-800">
              <table className="w-full text-sm">
                <thead className="bg-slate-900 text-slate-400 text-left">
                  <tr>
                    <th className="p-3">E-mail</th>
                    <th className="p-3">Papel</th>
                    <th className="p-3">Desde</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 bg-slate-950">
                  {team.map((m) => (
                    <tr key={m.id}>
                      <td className="p-3 font-bold">{m.email || m.id.slice(0, 8)}</td>
                      <td className="p-3">{ROLE_LABEL[m.role] ?? m.role}</td>
                      <td className="p-3 text-slate-400">
                        {m.createdAt ? new Date(m.createdAt).toLocaleDateString('pt-BR') : '—'}
                      </td>
                      <td className="p-3 text-right space-x-2 whitespace-nowrap">
                        {!m.isSelf && (
                          <>
                            <button
                              type="button"
                              onClick={() => openEdit(m)}
                              className="text-indigo-400 font-bold text-xs"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (!confirm(`Excluir o usuário ${m.email || ''}?`)) return;
                                void removeStoreMember(m.id)
                                  .then(() => reload())
                                  .then(() => onNotify('Usuário excluído'))
                                  .catch((err) =>
                                    onNotify(traduzirErro(err instanceof Error ? err.message : 'Erro ao excluir'))
                                  );
                              }}
                              className="text-red-400 font-bold text-xs"
                            >
                              Excluir
                            </button>
                          </>
                        )}
                        {m.isSelf && <span className="text-xs text-slate-500">Você</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {cloud && !isAdmin && (
        <p className="text-sm text-slate-500 border border-slate-800 rounded-2xl p-4">
          Apenas administradores podem cadastrar ou gerenciar usuários. Você pode alterar sua senha acima.
        </p>
      )}

      {!isSupabaseEnabled && (
        <p className="text-xs text-slate-500">
          Configure as variáveis de ambiente do Supabase no projeto para gerenciar usuários na nuvem.
        </p>
      )}

      {linkForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSaving(true);
              void attachStoreMemberByEmail(linkForm.email, linkForm.role)
                .then(() => reload())
                .then(() => {
                  setLinkForm(null);
                  onNotify('Usuário vinculado à loja');
                })
                .catch((err) =>
                  onNotify(traduzirErro(err instanceof Error ? err.message : 'Erro ao vincular'))
                )
                .finally(() => setSaving(false));
            }}
            className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md space-y-3"
          >
            <h2 className="font-black text-lg">Vincular usuário existente</h2>
            <p className="text-xs text-slate-400">
              Para quem já foi criado no Auth do Supabase e não aparece na lista (ficou em outra loja).
            </p>
            <input
              type="email"
              required
              placeholder="E-mail do usuário"
              value={linkForm.email}
              onChange={(e) => setLinkForm({ ...linkForm, email: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-sm"
            />
            <select
              value={linkForm.role}
              onChange={(e) => setLinkForm({ ...linkForm, role: e.target.value as 'admin' | 'operador' })}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-sm"
            >
              <option value="operador">Operador</option>
              <option value="admin">Administrador</option>
            </select>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setLinkForm(null)}
                className="flex-1 py-2 rounded-xl border border-slate-700 text-sm font-bold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 py-2 rounded-xl bg-indigo-600 text-sm font-bold disabled:opacity-50"
              >
                {saving ? 'Salvando…' : 'Vincular'}
              </button>
            </div>
          </form>
        </div>
      )}

      {form && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <form
            onSubmit={(e) => void submitUserForm(e)}
            className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md space-y-3"
          >
            <h2 className="font-black text-lg">
              {form.mode === 'create' ? 'Novo usuário' : 'Editar usuário'}
            </h2>
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-500">E-mail</label>
              <input
                type="email"
                required
                readOnly={form.mode === 'edit'}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full mt-1 bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-sm read-only:opacity-70"
              />
            </div>
            {form.mode === 'create' && (
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500">Senha inicial</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full mt-1 bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-sm"
                  placeholder="Mínimo 6 caracteres"
                />
              </div>
            )}
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-500">Papel</label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as 'admin' | 'operador' })}
                disabled={Boolean(form.mode === 'edit' && form.userId && team.find((t) => t.id === form.userId)?.isSelf)}
                className="w-full mt-1 bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-sm"
              >
                <option value="operador">Operador</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setForm(null)}
                className="flex-1 py-2 rounded-xl border border-slate-700 text-sm font-bold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 py-2 rounded-xl bg-indigo-600 text-sm font-bold disabled:opacity-50"
              >
                {saving ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
