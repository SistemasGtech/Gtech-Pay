import { prioridadeMontagemGrupoNome } from './catalog';
import type { Categoria, Complemento, FormaPagamento, Produto, Venda } from './types';

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

function chaveSaborComplemento(nome: string): string {
  return nome.trim().toLowerCase();
}

function quantidadeComplementosPorSabor(vendas: Venda[]): Map<string, { nome: string; quantidade: number }> {
  const map = new Map<string, { nome: string; quantidade: number }>();

  for (const venda of vendas) {
    for (const it of venda.itens || []) {
      const qtdItem = it.quantidade || 1;
      for (const op of it.opcoes || []) {
        const label = (op.nome || '').trim();
        if (!label) continue;
        const chave = chaveSaborComplemento(label);
        const prev = map.get(chave);
        if (prev) {
          prev.quantidade += qtdItem;
        } else {
          map.set(chave, { nome: label, quantidade: qtdItem });
        }
      }
    }
  }

  return map;
}

export interface ComplementoSaborMesAno {
  chave: string;
  nome: string;
  quantidadeMes: number;
  quantidadeAno: number;
}

/** Mesmo sabor (nome) em uma linha, com totais do mês e do ano de referência */
export function relatorioComplementosSaboresMesAno(vendas: Venda[], dataRef = new Date()): ComplementoSaborMesAno[] {
  const mesMap = quantidadeComplementosPorSabor(vendasDoMes(vendas, dataRef));
  const anoMap = quantidadeComplementosPorSabor(vendasDoAno(vendas, dataRef));
  const chaves = new Set([...mesMap.keys(), ...anoMap.keys()]);

  const rows: ComplementoSaborMesAno[] = [];
  for (const chave of chaves) {
    const mes = mesMap.get(chave);
    const ano = anoMap.get(chave);
    rows.push({
      chave,
      nome: mes?.nome ?? ano?.nome ?? chave,
      quantidadeMes: mes?.quantidade ?? 0,
      quantidadeAno: ano?.quantidade ?? 0,
    });
  }

  return rows
    .filter((r) => r.quantidadeMes > 0 || r.quantidadeAno > 0)
    .sort(
      (a, b) =>
        b.quantidadeMes - a.quantidadeMes ||
        b.quantidadeAno - a.quantidadeAno ||
        a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }),
    );
}

export interface OpcaoComplementoVendida {
  opcaoId: string;
  nome: string;
  quantidade: number;
}

export interface GrupoComplementoVendido {
  grupoId: string;
  grupoNome: string;
  opcoes: OpcaoComplementoVendida[];
  totalQtd: number;
}

export interface ItemComComplementosVendidos extends ItemVendidoResumo {
  gruposComplemento: GrupoComplementoVendido[];
  totalComplementosQtd: number;
}

type OpcaoCatalogoRef = { grupoId: string; grupoNome: string; opcaoId: string; nome: string };

function indiceOpcoesComplemento(complementos: Complemento[]): {
  porId: Map<string, OpcaoCatalogoRef>;
  porNome: Map<string, OpcaoCatalogoRef>;
} {
  const porId = new Map<string, OpcaoCatalogoRef>();
  const porNome = new Map<string, OpcaoCatalogoRef>();
  for (const g of complementos) {
    for (const o of g.opcoes) {
      const ref: OpcaoCatalogoRef = { grupoId: g.id, grupoNome: g.nome, opcaoId: o.id, nome: o.nome };
      porId.set(String(o.id), ref);
      porNome.set(chaveSaborComplemento(o.nome), ref);
    }
  }
  return { porId, porNome };
}

function resolverOpcaoVendida(
  op: { id?: string; nome?: string },
  indice: ReturnType<typeof indiceOpcoesComplemento>,
): OpcaoCatalogoRef | null {
  const id = op.id ? String(op.id) : '';
  if (id && indice.porId.has(id)) return indice.porId.get(id)!;
  const nome = (op.nome || '').trim();
  if (!nome) return null;
  const porNome = indice.porNome.get(chaveSaborComplemento(nome));
  if (porNome) return porNome;
  return {
    grupoId: '__avulso__',
    grupoNome: 'Outras opções',
    opcaoId: id || chaveSaborComplemento(nome),
    nome,
  };
}

