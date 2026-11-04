import { useMemo, useState } from 'react';
import type { Complemento, ItemCarrinho, Produto, Venda } from '@gtech/shared';
import { ComplementoItemModal, gruposComplementoDoProduto } from './ComplementoItemModal';

type Props = {
  venda: Venda;
  produtos: Produto[];
  complementos: Complemento[];
  newItemId: () => string;
  onClose: () => void;
  onSave: (venda: Venda, reprint: boolean) => void | Promise<void>;
};

function totalItens(itens: ItemCarrinho[]): number {
  return itens.reduce((s, i) => s + i.subtotal, 0);
}

export function EditVendaModal({
  venda,
  produtos,
  complementos,
  newItemId,
  onClose,
  onSave,
}: Props) {
  const [itens, setItens] = useState<ItemCarrinho[]>(() => venda.itens.map((i) => ({ ...i, opcoes: [...i.opcoes] })));
  const [addOpen, setAddOpen] = useState(false);
  const [itemModal, setItemModal] = useState<{ produto: Produto; editItem?: ItemCarrinho } | null>(null);
  const [saving, setSaving] = useState(false);

  const total = useMemo(() => totalItens(itens), [itens]);
  const troco =
    venda.pagamento === 'Dinheiro' ? Math.max(0, venda.valorRecebido - total) : venda.troco;

  const confirmItem = (item: ItemCarrinho) => {
    setItens((prev) => {
      const idx = prev.findIndex((i) => i.carrinhoItemId === item.carrinhoItemId);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = item;
        return next;
      }
      return [...prev, item];
    });
    setItemModal(null);
  };

  const abrirEdicao = (item: ItemCarrinho) => {
    const prod = produtos.find((p) => String(p.id) === String(item.produtoId));
    if (!prod) return;
    setItemModal({ produto: prod, editItem: item });
  };

  const addProduto = (prod: Produto) => {
    const grupos = gruposComplementoDoProduto(prod, complementos);
    if (grupos.length === 0) {
      confirmItem({
        carrinhoItemId: newItemId(),
        produtoId: prod.id,
        nome: prod.nome,
        precoBase: prod.preco,
        precoUnitario: prod.preco,
        quantidade: 1,
        subtotal: prod.preco,
        opcoes: [],
        observacao: '',
      });
      setAddOpen(false);
      return;
    }
    setItemModal({ produto: prod });
    setAddOpen(false);
  };

  const buildVenda = (): Venda => ({
    ...venda,
    itens,
    total,
    troco,
  });

  const salvar = async (reprint: boolean) => {
    if (!itens.length) return;
    setSaving(true);
    try {
      await onSave(buildVenda(), reprint);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-slate-950/90 z-[60] flex items-end sm:items-center justify-center p-2 sm:p-4">
        <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-lg max-h-[92vh] flex flex-col shadow-2xl">
          <div className="p-4 border-b border-slate-800 flex items-start justify-between gap-2 shrink-0">
            <div>
              <p className="text-xs font-black uppercase text-indigo-400">Editar recibo</p>
              <p className="text-lg font-black font-mono text-amber-400">#{venda.senha}</p>
              <p className="text-sm text-slate-400">
                {venda.data} {venda.hora} · {venda.pagamento}
              </p>
            </div>
            <button type="button" onClick={onClose} className="text-slate-400 p-2 rounded-xl hover:bg-slate-800">
              ✕
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scroll">
            {itens.length === 0 ? (
              <p className="text-center text-sm text-slate-500 py-6">Nenhum item. Adicione ou cancele.</p>
            ) : (
              itens.map((item) => (
                <div
                  key={item.carrinhoItemId}
                  className="p-3 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col gap-2"
                >
                  <div className="flex justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold truncate">
                        {item.quantidade}x {item.nome}
                      </p>
                      {item.opcoes.length > 0 && (
                        <p className="text-xs text-slate-500 mt-0.5">{item.opcoes.map((o) => o.nome).join(' · ')}</p>
                      )}
                    </div>
                    <span className="font-mono text-sm font-bold text-emerald-400 shrink-0">
                      R$ {item.subtotal.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => abrirEdicao(item)}
                      className="flex-1 py-2 rounded-xl bg-indigo-600/80 text-xs font-bold"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => setItens((prev) => prev.filter((i) => i.carrinhoItemId !== item.carrinhoItemId))}
                      className="px-3 py-2 rounded-xl border border-red-500/40 text-red-400 text-xs font-bold"
                    >
                      Remover
                    </button>
                  </div>
                </div>
              ))
            )}

            <button
              type="button"
              onClick={() => setAddOpen((v) => !v)}
              className="w-full py-2.5 rounded-xl border border-dashed border-slate-600 text-sm font-bold text-slate-300"
            >
              {addOpen ? 'Fechar lista' : '+ Adicionar item'}
            </button>

            {addOpen && (
              <div className="max-h-48 overflow-y-auto custom-scroll space-y-1 border border-slate-800 rounded-xl p-2 bg-slate-950">
                {produtos
                  .filter((p) => p.ativo !== false)
                  .map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => addProduto(p)}
                      className="w-full flex justify-between items-center p-2 rounded-lg hover:bg-slate-800 text-left text-sm"
                    >
                      <span className="font-bold truncate pr-2">{p.nome}</span>
                      <span className="font-mono text-emerald-400 shrink-0">R$ {Number(p.preco).toFixed(2)}</span>
                    </button>
                  ))}
              </div>
            )}
          </div>

          <div className="p-4 border-t border-slate-800 space-y-3 shrink-0">
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold text-slate-400">Novo total</span>
              <span className="text-2xl font-black font-mono text-emerald-400">R$ {total.toFixed(2)}</span>
            </div>
            {venda.pagamento === 'Dinheiro' && (
              <p className="text-xs text-slate-500">
                Troco recalculado: <span className="font-mono text-emerald-400">R$ {troco.toFixed(2)}</span>
              </p>
            )}
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                disabled={saving || !itens.length}
                onClick={() => void salvar(false)}
                className="flex-1 py-3 rounded-2xl bg-slate-700 disabled:opacity-50 font-bold text-sm"
              >
                Salvar
              </button>
              <button
                type="button"
                disabled={saving || !itens.length}
                onClick={() => void salvar(true)}
                className="flex-1 py-3 rounded-2xl bg-indigo-600 disabled:opacity-50 font-black text-sm uppercase"
              >
                Salvar e imprimir
              </button>
            </div>
          </div>
        </div>
      </div>

      {itemModal && (
        <ComplementoItemModal
          produto={itemModal.produto}
          complementos={complementos}
          initialItem={itemModal.editItem}
          onClose={() => setItemModal(null)}
          onConfirm={confirmItem}
          newCarrinhoItemId={newItemId}
        />
      )}
    </>
  );
}
