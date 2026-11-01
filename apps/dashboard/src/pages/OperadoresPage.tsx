import { useState } from 'react';
import type { Operador } from '@gtech/shared';
import { newId } from '@gtech/shared';

type Props = {
  operadores: Operador[];
  onSave: (list: Operador[]) => void;
};

export function OperadoresPage({ operadores, onSave }: Props) {
  const [form, setForm] = useState<Partial<Operador> | null>(null);

  const openNew = () =>
    setForm({
      id: newId(),
      nome: '',
      cargo: 'Operador de Caixa',
      pin: '',
      email: '',
      cor: '#6366f1',
      iniciais: 'OP',
      ativo: true,
    });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form?.nome || !form.pin || form.pin.length !== 4) return;
    const iniciais =
      form.iniciais ||
      form.nome
        .split(' ')
        .map((p) => p[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
    const op: Operador = {
      id: form.id!,
      nome: form.nome,
      cargo: form.cargo || 'Caixa',
      pin: form.pin,
      email: form.email,
      cor: form.cor || '#6366f1',
      iniciais,
      ativo: form.ativo !== false,
    };
    const exists = operadores.some((o) => o.id === op.id);
    onSave(exists ? operadores.map((o) => (o.id === op.id ? op : o)) : [...operadores, op]);
    setForm(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">Operadores (login do app)</h1>
          <p className="text-sm text-slate-400">Cadastre quem pode abrir o caixa no tablet. Login por PIN de 4 dígitos.</p>
        </div>
        <button type="button" onClick={openNew} className="px-4 py-2 bg-indigo-600 rounded-xl text-sm font-bold">
          + Novo operador
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-900 text-slate-400 text-left">
            <tr>
              <th className="p-3">Nome</th>
              <th className="p-3">Cargo</th>
              <th className="p-3">E-mail</th>
              <th className="p-3">PIN</th>
              <th className="p-3">Status</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-950">
            {operadores.map((op) => (
              <tr key={op.id}>
                <td className="p-3 font-bold">{op.nome}</td>
                <td className="p-3">{op.cargo}</td>
                <td className="p-3 text-slate-400">{op.email || '—'}</td>
                <td className="p-3 font-mono">****</td>
                <td className="p-3">{op.ativo !== false ? 'Ativo' : 'Inativo'}</td>
                <td className="p-3 text-right space-x-2">
                  <button type="button" onClick={() => setForm(op)} className="text-indigo-400 font-bold text-xs">
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => onSave(operadores.filter((o) => o.id !== op.id))}
                    className="text-red-400 font-bold text-xs"
                  >
                    Excluir
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {form && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <form onSubmit={submit} className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md space-y-3">
            <h2 className="font-black text-lg">{operadores.some((o) => o.id === form.id) ? 'Editar' : 'Novo'} operador</h2>
            <input
              required
              placeholder="Nome"
              value={form.nome || ''}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-sm"
            />
            <input
              placeholder="Cargo"
              value={form.cargo || ''}
              onChange={(e) => setForm({ ...form, cargo: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-sm"
            />
            <input
              type="email"
              placeholder="E-mail (opcional)"
              value={form.email || ''}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-sm"
            />
            <input
              required
              maxLength={4}
              pattern="\d{4}"
              placeholder="PIN 4 dígitos"
              value={form.pin || ''}
              onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, '').slice(0, 4) })}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-sm font-mono"
            />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.ativo !== false} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} />
              Ativo no app de vendas
            </label>
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setForm(null)} className="flex-1 py-2 rounded-xl border border-slate-700 text-sm font-bold">
                Cancelar
              </button>
              <button type="submit" className="flex-1 py-2 rounded-xl bg-indigo-600 text-sm font-bold">
                Salvar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
