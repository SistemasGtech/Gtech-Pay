import { useState } from 'react';
import type { Categoria, Complemento, Produto } from '@gtech/shared';
import { newId } from '@gtech/shared';

type Props = {
  produtos: Produto[];
  categorias: Categoria[];
  complementos: Complemento[];
  onSave: (list: Produto[]) => void;
};

function moveId(ids: string[], id: string, dir: -1 | 1): string[] {
  const i = ids.indexOf(id);
  if (i < 0) return ids;
  const j = i + dir;
  if (j < 0 || j >= ids.length) return ids;
  const next = [...ids];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

function orderedComplementoNomes(ids: string[], complementos: Complemento[]): string[] {
  const byId = new Map(complementos.map((c) => [c.id, c.nome]));
  return ids.map((id) => byId.get(id)).filter(Boolean) as string[];
}

export function ProdutosPage({ produtos, categorias, complementos, onSave }: Props) {
  const [form, setForm] = useState<Partial<Produto> | null>(null);

  const openNew = () => {
    if (categorias.length === 0) {
      alert('Cadastre pelo menos uma categoria antes de criar itens.');
      return;
    }
    setForm({
      id: newId(),
      nome: '',
      categoriaId: categorias[0].id,
      preco: 0,
      ativo: true,
      complementoIds: [],
    });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form?.nome?.trim() || !form.categoriaId) return;
    const p: Produto = {
      id: form.id || newId(),
      nome: form.nome.trim(),
      categoriaId: form.categoriaId,
      preco: Number(form.preco) || 0,
      ativo: form.ativo !== false,
      complementoIds: form.complementoIds || [],
    };
    const exists = produtos.some((x) => x.id === p.id);
    onSave(exists ? produtos.map((x) => (x.id === p.id ? p : x)) : [...produtos, p]);
    setForm(null);
  };

  const selectedIds = form?.complementoIds ?? [];
  const availableToAdd = complementos.filter((g) => !selectedIds.includes(g.id));

  const addComplemento = (compId: string) => {
    if (!form || selectedIds.includes(compId)) return;
    setForm({ ...form, complementoIds: [...selectedIds, compId] });
  };

  const removeComplemento = (compId: string) => {
    if (!form) return;
    setForm({ ...form, complementoIds: selectedIds.filter((i) => i !== compId) });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black">Itens</h1>
          <p className="text-sm text-slate-400">Categoria cadastrada, nome, preço e complementos opcionais.</p>
        </div>
        <button type="button" onClick={openNew} className="px-4 py-2 bg-indigo-600 rounded-xl text-sm font-bold">
          + Novo item
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-900 text-slate-400 text-left">
            <tr>
              <th className="p-3">Item</th>
              <th className="p-3">Categoria</th>
              <th className="p-3">Preço</th>
              <th className="p-3">Complementos</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {[...produtos]
              .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }))
              .map((p) => {
              const cat = categorias.find((c) => String(c.id) === String(p.categoriaId));
              const comps = orderedComplementoNomes(p.complementoIds || [], complementos);
              return (
                <tr key={p.id}>
                  <td className="p-3 font-bold">{p.nome}</td>
                  <td className="p-3">
                    <span className="inline-flex items-center gap-2">
                      {cat && <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.cor }} />}
                      {cat?.nome || '—'}
                    </span>
                  </td>
                  <td className="p-3 font-mono text-emerald-400">R$ {p.preco.toFixed(2)}</td>
                  <td className="p-3 text-xs text-slate-400">{comps.length ? comps.join(' → ') : '—'}</td>
                  <td className="p-3 text-right space-x-2 text-xs font-bold">
                    <button type="button" onClick={() => setForm(p)} className="text-indigo-400">
                      Editar
                    </button>
                    <button type="button" onClick={() => onSave(produtos.filter((x) => x.id !== p.id))} className="text-red-400">
                      Excluir
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {form && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <form onSubmit={submit} className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-lg space-y-3 my-8">
            <h2 className="font-black text-lg">{produtos.some((x) => x.id === form.id) ? 'Editar item' : 'Novo item'}</h2>

            <div>
              <label className="text-[10px] font-bold uppercase text-slate-500">Categoria</label>
              <select
                required
                value={form.categoriaId || ''}
                onChange={(e) => setForm({ ...form, categoriaId: e.target.value })}
                className="w-full mt-1 bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-sm"
              >
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-slate-500">Nome do item</label>
              <input
                required
                value={form.nome || ''}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                className="w-full mt-1 bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-sm"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-slate-500">Preço (R$)</label>
              <input
                type="number"
                step="0.01"
                min={0}
                required
                value={form.preco ?? 0}
                onChange={(e) => setForm({ ...form, preco: parseFloat(e.target.value) })}
                className="w-full mt-1 bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-sm font-mono"
              />
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.ativo !== false} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} />
              Ativo no app de vendas
            </label>

            <div className="border border-slate-800 rounded-xl p-3 space-y-3">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Complementos (ordem de montagem)</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Ex.: sorvete → recheio → caldo → cobertura. Vale no PDV e nos relatórios do Histórico.
                </p>
              </div>

              {complementos.length === 0 ? (
                <p className="text-xs text-slate-500">Cadastre complementos no menu Complementos.</p>
              ) : selectedIds.length === 0 ? (
                <p className="text-xs text-slate-500">Nenhum grupo selecionado.</p>
              ) : (
                <ul className="space-y-1.5">
                  {selectedIds.map((compId, index) => {
                    const g = complementos.find((c) => c.id === compId);
                    if (!g) return null;
                    return (
                      <li
                        key={compId}
                        className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-2 py-2 text-sm"
                      >
                        <span className="w-6 text-center text-[10px] font-black text-indigo-400">{index + 1}</span>
                        <span className="flex-1 min-w-0 font-bold truncate">{g.nome}</span>
                        <span className="text-[10px] text-slate-500 shrink-0">{g.opcoes.length} op.</span>
                        <div className="flex shrink-0 gap-0.5">
                          <button
                            type="button"
                            title="Subir"
                            disabled={index === 0}
                            onClick={() => setForm({ ...form, complementoIds: moveId(selectedIds, compId, -1) })}
                            className="w-8 h-8 rounded-lg bg-slate-800 text-xs font-black disabled:opacity-30"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            title="Descer"
                            disabled={index === selectedIds.length - 1}
                            onClick={() => setForm({ ...form, complementoIds: moveId(selectedIds, compId, 1) })}
                            className="w-8 h-8 rounded-lg bg-slate-800 text-xs font-black disabled:opacity-30"
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            title="Remover"
                            onClick={() => removeComplemento(compId)}
                            className="w-8 h-8 rounded-lg bg-slate-800 text-red-400 text-xs font-black"
                          >
                            ✕
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              {availableToAdd.length > 0 && (
                <div className="flex flex-wrap gap-2 items-center pt-1 border-t border-slate-800">
                  <select
                    id="add-comp-select"
                    defaultValue=""
                    className="flex-1 min-w-[140px] bg-slate-950 border border-slate-700 rounded-xl px-2 py-2 text-xs"
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v) {
                        addComplemento(v);
                        e.target.value = '';
                      }
                    }}
                  >
                    <option value="">+ Adicionar grupo…</option>
                    {availableToAdd.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.nome}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button type="button" onClick={() => setForm(null)} className="flex-1 py-2 border border-slate-700 rounded-xl text-sm font-bold">
                Cancelar
              </button>
              <button type="submit" className="flex-1 py-2 bg-indigo-600 rounded-xl text-sm font-bold">
                Salvar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
