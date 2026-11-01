import { useState } from 'react';
import type { Categoria, Complemento, Produto } from '@gtech/shared';
import { newId } from '@gtech/shared';

type Props = {
  produtos: Produto[];
  categorias: Categoria[];
  complementos: Complemento[];
  onSave: (list: Produto[]) => void;
};

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

  const toggleComp = (compId: string) => {
    if (!form) return;
    const ids = form.complementoIds || [];
    const next = ids.includes(compId) ? ids.filter((i) => i !== compId) : [...ids, compId];
    setForm({ ...form, complementoIds: next });
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
            {produtos.map((p) => {
              const cat = categorias.find((c) => String(c.id) === String(p.categoriaId));
              const comps = (p.complementoIds || [])
                .map((id) => complementos.find((c) => c.id === id)?.nome)
                .filter(Boolean);
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
                  <td className="p-3 text-xs text-slate-400">{comps.length ? comps.join(', ') : '—'}</td>
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

            <div className="border border-slate-800 rounded-xl p-3 space-y-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Complementos (grupos)</p>
              {complementos.length === 0 ? (
                <p className="text-xs text-slate-500">Cadastre complementos no menu Complementos.</p>
              ) : (
                complementos.map((g) => (
                  <label key={g.id} className="flex items-center justify-between gap-2 text-sm cursor-pointer py-1">
                    <span className="flex items-center gap-2 min-w-0">
                      <input type="checkbox" checked={(form.complementoIds || []).includes(g.id)} onChange={() => toggleComp(g.id)} />
                      <span className="font-bold truncate">{g.nome}</span>
                      <span className="text-[10px] text-slate-500 shrink-0">({g.opcoes.length} opções)</span>
                    </span>
                  </label>
                ))
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
