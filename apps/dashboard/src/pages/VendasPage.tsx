import { useMemo, useState, type ReactNode } from 'react';
import type { Venda } from '@gtech/shared';
import {
  relatorioComplementosSaboresMesAno,
  relatorioItensVendidos,
  resumoVendas,
  totalFaturamento,
  totalItensVendidos,
  vendasDoAno,
  vendasDoDia,
  vendasDoMes,
  vendaDate,
} from '@gtech/shared';

type Props = {
  vendas: Venda[];
  onChange: () => void;
  onDelete: (id: string) => Promise<void>;
};

type PeriodoRelatorio = 'dia' | 'mes' | 'ano' | 'tudo';

function hojeIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDataRef(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  if (y && m && d) return new Date(y, m - 1, d);
  return new Date();
}

function vendasNoPeriodo(vendas: Venda[], periodo: PeriodoRelatorio, dataRef: Date): Venda[] {
  if (periodo === 'dia') return vendasDoDia(vendas, dataRef);
  if (periodo === 'mes') return vendasDoMes(vendas, dataRef);
  if (periodo === 'ano') return vendasDoAno(vendas, dataRef);
  return vendas;
}

function tituloPeriodo(periodo: PeriodoRelatorio, dataRef: Date, labelMes: string): string {
  if (periodo === 'dia') {
    return dataRef.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  }
  if (periodo === 'mes') return labelMes;
  if (periodo === 'ano') return String(dataRef.getFullYear());
  return 'Todo histórico';
}

