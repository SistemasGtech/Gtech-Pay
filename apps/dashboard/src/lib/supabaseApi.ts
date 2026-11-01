import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  Categoria,
  Complemento,
  FormaPagamento,
  LojaInfo,
  Operador,
  Produto,
  Venda,
} from '@gtech/shared';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseEnabled = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = isSupabaseEnabled
  ? createClient(url!, anonKey!, { auth: { persistSession: true, autoRefreshToken: true } })
  : null;

export async function getCurrentStoreId(): Promise<string | null> {
  if (!supabase) return null;
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return null;
  const { data, error } = await supabase.from('profiles').select('store_id').eq('id', uid).maybeSingle();
  if (error) throw error;
  return data?.store_id ?? null;
}

export interface DashboardData {
  storeId: string;
  loja: LojaInfo;
  operadores: Operador[];
  categorias: Categoria[];
  complementos: Complemento[];
  produtos: Produto[];
  vendas: Venda[];
}

export async function fetchDashboardData(): Promise<DashboardData> {
  if (!supabase) throw new Error('Supabase não configurado');
  const storeId = await getCurrentStoreId();
  if (!storeId) throw new Error('Loja não vinculada ao usuário. Faça cadastro novamente.');

  const [storeRes, opRes, catRes, compRes, opcoesRes, prodRes, linksRes, vendasRes, itensRes] = await Promise.all([
    supabase.from('stores').select('*').eq('id', storeId).single(),
    supabase.from('operadores').select('*').eq('store_id', storeId),
    supabase.from('categorias').select('*').eq('store_id', storeId),
    supabase.from('complementos').select('*').eq('store_id', storeId),
    supabase.from('complemento_opcoes').select('*'),
    supabase.from('produtos').select('*').eq('store_id', storeId),
    supabase.from('produto_complementos').select('*'),
    supabase.from('vendas').select('*').eq('store_id', storeId).order('vendido_em', { ascending: false }),
    supabase.from('venda_itens').select('*'),
  ]);

  if (storeRes.error) throw storeRes.error;
  if (opRes.error) throw opRes.error;
  if (catRes.error) throw catRes.error;
  if (compRes.error) throw compRes.error;
  if (opcoesRes.error) throw opcoesRes.error;
  if (prodRes.error) throw prodRes.error;
  if (linksRes.error) throw linksRes.error;
  if (vendasRes.error) throw vendasRes.error;
  if (itensRes.error) throw itensRes.error;

  const compIds = new Set((compRes.data ?? []).map((c) => c.id));
  const complementos: Complemento[] = (compRes.data ?? []).map((c) => ({
    id: c.id,
    nome: c.nome,
    opcoes: (opcoesRes.data ?? [])
      .filter((o) => o.complemento_id === c.id)
      .map((o) => ({ id: o.id, nome: o.nome, preco: Number(o.preco) })),
  }));

  const linksByProd = new Map<string, string[]>();
  for (const link of linksRes.data ?? []) {
    const list = linksByProd.get(link.produto_id) ?? [];
    list.push(link.complemento_id);
    linksByProd.set(link.produto_id, list);
  }

  const produtos: Produto[] = (prodRes.data ?? []).map((p) => ({
    id: p.id,
    nome: p.nome,
    categoriaId: p.categoria_id ?? '',
    preco: Number(p.preco),
    ativo: p.ativo,
    complementoIds: (linksByProd.get(p.id) ?? []).filter((id) => compIds.has(id)),
  }));

  const itensByVenda = new Map<string, Venda['itens']>();
  for (const it of itensRes.data ?? []) {
    const list = itensByVenda.get(it.venda_id) ?? [];
    list.push({
      carrinhoItemId: it.id,
      produtoId: it.produto_id ?? '',
      nome: it.nome,
      precoBase: Number(it.preco_base ?? 0),
      precoUnitario: Number(it.preco_unitario),
      quantidade: it.quantidade,
      subtotal: Number(it.subtotal),
      opcoes: (it.opcoes as Venda['itens'][0]['opcoes']) ?? [],
      observacao: it.observacao ?? '',
    });
    itensByVenda.set(it.venda_id, list);
  }

  const vendas: Venda[] = (vendasRes.data ?? []).map((v) => ({
    id: v.id,
    timestamp: Number(v.vendido_em),
    senha: v.senha,
    comanda: v.comanda ?? v.senha,
    cliente: v.cliente,
    data: v.data_venda,
    hora: v.hora,
    pagamento: v.pagamento as FormaPagamento,
    valorRecebido: Number(v.valor_recebido),
    troco: Number(v.troco),
    total: Number(v.total),
    operadorId: v.operador_id ?? undefined,
    operadorNome: v.operador_nome ?? undefined,
    itens: itensByVenda.get(v.id) ?? [],
  }));

  const s = storeRes.data;
  return {
    storeId,
    loja: { nome: s.nome, endereco: s.endereco, telefone: s.telefone, cnpj: s.cnpj },
    operadores: (opRes.data ?? []).map(mapOperador),
    categorias: (catRes.data ?? []).map((c) => ({ id: c.id, nome: c.nome, cor: c.cor })),
    complementos,
    produtos,
    vendas,
  };
}

