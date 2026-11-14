import { useMemo } from 'react';
import type { LojaInfo, Venda } from '@gtech/shared';
import {
  faturamentoBrutoLiquido,
  resumoVendas,
  vendasDoAno,
  vendasDoDia,
  vendasDoMes,
} from '@gtech/shared';

export function OverviewPage({ vendas, loja }: { vendas: Venda[]; loja: LojaInfo }) {
  const resumo = resumoVendas(vendas);
  const hoje = vendasDoDia(vendas, resumo.ref);
  const ticketMedio = hoje.length ? resumo.faturamentoDiario / hoje.length : 0;

  const recebimentoDia = useMemo(
    () => faturamentoBrutoLiquido(vendasDoDia(vendas, resumo.ref), loja),
    [vendas, resumo.ref, loja],
  );
  const recebimentoMes = useMemo(
    () => faturamentoBrutoLiquido(vendasDoMes(vendas, resumo.ref), loja),
    [vendas, resumo.ref, loja],
  );
  const recebimentoAno = useMemo(
    () => faturamentoBrutoLiquido(vendasDoAno(vendas, resumo.ref), loja),
    [vendas, resumo.ref, loja],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white">Visão geral</h1>
        <p className="text-sm text-slate-400">Faturamento e volume de itens vendidos.</p>
      </div>

      <section>
        <h2 className="text-xs font-black uppercase text-slate-500 tracking-wider mb-3">Faturamento</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard label="Diário (hoje)" value={`R$ ${resumo.faturamentoDiario.toFixed(2)}`} accent="text-emerald-400" />
          <StatCard label="Mensal" value={`R$ ${resumo.faturamentoMensal.toFixed(2)}`} accent="text-emerald-400" sub={resumo.labelMes} />
          <StatCard label="Anual" value={`R$ ${resumo.faturamentoAnual.toFixed(2)}`} accent="text-emerald-400" sub={String(resumo.ref.getFullYear())} />
        </div>
      </section>

      <section>
        <h2 className="text-xs font-black uppercase text-slate-500 tracking-wider mb-3">Bruto e líquido</h2>
        <p className="text-xs text-slate-500 mb-3 -mt-1">
          Estimativa com taxas de débito/crédito do histórico (PIX e dinheiro entram sem desconto).
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <RecebimentoCard label="Hoje" dados={recebimentoDia} />
          <RecebimentoCard label="Mês" dados={recebimentoMes} sub={resumo.labelMes} />
          <RecebimentoCard label="Ano" dados={recebimentoAno} sub={String(resumo.ref.getFullYear())} />
        </div>
      </section>

      <section>
        <h2 className="text-xs font-black uppercase text-slate-500 tracking-wider mb-3">Volume</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Itens vendidos no mês" value={String(resumo.itensVendidosMes)} accent="text-indigo-400" sub={resumo.labelMes} />
          <StatCard label="Vendas hoje" value={String(resumo.vendasHoje)} accent="text-indigo-400" />
          <StatCard label="Vendas no mês" value={String(resumo.vendasMes)} accent="text-indigo-400" />
          <StatCard label="Ticket médio (hoje)" value={`R$ ${ticketMedio.toFixed(2)}`} accent="text-amber-400" />
        </div>
      </section>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
        <h2 className="text-sm font-bold text-slate-300 mb-3">Últimas vendas do dia</h2>
        {hoje.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma venda registrada hoje.</p>
        ) : (
          <ul className="divide-y divide-slate-800">
            {hoje.slice(0, 8).map((v) => {
              const qtd = (v.itens || []).reduce((s, it) => s + (it.quantidade || 1), 0);
              return (
                <li key={v.id} className="py-2 flex justify-between text-sm gap-2">
                  <span>
                    <span className="font-mono font-bold text-amber-400 mr-2">#{v.senha}</span>
                    {v.hora}
                    <span className="text-slate-500 ml-1">({qtd} it.)</span>
                  </span>
                  <span className="font-mono text-emerald-400 shrink-0">R$ {v.total.toFixed(2)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function RecebimentoCard({
  label,
  dados,
  sub,
}: {
  label: string;
  dados: { bruto: number; taxas: number; liquido: number };
  sub?: string;
}) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
      <div>
        <p className="text-[11px] font-bold uppercase text-slate-500 tracking-wide">{label}</p>
        {sub && <p className="text-[10px] text-slate-600 capitalize mt-0.5">{sub}</p>}
      </div>
      <div className="flex justify-between items-baseline gap-2 text-sm">
        <span className="text-slate-500 font-bold">Bruto</span>
        <span className="font-mono font-black text-emerald-400">R$ {dados.bruto.toFixed(2)}</span>
      </div>
      {dados.taxas > 0 && (
        <div className="flex justify-between items-baseline gap-2 text-xs">
          <span className="text-slate-500">Taxas est.</span>
          <span className="font-mono text-red-400/90">−R$ {dados.taxas.toFixed(2)}</span>
        </div>
      )}
      <div className="flex justify-between items-baseline gap-2 pt-1 border-t border-slate-800">
        <span className="text-slate-400 font-bold text-sm">Líquido</span>
        <span className="font-mono font-black text-amber-300 text-lg">R$ {dados.liquido.toFixed(2)}</span>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
  sub,
}: {
  label: string;
  value: string;
  accent: string;
  sub?: string;
}) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
      <p className="text-[11px] font-bold uppercase text-slate-500 tracking-wide">{label}</p>
      {sub && <p className="text-[10px] text-slate-600 capitalize mt-0.5">{sub}</p>}
      <p className={`text-2xl font-black mt-1 ${accent}`}>{value}</p>
    </div>
  );
}