export function VendasPage({ vendas, onChange, onDelete }: Props) {
  const [busca, setBusca] = useState('');
  const [periodoRelatorio, setPeriodoRelatorio] = useState<PeriodoRelatorio>('mes');
  const [dataRefIso, setDataRefIso] = useState(hojeIso);
  const [listaExpandida, setListaExpandida] = useState(false);

  const dataRef = parseDataRef(dataRefIso);
  const resumo = resumoVendas(vendas, dataRef);

  const vendasParaRelatorio = useMemo(
    () => vendasNoPeriodo(vendas, periodoRelatorio, dataRef),
    [vendas, periodoRelatorio, dataRefIso],
  );

  const itensRelatorio = useMemo(() => relatorioItensVendidos(vendasParaRelatorio), [vendasParaRelatorio]);
  const saboresRelatorio = useMemo(() => relatorioComplementosSaboresMesAno(vendas, dataRef), [vendas, dataRefIso]);
  const totalQtdRelatorio = totalItensVendidos(vendasParaRelatorio);
  const totalFatRelatorio = totalFaturamento(vendasParaRelatorio);
  const totalQtdSaboresMes = saboresRelatorio.reduce((s, r) => s + r.quantidadeMes, 0);
  const totalQtdSaboresAno = saboresRelatorio.reduce((s, r) => s + r.quantidadeAno, 0);

  const titulo = tituloPeriodo(periodoRelatorio, dataRef, resumo.labelMes);

  const filtradas = useMemo(() => {
    const noPeriodo = vendasNoPeriodo(vendas, periodoRelatorio, dataRef);
    const ordenadas = [...noPeriodo].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    if (!busca.trim()) return ordenadas;
    const t = busca.toLowerCase();
    return ordenadas.filter((v) => v.senha.includes(t) || v.operadorNome?.toLowerCase().includes(t));
  }, [vendas, periodoRelatorio, dataRefIso, busca]);

  const ultimasDatas = useMemo(() => {
    const set = new Set<string>();
    for (const v of vendas) {
      const d = vendaDate(v);
      if (!Number.isNaN(d.getTime())) {
        const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        set.add(iso);
      }
    }
    return [...set].sort().reverse().slice(0, 8);
  }, [vendas]);

  const periodoBotoes: { id: PeriodoRelatorio; label: string }[] = [
    { id: 'dia', label: 'Dia' },
    { id: 'mes', label: 'Mês' },
    { id: 'ano', label: 'Ano' },
    { id: 'tudo', label: 'Tudo' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black">Histórico de vendas</h1>
        <p className="text-sm text-slate-400">Resumo financeiro, relatórios e lista de vendas filtrada por período.</p>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-end gap-3 flex-wrap">
        <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-bold">
          {periodoBotoes.map(({ id, label }) => (
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
        {periodoRelatorio !== 'tudo' && (
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
              {periodoRelatorio === 'dia' ? 'Data' : periodoRelatorio === 'mes' ? 'Mês de referência' : 'Ano de referência'}
            </label>
            <input
              type="date"
              value={dataRefIso}
              onChange={(e) => setDataRefIso(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono"
            />
          </div>
        )}
        {ultimasDatas.length > 0 && periodoRelatorio === 'dia' && (
          <div className="flex flex-wrap gap-1 items-center">
            <span className="text-[10px] text-slate-500 font-bold uppercase">Rápido:</span>
            {ultimasDatas.map((iso) => (
              <button
                key={iso}
                type="button"
                onClick={() => setDataRefIso(iso)}
                className={`text-[10px] font-bold px-2 py-1 rounded-lg border ${
                  dataRefIso === iso ? 'border-indigo-500 text-indigo-300 bg-indigo-950/40' : 'border-slate-800 text-slate-400'
                }`}
              >
                {parseDataRef(iso).toLocaleDateString('pt-BR')}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MiniStat label="Faturamento diário" value={`R$ ${resumo.faturamentoDiario.toFixed(2)}`} />
        <MiniStat label="Faturamento mensal" value={`R$ ${resumo.faturamentoMensal.toFixed(2)}`} />
        <MiniStat label="Faturamento anual" value={`R$ ${resumo.faturamentoAnual.toFixed(2)}`} />
        <MiniStat label="Itens vendidos (mês)" value={String(resumo.itensVendidosMes)} highlight />
      </div>

      <RelatorioTabela
        titulo="Relatório de itens vendidos"
        subtitulo={titulo}
        vazio="Nenhum item vendido neste período."
        rows={itensRelatorio}
        totalQtd={totalQtdRelatorio}
        totalFat={totalFatRelatorio}
        renderRow={(row, idx, totalQtd) => {
          const pct = totalQtd ? (row.quantidade / totalQtd) * 100 : 0;
          return (
            <tr key={row.chave} className="hover:bg-slate-800/40">
              <td className="p-3 text-slate-500 font-mono text-xs">{idx + 1}</td>
              <td className="p-3 font-bold">{row.nome}</td>
              <td className="p-3 text-right font-mono text-indigo-300">{row.quantidade}</td>
              <td className="p-3 text-right text-slate-400 text-xs">{pct.toFixed(1)}%</td>
              <td className="p-3 text-right font-mono text-emerald-400">R$ {row.faturamento.toFixed(2)}</td>
            </tr>
          );
        }}
        headExtra={null}
      />

      <section className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-800">
          <h2 className="text-sm font-black text-white">Relatório de complementos vendidos</h2>
          <p className="text-xs text-slate-400">
            Sabores iguais somados · mês: <span className="capitalize text-slate-300">{resumo.labelMes}</span> · ano:{' '}
            {dataRef.getFullYear()}
          </p>
        </div>

        {saboresRelatorio.length === 0 ? (
          <p className="p-6 text-sm text-slate-500 text-center">Nenhum complemento vendido no mês ou no ano de referência.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-950 text-slate-400 text-left">
                <tr>
                  <th className="p-3">#</th>
                  <th className="p-3">Sabor</th>
                  <th className="p-3 text-right">Qtd. mês</th>
                  <th className="p-3 text-right">Part. mês</th>
                  <th className="p-3 text-right">Qtd. ano</th>
                  <th className="p-3 text-right">Part. ano</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {saboresRelatorio.map((row, idx) => {
                  const pctMes = totalQtdSaboresMes ? (row.quantidadeMes / totalQtdSaboresMes) * 100 : 0;
                  const pctAno = totalQtdSaboresAno ? (row.quantidadeAno / totalQtdSaboresAno) * 100 : 0;
                  return (
                    <tr key={row.chave} className="hover:bg-slate-800/40">
                      <td className="p-3 text-slate-500 font-mono text-xs">{idx + 1}</td>
                      <td className="p-3 font-bold">{row.nome}</td>
                      <td className="p-3 text-right font-mono text-indigo-300">{row.quantidadeMes}</td>
                      <td className="p-3 text-right text-slate-400 text-xs">{pctMes.toFixed(1)}%</td>
                      <td className="p-3 text-right font-mono text-amber-300/90">{row.quantidadeAno}</td>
                      <td className="p-3 text-right text-slate-400 text-xs">{pctAno.toFixed(1)}%</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-950 border-t border-slate-700 text-sm font-black">
                <tr>
                  <td className="p-3" colSpan={2}>
                    Total
                  </td>
                  <td className="p-3 text-right font-mono text-indigo-300">{totalQtdSaboresMes}</td>
                  <td className="p-3 text-right">100%</td>
                  <td className="p-3 text-right font-mono text-amber-300/90">{totalQtdSaboresAno}</td>
                  <td className="p-3 text-right">100%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      <section className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <button
          type="button"
          onClick={() => setListaExpandida((v) => !v)}
          className="w-full p-4 flex flex-wrap items-center justify-between gap-3 text-left hover:bg-slate-800/30"
          aria-expanded={listaExpandida}
        >
          <div>
            <h2 className="text-sm font-black text-white">Lista de vendas</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {filtradas.length} {filtradas.length === 1 ? 'venda' : 'vendas'} · {titulo}
              {!listaExpandida && ' · toque para expandir'}
            </p>
          </div>
          <span className="text-xs font-black text-indigo-400 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800">
            {listaExpandida ? 'Recolher ▲' : 'Expandir ▼'}
          </span>
        </button>

        {listaExpandida && (
          <div className="border-t border-slate-800 p-4 space-y-3">
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar senha ou operador..."
              className="w-full max-w-md bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm"
            />
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-sm">
                <thead className="bg-slate-950 text-slate-400 text-left">
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
                        Nenhuma venda neste período.
                      </td>
                    </tr>
                  ) : (
                    filtradas.map((v) => {
                      const qtd = totalItensVendidos([v]);
                      const comps = (v.itens || []).reduce((s, it) => s + (it.opcoes?.length || 0), 0);
                      return (
                        <tr key={v.id} className="hover:bg-slate-800/30">
                          <td className="p-3 font-mono font-black text-amber-400">#{v.senha}</td>
                          <td className="p-3 whitespace-nowrap text-xs">
                            {v.data} {v.hora}
                          </td>
                          <td className="p-3 font-mono text-slate-300">
                            {qtd}
                            {comps > 0 && <span className="text-slate-500 text-[10px] block">{comps} compl.</span>}
                          </td>
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
          </div>
        )}
      </section>
    </div>
  );
}

type RelatorioRow = { chave: string; quantidade: number; faturamento: number };

function RelatorioTabela<T extends RelatorioRow>({
  titulo,
  subtitulo,
  vazio,
  rows,
  totalQtd,
  totalFat,
  renderRow,
  headExtra,
  footColSpan = 2,
}: {
  titulo: string;
  subtitulo: string;
  vazio: string;
  rows: T[];
  totalQtd: number;
  totalFat: number;
  renderRow: (row: T, idx: number, totalQtd: number) => ReactNode;
  headExtra: ReactNode;
  footColSpan?: number;
}) {
  return (
    <section className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
      <div className="p-4 border-b border-slate-800">
        <h2 className="text-sm font-black text-white">{titulo}</h2>
        <p className="text-xs text-slate-400 capitalize">{subtitulo}</p>
      </div>

      {rows.length === 0 ? (
        <p className="p-6 text-sm text-slate-500 text-center">{vazio}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-950 text-slate-400 text-left">
              <tr>
                <th className="p-3">#</th>
                <th className="p-3">{titulo.includes('complemento') ? 'Opção' : 'Item'}</th>
                <th className="p-3 text-right">Qtd.</th>
                {headExtra}
                <th className="p-3 text-right">Part.</th>
                <th className="p-3 text-right">Faturamento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">{rows.map((row, idx) => renderRow(row, idx, totalQtd))}</tbody>
            <tfoot className="bg-slate-950 border-t border-slate-700 text-sm font-black">
              <tr>
                <td className="p-3" colSpan={footColSpan}>
                  Total
                </td>
                <td className="p-3 text-right font-mono text-indigo-300">{totalQtd}</td>
                {headExtra ? <td className="p-3" colSpan={3} /> : null}
                <td className="p-3 text-right">100%</td>
                <td className="p-3 text-right font-mono text-emerald-400">R$ {totalFat.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
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
