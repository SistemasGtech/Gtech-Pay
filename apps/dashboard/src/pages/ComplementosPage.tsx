import { useState } from 'react';
import type { Complemento, OpcaoComplemento } from '@gtech/shared';
import { newId } from '@gtech/shared';

type Props = {
  complementos: Complemento[];
  onSave: (list: Complemento[]) => void;
};

const emptyGrupo = (): Complemento => ({
  id: newId(),
  nome: '',
  opcoes: [{ id: newId(), nome: '', preco: 0 }],
});

export function ComplementosPage({ complementos, onSave }: Props) {
  const [form, setForm] = useState<Complemento | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form?.nome.trim()) return;
    const opcoes = form.opcoes.filter((o) => o.nome.trim()).map((o) => ({
      ...o,
      nome: o.nome.trim(),
      preco: Number(o.preco) || 0,
    }));
    if (opcoes.length === 0) return;
    const grupo: Complemento = {
      id: form.id,
      nome: form.nome.trim(),
      opcoes,
    };
    const exists = complementos.some((c) => c.id === grupo.id);
    onSave(exists ? complementos.map((c) => (c.id === grupo.id ? grupo : c)) : [...complementos, grupo]);
    setForm(null);
  };

  const addOpcao = () => {
    if (!form) return;
    setForm({
      ...form,
      opcoes: [...form.opcoes, { id: newId(), nome: '', preco: 0 }],
    });
  };

  const updateOpcao = (idx: number, op: OpcaoComplemento) => {
    if (!form) return;
    const opcoes = [...form.opcoes];
    opcoes[idx] = op;
    setForm({ ...form, opcoes });
  };

  const removeOpcao = (idx: number) => {
    if (!form || form.opcoes.length <= 1) return;
    setForm({ ...form, opcoes: form.opcoes.filter((_, i) => i !== idx) });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">Complementos</h1>
          <p className="text-sm text-slate-400">
            Crie um complemento (ex.: <strong className="text-slate-300">Recheio</strong>) e adicione as opções desse grupo em lista.
          </p>
        </div>
        <button type="button" onClick={() => setForm(emptyGrupo())} className="px-4 py-2 bg-indigo-600 rounded-xl text-sm font-bold">
          + Novo complemento
        </button>
      </div>

      <div className="space-y-3">
        {complementos.length === 0 ? (
          <p className="text-sm text-slate-500 p-6 text-center border border-slate-800 rounded-2xl">Nenhum complemento cadastrado.</p>
        ) : (
          [...complementos]
            .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }))
            .map((g) => {
              const open = Boolean(expanded[g.id]);
              return (
            <div key={g.id} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 p-4 bg-slate-950/50">
                <div className="min-w-0 flex-1">
                  <h3 className="font-black text-lg truncate">{g.nome}</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {g.opcoes.length} {g.opcoes.length === 1 ? 'opção' : 'opções'}
                    {!open && g.opcoes.length > 0 && (
                      <span className="text-slate-600">
                        {' '}
                        · {g.opcoes.slice(0, 3).map((o) => o.nome).join(', ')}
                        {g.opcoes.length > 3 ? '…' : ''}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs font-bold shrink-0">
                  <button
                    type="button"
                    onClick={() => toggleExpanded(g.id)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700"
                    aria-expanded={open}
                  >
                    {open ? 'Recolher' : 'Expandir'}
                  </button>
                  <button type="button" onClick={() => setForm({ ...g, opcoes: [...g.opcoes] })} className="text-indigo-400 px-1">
                    Editar
                  </button>
                  <button type="button" onClick={() => onSave(complementos.filter((x) => x.id !== g.id))} className="text-red-400 px-1">
                    Excluir
                  </button>
                </div>
              </div>
              {open && (
                <ul className="divide-y divide-slate-800 border-t border-slate-800">
                  {g.opcoes.map((o) => (
                    <li key={o.id} className="px-4 py-2.5 flex justify-between text-sm">
                      <span>{o.nome}</span>
                      <span className="font-mono text-emerald-400">{o.preco > 0 ? `+ R$ ${o.preco.toFixed(2)}` : 'Grátis'}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
              );
            })
        )}
      </div>

      {form && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <form onSubmit={submit} className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-lg space-y-4 my-8">
            <h2 className="font-black text-lg">
              {complementos.some((c) => c.id === form.id) ? 'Editar complemento' : 'Novo complemento'}
            </h2>

            <div>
              <label className="text-[10px] font-bold uppercase text-slate-500">Nome do complemento</label>
              <input
                required
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Ex: Recheio, Massa, Calda..."
                className="w-full mt-1 bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-sm"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold uppercase text-slate-500">Opções deste complemento</label>
                <button type="button" onClick={addOpcao} className="text-xs font-bold text-indigo-400">
                  + Adicionar opção
                </button>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto custom-scroll pr-1">
                {form.opcoes.map((op, idx) => (
                  <div key={op.id} className="flex gap-2 items-center">
                    <input
                      required
                      value={op.nome}
                      onChange={(e) => updateOpcao(idx, { ...op, nome: e.target.value })}
                      placeholder="Nome da opção"
                      className="flex-1 bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs"
                    />
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={op.preco}
                      onChange={(e) => updateOpcao(idx, { ...op, preco: parseFloat(e.target.value) || 0 })}
                      placeholder="R$"
                      className="w-24 bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => removeOpcao(idx)}
                      disabled={form.opcoes.length <= 1}
                      className="text-red-400 text-xs font-bold px-2 disabled:opacity-30"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button type="button" onClick={() => setForm(null)} className="flex-1 py-2 border border-slate-700 rounded-xl text-sm font-bold">
                Cancelar
              </button>
              <button type="submit" className="flex-1 py-2 bg-indigo-600 rounded-xl text-sm font-bold">
                Salvar complemento
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
