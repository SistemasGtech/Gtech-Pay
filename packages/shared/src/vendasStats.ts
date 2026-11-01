import type { Venda } from './types';

/** Data da venda a partir de timestamp ou string dd/mm/aaaa */
export function vendaDate(v: Venda): Date {
  if (v.timestamp) return new Date(v.timestamp);
  const parts = v.data?.split('/');
  if (parts?.length === 3) {
    const day = Number(parts[0]);
    const month = Number(parts[1]);
    const year = Number(parts[2]);
    if (year && month && day) return new Date(year, month - 1, day);
  }
  return new Date(NaN);
}

function isSameCalendarDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function vendasDoDia(vendas: Venda[], dataRef = new Date()): Venda[] {
  return vendas.filter((v) => {
    const d = vendaDate(v);
    return !Number.isNaN(d.getTime()) && isSameCalendarDay(d, dataRef);
  });
}

export function vendasDoMes(vendas: Venda[], dataRef = new Date()): Venda[] {
  const y = dataRef.getFullYear();
  const m = dataRef.getMonth();
  return vendas.filter((v) => {
    const d = vendaDate(v);
    return !Number.isNaN(d.getTime()) && d.getFullYear() === y && d.getMonth() === m;
  });
}

export function vendasDoAno(vendas: Venda[], dataRef = new Date()): Venda[] {
  const y = dataRef.getFullYear();
  return vendas.filter((v) => {
    const d = vendaDate(v);
    return !Number.isNaN(d.getTime()) && d.getFullYear() === y;
  });
}

export function totalFaturamento(vendas: Venda[]): number {
  return vendas.reduce((s, v) => s + (v.total || 0), 0);
}

/** Soma quantidades de todos os itens das vendas */
export function totalItensVendidos(vendas: Venda[]): number {
  return vendas.reduce((s, v) => {
    const qtd = (v.itens || []).reduce((si, it) => si + (it.quantidade || 1), 0);
    return s + qtd;
  }, 0);
}

export interface ResumoVendasPeriodo {
  ref: Date;
  labelMes: string;
  faturamentoDiario: number;
  faturamentoMensal: number;
  faturamentoAnual: number;
  itensVendidosMes: number;
  vendasHoje: number;
  vendasMes: number;
}

export function resumoVendas(vendas: Venda[], dataRef = new Date()): ResumoVendasPeriodo {
  const hoje = vendasDoDia(vendas, dataRef);
  const mes = vendasDoMes(vendas, dataRef);
  const ano = vendasDoAno(vendas, dataRef);

  return {
    ref: dataRef,
    labelMes: dataRef.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
    faturamentoDiario: totalFaturamento(hoje),
    faturamentoMensal: totalFaturamento(mes),
    faturamentoAnual: totalFaturamento(ano),
    itensVendidosMes: totalItensVendidos(mes),
    vendasHoje: hoje.length,
    vendasMes: mes.length,
  };
}

/** @deprecated use totalFaturamento */
export function totalVendas(vendas: Venda[]): number {
  return totalFaturamento(vendas);
}

export interface ItemVendidoResumo {
  chave: string;
  nome: string;
  quantidade: number;
  faturamento: number;
}

/** Agrupa itens das vendas por produto (nome/id) */
export function relatorioItensVendidos(vendas: Venda[]): ItemVendidoResumo[] {
  const map = new Map<string, ItemVendidoResumo>();

  for (const venda of vendas) {
    for (const it of venda.itens || []) {
      const chave = String(it.produtoId || it.nome);
      const qtd = it.quantidade || 1;
      const fat = it.subtotal ?? (Number(it.precoUnitario) || 0) * qtd;
      const prev = map.get(chave);
      if (prev) {
        prev.quantidade += qtd;
        prev.faturamento += fat;
      } else {
        map.set(chave, {
          chave,
          nome: it.nome,
          quantidade: qtd,
          faturamento: fat,
        });
      }
    }
  }

  return [...map.values()].sort((a, b) => b.quantidade - a.quantidade || b.faturamento - a.faturamento);
}