function ordenarGrupoIdsMontagem(
  grupos: Map<string, Map<string, OpcaoComplementoVendida>>,
  complementos: Complemento[],
  grupoIdsOrdem?: string[],
): string[] {
  const idsVendidos = new Set(grupos.keys());
  const ordenados: string[] = [];

  if (grupoIdsOrdem?.length) {
    for (const id of grupoIdsOrdem.map(String)) {
      if (idsVendidos.has(id)) ordenados.push(id);
    }
  }

  const restantes = [...idsVendidos].filter((id) => !ordenados.includes(id));
  restantes.sort((a, b) => {
    if (a === '__avulso__') return 1;
    if (b === '__avulso__') return -1;
    const nomeA = complementos.find((g) => g.id === a)?.nome ?? '';
    const nomeB = complementos.find((g) => g.id === b)?.nome ?? '';
    const pa = prioridadeMontagemGrupoNome(nomeA);
    const pb = prioridadeMontagemGrupoNome(nomeB);
    if (pa !== pb) return pa - pb;
    const ia = complementos.findIndex((g) => g.id === a);
    const ib = complementos.findIndex((g) => g.id === b);
    if (ia >= 0 && ib >= 0) return ia - ib;
    return a.localeCompare(b);
  });

  return [...ordenados, ...restantes];
}

function montarGruposComplemento(
  grupos: Map<string, Map<string, OpcaoComplementoVendida>>,
  complementos: Complemento[],
  grupoIdsOrdem?: string[],
): GrupoComplementoVendido[] {
  const grupoNomeCatalogo = new Map(complementos.map((g) => [g.id, g.nome]));
  const ordemOpcaoNoGrupo = new Map<string, Map<string, number>>();
  for (const g of complementos) {
    const m = new Map<string, number>();
    g.opcoes.forEach((o, i) => m.set(o.id, i));
    ordemOpcaoNoGrupo.set(g.id, m);
  }

  const grupoIds = ordenarGrupoIdsMontagem(grupos, complementos, grupoIdsOrdem);

  const gruposComplemento: GrupoComplementoVendido[] = [];
  for (const grupoId of grupoIds) {
    const opMap = grupos.get(grupoId)!;
    const ordem = ordemOpcaoNoGrupo.get(grupoId);
    const opcoes = [...opMap.values()].sort((a, b) => {
      if (b.quantidade !== a.quantidade) return b.quantidade - a.quantidade;
      const oa = ordem?.get(a.opcaoId) ?? 999;
      const ob = ordem?.get(b.opcaoId) ?? 999;
      return oa - ob || a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' });
    });
    const totalQtd = opcoes.reduce((s, o) => s + o.quantidade, 0);
    gruposComplemento.push({
      grupoId,
      grupoNome: grupoNomeCatalogo.get(grupoId) ?? (grupoId === '__avulso__' ? 'Outras opções' : 'Complemento'),
      opcoes,
      totalQtd,
    });
  }
  return gruposComplemento;
}

/** Cada item vendido com os complementos escolhidos e quantidades (período das vendas). */
export function relatorioItensComComplementos(
  vendas: Venda[],
  complementos: Complemento[],
  produtos: Produto[] = [],
): ItemComComplementosVendidos[] {
  const indiceOpc = indiceOpcoesComplemento(complementos);
  const produtoPorId = new Map(produtos.map((p) => [String(p.id), p]));

  type AccItem = ItemVendidoResumo & {
    grupos: Map<string, Map<string, OpcaoComplementoVendida>>;
  };

  const acc = new Map<string, AccItem>();

  for (const venda of vendas) {
    for (const it of venda.itens || []) {
      const chaveItem = String(it.produtoId || it.nome);
      const qtd = it.quantidade || 1;
      const fat = it.subtotal ?? (Number(it.precoUnitario) || 0) * qtd;
      let row = acc.get(chaveItem);
      if (!row) {
        row = {
          chave: chaveItem,
          nome: it.nome,
          quantidade: 0,
          faturamento: 0,
          grupos: new Map(),
        };
        acc.set(chaveItem, row);
      }
      row.quantidade += qtd;
      row.faturamento += fat;

      for (const op of it.opcoes || []) {
        const ref = resolverOpcaoVendida(op, indiceOpc);
        if (!ref) continue;
        let grupoMap = row.grupos.get(ref.grupoId);
        if (!grupoMap) {
          grupoMap = new Map();
          row.grupos.set(ref.grupoId, grupoMap);
        }
        const prevOp = grupoMap.get(ref.opcaoId);
        if (prevOp) {
          prevOp.quantidade += qtd;
        } else {
          grupoMap.set(ref.opcaoId, {
            opcaoId: ref.opcaoId,
            nome: ref.nome,
            quantidade: qtd,
          });
        }
      }
    }
  }

  return [...acc.values()]
    .map((row) => {
      const produto = produtoPorId.get(row.chave);
      const ordemMontagem = produto?.complementoIds?.map(String);
      const gruposComplemento = montarGruposComplemento(row.grupos, complementos, ordemMontagem);
      const totalComplementosQtd = gruposComplemento.reduce((s, g) => s + g.totalQtd, 0);
      const { grupos: _g, ...item } = row;
      return { ...item, gruposComplemento, totalComplementosQtd };
    })
    .sort((a, b) => b.quantidade - a.quantidade || b.faturamento - a.faturamento);
}

