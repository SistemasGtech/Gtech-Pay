import { useState } from 'react';
import type { Categoria } from '@gtech/shared';
import { newId } from '@gtech/shared';

type Props = {
  categorias: Categoria[];
  onSave: (list: Categoria[]) => void;
};

export function CategoriasPage({ categorias, onSave }: Props) {
  const [form, setForm] = useState<Partial<Categoria> | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form?.nome?.trim()) return;
    const cat: Categoria = {
      id: form.id || newId(),
      nome: form.nome.trim(),
      cor: form.cor || '#6366f1',
    };
    const exists = categorias.some((c) => c.id === cat.id);
    onSave(exists ? categorias.map((c) => (c.id === cat.id ? cat : c)) : [...categorias, cat]);
    setForm(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black">Categorias</h1>
          <p className="text-sm text-slate-400">Nome e cor para organizar os itens no PDV.</p>
        </div>
        <button
          type="button"
          onClick={() => setForm({ id: newId(), nome: '', cor: '#6366f1' })}
          className="px-4 py-2 bg-indigo-600 rounded-xl text-sm font-bold"
        >
          + Nova categoria
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-900 text-slate-400 text-left">
            <tr>
              <th className="p-3">Cor</th>
              <th className="p-3">Nome</th>
              <th className="p-3 w-28"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {categorias.map((c) => (
              <tr key={c.id}>
                <td className="p-3">
                  <span className="inline-block w-8 h-8 rounded-lg border border-slate-700" style={{ backgroundColor: c.cor }} />
                </td>
                <td className="p-3 font-bold">{c.nome}</td>
                <td className="p-3 text-right space-x-2 text-xs font-bold">
                  <button type="button" onClick={() => setForm(c)} className="text-indigo-400">
                    Editar
                  </button>
                  <button type="button" onClick={() => onSave(categorias.filter((x) => x.id !== c.id))} className="text-red-400">
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
          <form onSubmit={submit} className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-sm space-y-3">
            <h2 className="font-black text-lg">{categorias.some((c) => c.id === form.id) ? 'Editar categoria' : 'Nova categoria'}</h2>
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-500">Nome</label>
              <input
                required
                value={form.nome || ''}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                className="w-full mt-1 bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-sm"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-500">Cor</label>
              <input
                type="color"
                value={form.cor || '#6366f1'}
                onChange={(e) => setForm({ ...form, cor: e.target.value })}
                className="w-full h-11 rounded-xl cursor-pointer"
              />
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
