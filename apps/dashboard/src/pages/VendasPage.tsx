import { useEffect, useMemo, useState } from 'react';
import type { Categoria, Complemento, LojaInfo, Produto, TaxasMaquininha, TipoPagamentoResumo, Venda } from '@gtech/shared';
import { taxasMaquininhaEfetivas } from '@gtech/shared';
import { TaxaMaquininhaInput } from '../components/TaxaMaquininhaInput';
import {
  relatorioComplementosSaboresMesAno,
  relatorioItensComComplementosPorCategoria,
  relatorioTiposPagamento,
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
  produtos: Produto[];
  categorias: Categoria[];
  complementos: Complemento[];
  loja: LojaInfo;
  onSaveTaxasMaquininha: (taxas: TaxasMaquininha) => void;
  onChange: () => void;
  onDelete: (id: string) => Promise<void>;
};

type PeriodoRelatorio = 'dia' | 'mes' | 'ano' | 'tudo';
type AbaHistorico = 'itens' | 'pagamentos';

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

export function VendasPage({ vendas, produtos, categorias, complementos, loja, onSaveTaxasMaquininha, onChange, onDelete }: Props) {
  const [busca, setBusca] = useState('');
  const [periodoRelatorio, setPeriodoRelatorio] = useState<PeriodoRelatorio>('mes');
  const [dataRefIso, setDataRefIso] = useState(hojeIso);
  const [listaExpandida, setListaExpandida] = useState(false);
  const [aba, setAba] = useState<AbaHistorico>('itens');
  const [relatorioItensExpandido, setRelatorioItensExpandido] = useState(true);
  const [relatorioComplementosExpandido, setRelatorioComplementosExpandido] = useState(true);
  const [categoriasMinimizadas, setCategoriasMinimizadas] = useState<Record<string, boolean>>({});
  const [itensMinimizados, setItensMinimizados] = useState<Record<string, boolean>>({});
  const [taxasForm, setTaxasForm] = useState<TaxasMaquininha>(() => taxasMaquininhaEfetivas(loja));

  useEffect(() => {
    setTaxasForm(taxasMaquininhaEfetivas(loja));
  }, [loja]);

  const dataRef = parseDataRef(dataRefIso);
  const resumo = resumoVendas(vendas, dataRef);

  const vendasParaRelatorio = useMemo(
    () => vendasNoPeriodo(vendas, periodoRelatorio, dataRef),
    [vendas, periodoRelatorio, dataRefIso],
  );

  const relatorioPorCategoria = useMemo(
    () => relatorioItensComComplementosPorCategoria(vendasParaRelatorio, complementos, produtos, categorias),
    [vendasParaRelatorio, complementos, produtos, categorias],
  );

  const pagamentosDia = useMemo(
    () => relatorioTiposPagamento(vendasDoDia(vendas, dataRef), taxasForm),
    [vendas, dataRefIso, taxasForm],
  );
  const pagamentosMes = useMemo(
    () => relatorioTiposPagamento(vendasDoMes(vendas, dataRef), taxasForm),
    [vendas, dataRefIso, taxasForm],
  );
  const pagamentosAno = useMemo(
    () => relatorioTiposPagamento(vendasDoAno(vendas, dataRef), taxasForm),
    [vendas, dataRefIso, taxasForm],
  );

  const toggleCategoriaMinimizada = (id: string) => {
    setCategoriasMinimizadas((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleItemMinimizado = (chave: string) => {
    setItensMinimizados((prev) => ({ ...prev, [chave]: !prev[chave] }));
  };
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
        {aba === 'itens' && (
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
        )}
        {(aba === 'pagamentos' || periodoRelatorio !== 'tudo') && (
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
              {aba === 'pagamentos' ? 'Data de referência' : periodoRelatorio === 'dia' ? 'Data' : periodoRelatorio === 'mes' ? 'Mês de referência' : 'Ano de referência'}
            </label>
            <input
              type="date"
              value={dataRefIso}
              onChange={(e) => setDataRefIso(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono"
            />
          </div>
        )}
        {aba === 'itens' && ultimasDatas.length > 0 && periodoRelatorio === 'dia' && (
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

      {aba === 'itens' && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MiniStat label="Faturamento diário" value={`R$ ${resumo.faturamentoDiario.toFixed(2)}`} />
          <MiniStat label="Faturamento mensal" value={`R$ ${resumo.faturamentoMensal.toFixed(2)}`} />
          <MiniStat label="Faturamento anual" value={`R$ ${resumo.faturamentoAnual.toFixed(2)}`} />
          <MiniStat label="Itens vendidos (mês)" value={String(resumo.itensVendidosMes)} highlight />
        </div>
      )}

      <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-sm font-bold w-fit">
        <button
          type="button"
          onClick={() => setAba('itens')}
          className={`px-4 py-2 rounded-lg ${aba === 'itens' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
        >
          Itens
        </button>
        <button
          type="button"
          onClick={() => setAba('pagamentos')}
          className={`px-4 py-2 rounded-lg ${aba === 'pagamentos' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
        >
          Tipos de pagamento
        </button>
      </div>

      {aba === 'itens' && (
      <section className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <button
          type="button"
          onClick={() => setRelatorioItensExpandido((v) => !v)}
          className="w-full p-4 flex flex-wrap items-center justify-between gap-3 text-left hover:bg-slate-800/30 border-b border-slate-800"
          aria-expanded={relatorioItensExpandido}
        >
          <div>
            <h2 className="text-sm font-black text-white">Relatório de itens vendidos</h2>
            <p className="text-xs text-slate-400 capitalize mt-0.5">
              {titulo} · por categoria, na ordem do catálogo
              {!relatorioItensExpandido && ' · toque para expandir'}
            </p>
            <div className="flex flex-wrap gap-4 mt-2 text-xs font-bold">
              <span className="text-indigo-300">{totalQtdRelatorio} itens</span>
              <span className="text-emerald-400">R$ {totalFatRelatorio.toFixed(2)}</span>
            </div>
          </div>
          <span className="text-xs font-black text-indigo-400 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 shrink-0">
            {relatorioItensExpandido ? 'Minimizar ▲' : 'Expandir ▼'}
          </span>
        </button>

        {relatorioItensExpandido &&
          (relatorioPorCategoria.length === 0 ? (
            <p className="p-6 text-sm text-slate-500 text-center">Nenhum item vendido neste período.</p>
          ) : (
            <div className="divide-y divide-slate-800">
              {relatorioPorCategoria.map((cat) => {
                const catMin = Boolean(categoriasMinimizadas[cat.categoriaId]);
                return (
                  <div key={cat.categoriaId} className="bg-slate-900/50">
                    <div className="p-3 md:p-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 bg-slate-950/40">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: cat.cor }}
                          aria-hidden
                        />
                        <h3 className="text-sm font-black text-white uppercase tracking-wide truncate">
                          {cat.categoriaNome}
                        </h3>
                        <span className="text-[10px] font-bold text-slate-500">
                          {cat.totalItensQtd} un. · R$ {cat.totalFaturamento.toFixed(2)}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleCategoriaMinimizada(cat.categoriaId)}
                        className="text-xs font-black text-slate-400 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-600"
                        aria-expanded={!catMin}
                      >
                        {catMin ? 'Expandir ▼' : 'Minimizar ▲'}
                      </button>
                    </div>

                    {!catMin && (
                      <div className="divide-y divide-slate-800/80">
                        {cat.itens.map((item, itemIdx) => {
                          const pctItem = cat.totalItensQtd ? (item.quantidade / cat.totalItensQtd) * 100 : 0;
                          const itemMin = Boolean(itensMinimizados[item.chave]);
                          return (
                            <div key={item.chave} className="p-4 space-y-3">
                              <div className="flex flex-wrap items-baseline justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-slate-500 font-mono text-xs shrink-0">{itemIdx + 1}.</span>
                                  <h4 className="text-base font-bold text-white truncate">{item.nome}</h4>
                                </div>
                                <div className="flex flex-wrap items-center gap-2 shrink-0">
                                  <div className="flex flex-wrap gap-3 text-xs font-bold">
                                    <span className="font-mono text-indigo-300">{item.quantidade} un.</span>
                                    <span className="text-slate-500">{pctItem.toFixed(1)}% da categoria</span>
                                    <span className="font-mono text-emerald-400">R$ {item.faturamento.toFixed(2)}</span>
                                  </div>
                                  {item.gruposComplemento.length > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => toggleItemMinimizado(item.chave)}
                                      className="text-[10px] font-black text-slate-500 px-2 py-1 rounded-lg border border-slate-800 hover:text-slate-300"
                                      aria-expanded={!itemMin}
                                    >
                                      {itemMin ? 'Expandir compl. ▼' : 'Minimizar compl. ▲'}
                                    </button>
                                  )}
                                </div>
                              </div>

                              {!itemMin &&
                                (item.gruposComplemento.length === 0 ? (
                                  <p className="text-xs text-slate-600 pl-6">Sem complementos neste período.</p>
                                ) : (
                                  <div className="pl-4 md:pl-6 space-y-2 border-l-2 border-slate-800">
                                    {item.gruposComplemento.map((grupo) => (
                                      <div
                                        key={grupo.grupoId}
                                        className="rounded-xl border border-slate-800 bg-slate-950/50 overflow-hidden"
                                      >
                                        {item.gruposComplemento.length > 1 && (
                                          <div className="px-3 py-1.5 border-b border-slate-800 text-[10px] font-black uppercase text-slate-500">
                                            {grupo.grupoNome}
                                          </div>
                                        )}
                                        <table className="w-full text-sm">
                                          <tbody className="divide-y divide-slate-800/60">
                                            {grupo.opcoes.map((op, rank) => {
                                              const pct = grupo.totalQtd ? (op.quantidade / grupo.totalQtd) * 100 : 0;
                                              return (
                                                <tr key={op.opcaoId} className="hover:bg-slate-800/25">
                                                  <td className="p-2 pl-3 font-medium text-slate-200">
                                                    <span
                                                      className={`inline-flex items-center justify-center min-w-[1.25rem] mr-2 text-[10px] font-black rounded-md px-1 ${
                                                        rank === 0
                                                          ? 'bg-amber-500/20 text-amber-300'
                                                          : 'bg-slate-800 text-slate-500'
                                                      }`}
                                                    >
                                                      {rank + 1}
                                                    </span>
                                                    {op.nome}
                                                  </td>
                                                  <td className="p-2 text-right font-mono text-indigo-300 whitespace-nowrap">
                                                    {op.quantidade}
                                                  </td>
                                                  <td className="p-2 pr-3 text-right text-slate-400 text-xs whitespace-nowrap w-16">
                                                    {pct.toFixed(0)}%
                                                  </td>
                                                </tr>
                                              );
                                            })}
                                          </tbody>
                                        </table>
                                      </div>
                                    ))}
                                  </div>
                                ))}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
      </section>
      )}

      {aba === 'pagamentos' && (
        <div className="space-y-4">
          <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div>
              <h2 className="text-sm font-black text-white">Taxas da maquininha (teste)</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Informe só as taxas de <strong className="text-slate-300">débito</strong> e <strong className="text-slate-300">crédito</strong> até o líquido bater com o extrato.
                Bruto = total no PDV; líquido = bruto menos taxa.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 max-w-md">
              <TaxaMaquininhaInput
                label="Débito %"
                value={taxasForm.cartaoDebito}
                resetKey={`${loja.taxasMaquininha?.cartaoDebito}-${loja.taxasMaquininha?.cartaoCredito}`}
                onChange={(v) => setTaxasForm((prev) => ({ ...prev, cartaoDebito: v }))}
              />
              <TaxaMaquininhaInput
                label="Crédito %"
                value={taxasForm.cartaoCredito}
                resetKey={`${loja.taxasMaquininha?.cartaoDebito}-${loja.taxasMaquininha?.cartaoCredito}`}
                onChange={(v) => setTaxasForm((prev) => ({ ...prev, cartaoCredito: v }))}
              />
            </div>
            <button
              type="button"
              onClick={() => onSaveTaxasMaquininha(taxasForm)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xs font-bold"
            >
              Salvar taxas na loja
            </button>
          </section>
          <TabelaPagamentos titulo="Dia" rows={pagamentosDia} />
          <TabelaPagamentos titulo="Mês" rows={pagamentosMes} />
          <TabelaPagamentos titulo="Ano" rows={pagamentosAno} />
        </div>
      )}

      {aba === 'itens' && (
        <>
      <section className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <button
          type="button"
          onClick={() => setRelatorioComplementosExpandido((v) => !v)}
          className="w-full p-4 flex flex-wrap items-center justify-between gap-3 text-left hover:bg-slate-800/30 border-b border-slate-800"
          aria-expanded={relatorioComplementosExpandido}
        >
          <div>
            <h2 className="text-sm font-black text-white">Relatório de complementos vendidos</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Sabores iguais somados · mês: <span className="capitalize text-slate-300">{resumo.labelMes}</span> · ano:{' '}
              {dataRef.getFullYear()}
              {!relatorioComplementosExpandido && ' · toque para expandir'}
            </p>
            {saboresRelatorio.length > 0 && (
              <p className="text-[10px] font-bold text-slate-500 mt-2">
                {saboresRelatorio.length} {saboresRelatorio.length === 1 ? 'sabor' : 'sabores'} · mês {totalQtdSaboresMes} · ano{' '}
                {totalQtdSaboresAno}
              </p>
            )}
          </div>
          <span className="text-xs font-black text-indigo-400 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 shrink-0">
            {relatorioComplementosExpandido ? 'Minimizar ▲' : 'Expandir ▼'}
          </span>
        </button>

        {relatorioComplementosExpandido &&
          (saboresRelatorio.length === 0 ? (
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
          ))}
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
        </>
      )}
    </div>
  );
}

function TabelaPagamentos({
  titulo,
  rows,
}: {
  titulo: string;
  rows: TipoPagamentoResumo[];
}) {
  const totalQtd = rows.reduce((s, r) => s + r.quantidade, 0);
  const totalBruto = rows.reduce((s, r) => s + r.faturamento, 0);
  const totalTaxas = rows.reduce((s, r) => s + r.valorTaxa, 0);
  const totalLiquido = rows.reduce((s, r) => s + r.liquido, 0);

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
      <div className="p-4 border-b border-slate-800">
        <h2 className="text-sm font-black text-white">{titulo}</h2>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs font-bold">
          <span className="text-indigo-300">
            {totalQtd} {totalQtd === 1 ? 'venda' : 'vendas'}
          </span>
          <span className="text-emerald-400">Bruto R$ {totalBruto.toFixed(2)}</span>
          <span className="text-red-400/90">Taxas −R$ {totalTaxas.toFixed(2)}</span>
          <span className="text-amber-300">Líquido R$ {totalLiquido.toFixed(2)}</span>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="p-6 text-sm text-slate-500 text-center">Nenhuma venda neste período.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-950 text-slate-400 text-left">
              <tr>
                <th className="p-3">#</th>
                <th className="p-3">Tipo</th>
                <th className="p-3 text-right">Vendas</th>
                <th className="p-3 text-right">Bruto</th>
                <th className="p-3 text-right">Taxa %</th>
                <th className="p-3 text-right">Taxa R$</th>
                <th className="p-3 text-right">Líquido</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {rows.map((row, idx) => {
                const destaque =
                  row.pagamento === 'Cartão Débito' || row.pagamento === 'Cartão Crédito';
                return (
                  <tr
                    key={row.pagamento}
                    className={`hover:bg-slate-800/40 ${destaque ? 'bg-indigo-950/20' : ''}`}
                  >
                    <td className="p-3 text-slate-500 font-mono text-xs">{idx + 1}</td>
                    <td className="p-3 font-bold">{row.pagamento}</td>
                    <td className="p-3 text-right font-mono text-indigo-300">{row.quantidade}</td>
                    <td className="p-3 text-right font-mono text-emerald-400">R$ {row.faturamento.toFixed(2)}</td>
                    <td className="p-3 text-right font-mono text-slate-400 text-xs">
                      {row.taxaPercent > 0 ? `${row.taxaPercent.toFixed(2)}%` : '—'}
                    </td>
                    <td className="p-3 text-right font-mono text-red-400/90 text-xs">
                      {row.valorTaxa > 0 ? `−R$ ${row.valorTaxa.toFixed(2)}` : '—'}
                    </td>
                    <td className="p-3 text-right font-mono text-amber-300">R$ {row.liquido.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-slate-950 border-t border-slate-700 text-sm font-black">
              <tr>
                <td className="p-3" colSpan={2}>
                  Total
                </td>
                <td className="p-3 text-right font-mono text-indigo-300">{totalQtd}</td>
                <td className="p-3 text-right font-mono text-emerald-400">R$ {totalBruto.toFixed(2)}</td>
                <td className="p-3" />
                <td className="p-3 text-right font-mono text-red-400/90 text-xs">−R$ {totalTaxas.toFixed(2)}</td>
                <td className="p-3 text-right font-mono text-amber-300">R$ {totalLiquido.toFixed(2)}</td>
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
