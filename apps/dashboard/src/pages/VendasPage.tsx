import { useMemo, useState } from 'react';
import type { Venda } from '@gtech/shared';
import {
  relatorioItensVendidos,
  resumoVendas,
  totalFaturamento,
  totalItensVendidos,
  vendasDoAno,
  vendasDoMes,
} from '@gtech/shared';

type Props = {
  vendas: Venda[];
  onChange: () => void;
  onDelete: (id: string) => Promise<void>;
};

type PeriodoRelatorio = 'mes' | 'ano' | 'tudo';

export function VendasPage({ vendas, onChange, onDelete }: Props) {
  const [busca, setBusca] = useState('');
  const [periodoRelatorio, setPeriodoRelatorio] = useState<PeriodoRelatorio>('mes');
  const resumo = resumoVendas(vendas);

  const filtradas = vendas.filter((v) => {
    if (!busca.trim()) return true;
    const t = busca.toLowerCase();
    return v.senha.includes(t) || v.operadorNome?.toLowerCase().includes(t);
  });

  const vendasParaRelatorio = useMemo(() => {
    if (periodoRelatorio === 'mes') return vendasDoMes(vendas);
    if (periodoRelatorio === 'ano') return vendasDoAno(vendas);
    return vendas;
  }, [vendas, periodoRelatorio]);

  const itensRelatorio = useMemo(() => relatorioItensVendidos(vendasParaRelatorio), [vendasParaRelatorio]);
  const totalQtdRelatorio = totalItensVendidos(vendasParaRelatorio);
  const totalFatRelatorio = totalFaturamento(vendasParaRelatorio);

  const tituloPeriodo =
    periodoRelatorio === 'mes'
      ? resumo.labelMes
      : periodoRelatorio === 'ano'
        ? String(resumo.ref.getFullYear())
        : 'Todo histórico';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black">Histórico de vendas</h1>
        <p className="text-sm text-slate-400">Resumo financeiro, relatório de itens e lista de vendas.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MiniStat label="Faturamento diário" value={`R$ ${resumo.faturamentoDiario.toFixed(2)}`} />
        <MiniStat label="Faturamento mensal" value={`R$ ${resumo.faturamentoMensal.toFixed(2)}`} />
        <MiniStat label="Faturamento anual" value={`R$ ${resumo.faturamentoAnual.toFixed(2)}`} />
        <MiniStat label="Itens vendidos (mês)" value={String(resumo.itensVendidosMes)} highlight />
      </div>

      <section className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-black text-white">Relatório de itens vendidos</h2>
            <p className="text-xs text-slate-400 capitalize">{tituloPeriodo}</p>
          </div>
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-bold">
            {(
              [
                ['mes', 'Mês'],
                ['ano', 'Ano'],
                ['tudo', 'Tudo'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setPeriodoRelatorio(id)}
                className={`px-3 py-1.5 rounded-lg ${periodoRelatorio === id ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {itensRelatorio.length === 0 ? (
          <p className="p-6 text-sm text-slate-500 text-center">Nenhum item vendido neste período.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-950 text-slate-400 text-left">
                  <tr>
                    <th className="p-3">#</th>
                    <th className="p-3">Item</th>
                    <th className="p-3 text-right">Qtd. vendida</th>
                    <th className="p-3 text-right">Participação</th>
                    <th className="p-3 text-right">Faturamento</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {itensRelatorio.map((row, idx) => {
                    const pct = totalQtdRelatorio ? (row.quantidade / totalQtdRelatorio) * 100 : 0;
                    return (
                      <tr key={row.chave} className="hover:bg-slate-800/40">
                        <td className="p-3 text-slate-500 font-mono text-xs">{idx + 1}</td>
                        <td className="p-3 font-bold">{row.nome}</td>
                        <td className="p-3 text-right font-mono text-indigo-300">{row.quantidade}</td>
                        <td className="p-3 text-right text-slate-400 text-xs">{pct.toFixed(1)}%</td>
                        <td className="p-3 text-right font-mono text-emerald-400">R$ {row.faturamento.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-slate-950 border-t border-slate-700 text-sm font-black">
                  <tr>
                    <td className="p-3" colSpan={2}>
                      Total
                    </td>
                    <td className="p-3 text-right font-mono text-indigo-300">{totalQtdRelatorio}</td>
                    <td className="p-3 text-right">100%</td>
                    <td className="p-3 text-right font-mono text-emerald-400">R$ {totalFatRelatorio.toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-black text-slate-300">Lista de vendas</h2>
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar senha ou operador..."
          className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm"
        />
        <div className="overflow-x-auto rounded-2xl border border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 text-slate-400 text-left">
              <tr>
                <th className="p-3">Senha</th>
                <th className="p-3">Data</th>
                <th className="p-3">Itens</th>
                <th className="p-3">Operador</th>
                <th className="p-3">Pagamento</th>
                <th className="p-3">Total</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filtradas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-500">
                    Nenhuma venda encontrada.
                  </td>
                </tr>
              ) : (
                filtradas.map((v) => {
                  const qtd = totalItensVendidos([v]);
                  return (
                    <tr key={v.id}>
                      <td className="p-3 font-mono font-black text-amber-400">#{v.senha}</td>
                      <td className="p-3 whitespace-nowrap">
                        {v.data} {v.hora}
                      </td>
                      <td className="p-3 font-mono text-slate-300">{qtd}</td>
                      <td className="p-3 text-slate-400">{v.operadorNome || '—'}</td>
                      <td className="p-3">{v.pagamento}</td>
                      <td className="p-3 font-mono text-emerald-400">R$ {v.total.toFixed(2)}</td>
                      <td className="p-3 text-right">
                        <button
                          type="button"
                          onClick={() => {
                        if (confirm('Excluir esta venda do histórico?')) {
                          void onDelete(v.id).then(onChange);
                        }
                          }}
                          className="text-red-400 text-xs font-bold"
                        >
                          Excluir
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function MiniStat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
      <p className="text-[10px] font-bold uppercase text-slate-500">{label}</p>
      <p className={`text-lg font-black mt-1 ${highlight ? 'text-indigo-400' : 'text-emerald-400'}`}>{value}</p>
    </div>
  );
}
