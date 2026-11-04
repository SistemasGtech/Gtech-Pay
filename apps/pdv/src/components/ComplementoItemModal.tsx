import { useEffect, useMemo, useState } from 'react';
import type { Complemento, ItemCarrinho, Produto } from '@gtech/shared';

type Props = {
  produto: Produto;
  complementos: Complemento[];
  initialItem?: ItemCarrinho | null;
  onClose: () => void;
  onConfirm: (item: ItemCarrinho) => void;
  newCarrinhoItemId: () => string;
};

export function gruposComplementoDoProduto(produto: Produto, complementos: Complemento[]): Complemento[] {
  const order = (produto.complementoIds ?? []).map(String);
  const byId = new Map(complementos.map((c) => [String(c.id), c]));
  return order.map((id) => byId.get(id)).filter((c): c is Complemento => Boolean(c));
}

export function ComplementoItemModal({
  produto,
  complementos,
  initialItem,
  onClose,
  onConfirm,
  newCarrinhoItemId,
}: Props) {
  const editando = Boolean(initialItem);
  const grupos = useMemo(
    () => gruposComplementoDoProduto(produto, complementos),
    [produto, complementos],
  );

  const [opcoesIds, setOpcoesIds] = useState<string[]>([]);
  const [qtd, setQtd] = useState(1);
  const [observacao, setObservacao] = useState('');
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (initialItem) {
      setOpcoesIds(initialItem.opcoes.map((o) => String(o.id)));
      setQtd(Math.max(1, initialItem.quantidade));
      setObservacao(initialItem.observacao ?? '');
    } else {
      setOpcoesIds([]);
      setQtd(1);
      setObservacao('');
    }
    setErro('');
  }, [produto.id, grupos, initialItem?.carrinhoItemId]);

  const precoUnitario = useMemo(() => {
    let extra = 0;
    for (const opcId of opcoesIds) {
      for (const g of grupos) {
        const opc = g.opcoes.find((o) => String(o.id) === String(opcId));
        if (opc) extra += Number(opc.preco || 0);
      }
    }
    return Number(produto.preco) + extra;
  }, [produto.preco, opcoesIds, grupos]);

  const selecionarOpcao = (_grupoId: string, opcaoId: string) => {
    setErro('');
    const id = String(opcaoId);
    setOpcoesIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const confirmar = () => {
    setErro('');
    const opcoes: ItemCarrinho['opcoes'] = [];
    for (const opcId of opcoesIds) {
      for (const g of grupos) {
        const opc = g.opcoes.find((o) => String(o.id) === String(opcId));
        if (opc) {
          opcoes.push({ id: String(opc.id), nome: opc.nome, preco: Number(opc.preco || 0) });
        }
      }
    }

    onConfirm({
      carrinhoItemId: initialItem?.carrinhoItemId ?? newCarrinhoItemId(),
      produtoId: produto.id,
      nome: produto.nome,
      precoBase: produto.preco,
      precoUnitario,
      quantidade: qtd,
      subtotal: precoUnitario * qtd,
      opcoes,
      observacao: observacao.trim(),
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-3">
      <div className="bg-slate-900 text-white rounded-3xl max-w-lg w-full max-h-[90vh] flex flex-col border border-slate-800 shadow-2xl overflow-hidden">
        <div className="flex items-start justify-between border-b border-slate-800 p-4 shrink-0">
          <div className="min-w-0 pr-2">
            {editando && (
              <p className="text-[10px] font-black uppercase text-indigo-400 mb-0.5">Editar item</p>
            )}
            <h3 className="text-sm font-black uppercase truncate">{produto.nome}</h3>
            <span className="inline-block mt-1 bg-slate-800 text-emerald-400 text-[11px] font-mono font-black px-2 py-0.5 rounded-lg border border-slate-700">
              Base R$ {Number(produto.preco).toFixed(2)}
            </span>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 p-2 hover:bg-slate-800 rounded-xl text-lg leading-none">
            ✕
          </button>
        </div>

        {erro && (
          <p className="mx-4 mt-3 text-xs font-bold text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl p-2.5 shrink-0">
            {erro}
          </p>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scroll">
          {grupos.map((grupo) => (
            <div key={grupo.id} className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-2">
              <p className="text-[10px] font-black uppercase text-slate-400 border-b border-slate-800 pb-2">
                {grupo.nome}
                <span className="normal-case font-bold text-slate-600 ml-1">· opcional · várias</span>
              </p>
              <div className="space-y-1.5">
                {grupo.opcoes.map((opc) => {
                  const sel = opcoesIds.includes(String(opc.id));
                  return (
                    <button
                      key={opc.id}
                      type="button"
                      onClick={() => selecionarOpcao(String(grupo.id), String(opc.id))}
                      className={`w-full flex items-center justify-between p-3 rounded-xl border text-xs font-bold transition-colors ${
                        sel
                          ? 'border-indigo-500 bg-indigo-600 text-white'
                          : 'border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <span>{opc.nome}</span>
                      <span className="font-mono">
                        {opc.preco > 0 ? `+ R$ ${Number(opc.preco).toFixed(2)}` : 'Grátis'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800">
            <label className="text-[10px] font-black uppercase text-slate-400">Observação</label>
            <textarea
              rows={2}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Ex.: sem canela"
              className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-xl p-2 text-xs resize-none"
            />
          </div>
        </div>

        <div className="border-t border-slate-800 p-4 flex flex-wrap items-center gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Qtd</span>
            <button
              type="button"
              onClick={() => setQtd((n) => Math.max(1, n - 1))}
              className="w-8 h-8 rounded-xl bg-slate-800 font-black"
            >
              −
            </button>
            <span className="w-6 text-center font-mono font-black">{qtd}</span>
            <button type="button" onClick={() => setQtd((n) => n + 1)} className="w-8 h-8 rounded-xl bg-slate-800 font-black">
              +
            </button>
          </div>
          <button
            type="button"
            onClick={confirmar}
            className="flex-1 min-w-[140px] flex items-center justify-between gap-2 bg-indigo-600 hover:bg-indigo-500 py-3 px-4 rounded-2xl text-xs font-black uppercase"
          >
            <span>{editando ? 'Salvar' : 'Incluir'}</span>
            <span className="font-mono bg-indigo-800/80 px-2 py-0.5 rounded-lg">R$ {(precoUnitario * qtd).toFixed(2)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