function mapOperador(row: Record<string, unknown>): Operador {
  return {
    id: String(row.id),
    nome: String(row.nome),
    cargo: String(row.cargo ?? ''),
    pin: String(row.pin),
    email: row.email ? String(row.email) : undefined,
    cor: String(row.cor ?? '#6366f1'),
    iniciais: String(row.iniciais ?? 'OP'),
    ativo: Boolean(row.ativo),
  };
}

export async function saveLojaRemote(storeId: string, loja: LojaInfo): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from('stores')
    .update({
      nome: loja.nome,
      endereco: loja.endereco,
      telefone: loja.telefone,
      cnpj: loja.cnpj,
      updated_at: new Date().toISOString(),
    })
    .eq('id', storeId);
  if (error) throw error;
}

export async function saveOperadoresRemote(storeId: string, list: Operador[]): Promise<void> {
  if (!supabase) return;
  const { data: existing } = await supabase.from('operadores').select('id').eq('store_id', storeId);
  const keep = new Set(list.map((o) => o.id));
  const toDelete = (existing ?? []).filter((e) => !keep.has(e.id)).map((e) => e.id);
  if (toDelete.length) await supabase.from('operadores').delete().in('id', toDelete);
  if (list.length) {
    const rows = list.map((o) => ({
      id: o.id,
      store_id: storeId,
      nome: o.nome,
      cargo: o.cargo,
      pin: o.pin,
      email: o.email ?? null,
      cor: o.cor,
      iniciais: o.iniciais,
      ativo: o.ativo !== false,
    }));
    const { error } = await supabase.from('operadores').upsert(rows);
    if (error) throw error;
  }
}

export async function saveCategoriasRemote(storeId: string, list: Categoria[]): Promise<void> {
  if (!supabase) return;
  await syncSimpleTable(storeId, 'categorias', list, (c) => ({
    id: c.id,
    store_id: storeId,
    nome: c.nome,
    cor: c.cor,
  }));
}

async function syncSimpleTable<T extends { id: string }>(
  storeId: string,
  table: 'categorias',
  list: T[],
  mapRow: (item: T) => Record<string, unknown>
): Promise<void> {
  const { data: existing } = await supabase!.from(table).select('id').eq('store_id', storeId);
  const keep = new Set(list.map((i) => i.id));
  const toDelete = (existing ?? []).filter((e) => !keep.has(e.id)).map((e) => e.id);
  if (toDelete.length) await supabase!.from(table).delete().in('id', toDelete);
  if (list.length) {
    const { error } = await supabase!.from(table).upsert(list.map(mapRow));
    if (error) throw error;
  }
}

export async function saveComplementosRemote(storeId: string, list: Complemento[]): Promise<void> {
  if (!supabase) return;
  const { data: existingComps } = await supabase.from('complementos').select('id').eq('store_id', storeId);
  const keep = new Set(list.map((c) => c.id));
  const deleteIds = (existingComps ?? []).filter((c) => !keep.has(c.id)).map((c) => c.id);
  if (deleteIds.length) {
    await supabase.from('complemento_opcoes').delete().in('complemento_id', deleteIds);
    await supabase.from('complementos').delete().in('id', deleteIds);
  }
  for (const g of list) {
    const { error: gErr } = await supabase.from('complementos').upsert({
      id: g.id,
      store_id: storeId,
      nome: g.nome,
    });
    if (gErr) throw gErr;
    await supabase.from('complemento_opcoes').delete().eq('complemento_id', g.id);
    if (g.opcoes.length) {
      const { error: oErr } = await supabase.from('complemento_opcoes').insert(
        g.opcoes.map((o) => ({
          id: o.id,
          complemento_id: g.id,
          nome: o.nome,
          preco: o.preco,
        }))
      );
      if (oErr) throw oErr;
    }
  }
}

export async function saveProdutosRemote(storeId: string, list: Produto[]): Promise<void> {
  if (!supabase) return;
  const { data: existing } = await supabase.from('produtos').select('id').eq('store_id', storeId);
  const keep = new Set(list.map((p) => p.id));
  const toDelete = (existing ?? []).filter((p) => !keep.has(p.id)).map((p) => p.id);
  if (toDelete.length) {
    await supabase.from('produto_complementos').delete().in('produto_id', toDelete);
    await supabase.from('produtos').delete().in('id', toDelete);
  }
  for (const p of list) {
    const { error } = await supabase.from('produtos').upsert({
      id: p.id,
      store_id: storeId,
      categoria_id: p.categoriaId || null,
      nome: p.nome,
      preco: p.preco,
      ativo: p.ativo,
    });
    if (error) throw error;
    await supabase.from('produto_complementos').delete().eq('produto_id', p.id);
    if (p.complementoIds?.length) {
      await supabase.from('produto_complementos').insert(
        p.complementoIds.map((cid) => ({ produto_id: p.id, complemento_id: cid }))
      );
    }
  }
}

export async function deleteVendaRemote(vendaId: string): Promise<void> {
  if (!supabase) return;
  await supabase.from('venda_itens').delete().eq('venda_id', vendaId);
  const { error } = await supabase.from('vendas').delete().eq('id', vendaId);
  if (error) throw error;
}