const SEM_CATEGORIA_ID = '__sem_categoria__';

export interface RelatorioCategoriaItensComplementos {
  categoriaId: string;
  categoriaNome: string;
  cor: string;
  itens: ItemComComplementosVendidos[];
  totalItensQtd: number;
  totalFaturamento: number;
}

function ordenarItensNaCategoria(
  itens: ItemComComplementosVendidos[],
  produtos: Produto[],
  categoriaId: string,
): ItemComComplementosVendidos[] {
  const ordemProduto = new Map<string, number>();
  produtos.forEach((p, index) => {
    if (p.categoriaId === categoriaId) ordemProduto.set(String(p.id), index);
  });
  return [...itens].sort((a, b) => {
    const oa = ordemProduto.get(a.chave) ?? 9999;
    const ob = ordemProduto.get(b.chave) ?? 9999;
    if (oa !== ob) return oa - ob;
    return b.quantidade - a.quantidade || b.faturamento - a.faturamento;
  });
}

/** Itens com complementos, agrupados na ordem das categorias do catálogo. */
export function relatorioItensComComplementosPorCategoria(
  vendas: Venda[],
  complementos: Complemento[],
  produtos: Produto[],
  categorias: Categoria[],
): RelatorioCategoriaItensComplementos[] {
  const itens = relatorioItensComComplementos(vendas, complementos, produtos);
  const produtoPorId = new Map(produtos.map((p) => [String(p.id), p]));
  const porCategoria = new Map<string, ItemComComplementosVendidos[]>();

  for (const item of itens) {
    const categoriaId = produtoPorId.get(item.chave)?.categoriaId ?? SEM_CATEGORIA_ID;
    const list = porCategoria.get(categoriaId) ?? [];
    list.push(item);
    porCategoria.set(categoriaId, list);
  }

  const idsOrdenados = [
    ...categorias.map((c) => c.id).filter((id) => porCategoria.has(id)),
    ...(porCategoria.has(SEM_CATEGORIA_ID) ? [SEM_CATEGORIA_ID] : []),
  ];

  const meta = new Map(categorias.map((c) => [c.id, c]));
  const resultado: RelatorioCategoriaItensComplementos[] = [];

  for (const categoriaId of idsOrdenados) {
    const itensCat = ordenarItensNaCategoria(porCategoria.get(categoriaId)!, produtos, categoriaId);
    const cat = meta.get(categoriaId);
    resultado.push({
      categoriaId,
      categoriaNome:
        categoriaId === SEM_CATEGORIA_ID ? 'Sem categoria' : cat?.nome?.trim() || 'Categoria',
      cor: cat?.cor || '#6366f1',
      itens: itensCat,
      totalItensQtd: itensCat.reduce((s, i) => s + i.quantidade, 0),
      totalFaturamento: itensCat.reduce((s, i) => s + i.faturamento, 0),
    });
  }

  return resultado;
}

const ORDEM_PAGAMENTO: FormaPagamento[] = ['PIX', 'Cartão Crédito', 'Cartão Débito', 'Dinheiro'];

export interface TipoPagamentoResumo {
  pagamento: string;
  quantidade: number;
  faturamento: number;
}

/** Agrupa vendas do período por forma de pagamento (PIX, cartões, dinheiro). */
export function relatorioTiposPagamento(vendas: Venda[]): TipoPagamentoResumo[] {
  const map = new Map<string, TipoPagamentoResumo>();

  for (const venda of vendas) {
    const nome = (venda.pagamento || 'Outro').trim() || 'Outro';
    const fat = venda.total || 0;
    const prev = map.get(nome);
    if (prev) {
      prev.quantidade += 1;
      prev.faturamento += fat;
    } else {
      map.set(nome, { pagamento: nome, quantidade: 1, faturamento: fat });
    }
  }

  return [...map.values()].sort((a, b) => {
    const ia = ORDEM_PAGAMENTO.indexOf(a.pagamento as FormaPagamento);
    const ib = ORDEM_PAGAMENTO.indexOf(b.pagamento as FormaPagamento);
    if (ia !== -1 || ib !== -1) {
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    }
    return b.faturamento - a.faturamento || a.pagamento.localeCompare(b.pagamento, 'pt-BR');
  });
}
