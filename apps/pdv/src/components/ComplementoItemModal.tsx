import { useEffect, useMemo, useState } from 'react';
import type { Complemento, ItemCarrinho, Produto } from '@gtech/shared';

type Props = {
  produto: Produto;
  complementos: Complemento[];
  onClose: () => void;
  onConfirm: (item: ItemCarrinho) => void;
  newCarrinhoItemId: () => string;
};

export function gruposComplementoDoProduto(produto: Produto, complementos: Complemento[]): Complemento[] {
  const ids = new Set((produto.complementoIds ?? []).map(String));
  return complementos.filter((c) => ids.has(String(c.id)));
}

export function ComplementoItemModal({ produto, complementos, onClose, onConfirm, newCarrinhoItemId }: Props) {
  const grupos = useMemo(
    () => gruposComplementoDoProduto(produto, complementos),
    [produto, complementos],
  );

  const [opcoesIds, setOpcoesIds] = useState<string[]>([]);
  const [qtd, setQtd] = useState(1);
  const [observacao, setObservacao] = useState('');
  const [erro, setErro] = useState('');

  useEffect(() => {
    const initial: string[] = [];
    grupos.forEach((g) => {
      if (g.opcoes.length > 0) initial.push(String(g.opcoes[0].id));
    });
    setOpcoesIds(initial);
    setQtd(1);
    setObservacao('');
    setErro('');
  }, [produto.id, grupos]);

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

  const selecionarOpcao = (grupoId: string, opcaoId: string) => {
    setErro('');
    const grupo = grupos.find((g) => String(g.id) === String(grupoId));
    if (!grupo) return;
    const idsDoGrupo = grupo.opcoes.map((o) => String(o.id));
    setOpcoesIds((prev) => [...prev.filter((id) => !idsDoGrupo.includes(String(id))), String(opcaoId)]);
  };

  const confirmar = () => {
    for (const g of grupos) {
      const tem = g.opcoes.some((o) => opcoesIds.includes(String(o.id)));
      if (!tem) {
        setErro(`Selecione uma opção em "${g.nome}".`);
        return;
      }
    }

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
      carrinhoItemId: newCarrinhoItemId(),
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
            <span>Incluir</span>
            <span className="font-mono bg-indigo-800/80 px-2 py-0.5 rounded-lg">R$ {(precoUnitario * qtd).toFixed(2)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
