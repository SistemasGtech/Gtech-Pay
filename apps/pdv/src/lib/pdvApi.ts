import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  Categoria,
  Complemento,
  LojaInfo,
  Operador,
  Produto,
  SenhaConfig,
  Venda,
} from '@gtech/shared';
import { applyDailyReset } from '@gtech/shared';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const PDV_STORE_ID_KEY = 'gtech_pdv_store_id';

export const isPdvCloudEnabled = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = isPdvCloudEnabled
  ? createClient(url!, anonKey!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    })
  : null;

const UUID_IN_TEXT =
  /[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;

const UUID_STRICT =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function asUuidOrNull(raw: string | null | undefined): string | null {
  const id = String(raw ?? '').trim();
  return UUID_STRICT.test(id) ? id.toLowerCase() : null;
}

/** Renova JWT antes de gravar vendas (evita erro com “Online” e sessão expirada). */
export async function ensurePdvAuthSession(): Promise<void> {
  if (!supabase) return;
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    throw new Error('Faça login no PDV com e-mail e senha do dashboard');
  }
  const expMs = (data.session.expires_at ?? 0) * 1000;
  if (expMs < Date.now() + 120_000) {
    const { error } = await supabase.auth.refreshSession();
    if (error) throw error;
  }
}

/** Extrai e normaliza UUID (aceita colar com espaços ou texto extra). */
export function normalizeStoreId(raw: string): string | null {
  const trimmed = raw.trim().replace(/^\{|\}$/g, '');
  const match = trimmed.match(UUID_IN_TEXT);
  return match ? match[0].toLowerCase() : null;
}

export function getConfiguredStoreId(): string | null {
  const fromLs = localStorage.getItem(PDV_STORE_ID_KEY);
  const fromEnv = import.meta.env.VITE_STORE_ID as string | undefined;
  return normalizeStoreId(fromLs ?? '') ?? normalizeStoreId(fromEnv ?? '') ?? null;
}

export function saveConfiguredStoreId(storeId: string): void {
  const id = normalizeStoreId(storeId);
  if (!id) throw new Error('ID da loja inválido. Copie o UUID completo do dashboard (menu Loja).');
  localStorage.setItem(PDV_STORE_ID_KEY, id);
}

export function formatPdvError(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e) {
    const msg = String((e as { message: string }).message);
    if (msg.includes('Loja não encontrada')) return 'Loja não encontrada. Confira o ID copiado no dashboard.';
    if (msg.includes('invalid input syntax for type uuid')) {
      return 'ID da loja inválido. Copie o UUID completo (com hífens) no dashboard → Loja.';
    }
    return msg;
  }
  if (e instanceof Error) return e.message;
  return 'Falha ao conectar com a nuvem';
}

export interface PdvBootstrap {
  loja: LojaInfo;
  operadores: Operador[];
  senhaConfig: SenhaConfig;
  categorias: Categoria[];
  complementos: Complemento[];
  produtos: Produto[];
  vendas: Venda[];
}

function mapSenhaConfig(raw: Record<string, unknown> | null | undefined): SenhaConfig {
  const base: SenhaConfig = {
    proximaSenha: Number(raw?.proximaSenha ?? 1),
    minimo: Number(raw?.minimo ?? 1),
    maximo: Number(raw?.maximo ?? 99),
    incrementoAutomatico: Boolean(raw?.incrementoAutomatico ?? true),
    reiniciarACadaDia: Boolean(raw?.reiniciarACadaDia ?? true),
    controleAtivo: raw?.controleAtivo !== false,
    ultimaDataOperacao: String(raw?.ultimaDataOperacao ?? new Date().toISOString().slice(0, 10)),
  };
  return applyDailyReset(base);
}

function mapOperadores(raw: unknown): Operador[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((o) => {
    const row = o as Record<string, unknown>;
    return {
      id: String(row.id),
      nome: String(row.nome ?? ''),
      cargo: String(row.cargo ?? ''),
      pin: String(row.pin ?? ''),
      cor: String(row.cor ?? '#6366f1'),
      iniciais: String(row.iniciais ?? '??'),
      ativo: true,
    };
  });
}

function mapVendas(raw: unknown): Venda[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((v) => {
    const row = v as Record<string, unknown>;
    const itensRaw = row.itens;
    const itens = Array.isArray(itensRaw)
      ? itensRaw.map((item) => {
          const i = item as Record<string, unknown>;
          return {
            carrinhoItemId: String(i.carrinhoItemId ?? crypto.randomUUID()),
            produtoId: i.produtoId != null ? String(i.produtoId) : '',
            nome: String(i.nome ?? ''),
            precoBase: Number(i.precoBase ?? 0),
            precoUnitario: Number(i.precoUnitario ?? 0),
            quantidade: Number(i.quantidade ?? 1),
            subtotal: Number(i.subtotal ?? 0),
            observacao: String(i.observacao ?? ''),
            opcoes: Array.isArray(i.opcoes) ? i.opcoes : [],
          };
        })
      : [];
    return {
      id: String(row.id),
      timestamp: Number(row.timestamp ?? Date.now()),
      senha: String(row.senha ?? ''),
      comanda: String(row.comanda ?? row.senha ?? ''),
      cliente: String(row.cliente ?? 'Cliente Balcão'),
      data: String(row.data ?? ''),
      hora: String(row.hora ?? ''),
      pagamento: row.pagamento as Venda['pagamento'],
      valorRecebido: Number(row.valorRecebido ?? row.total ?? 0),
      troco: Number(row.troco ?? 0),
      itens,
      total: Number(row.total ?? 0),
      operadorId: row.operadorId != null ? String(row.operadorId) : '',
      operadorNome: String(row.operadorNome ?? ''),
    };
  });
}

export async function fetchPdvVendas(storeId: string, limit = 100): Promise<Venda[]> {
  if (!supabase) throw new Error('Supabase não configurado no PDV');
  const { data, error } = await supabase.rpc('pdv_list_sales', { p_store_id: storeId, p_limit: limit });
  if (error) throw error;
  return mapVendas(data);
}

export async function fetchPdvBootstrap(storeId: string): Promise<PdvBootstrap> {
  if (!supabase) throw new Error('Supabase não configurado no PDV');

  const [configRes, catalogRes, vendasRes] = await Promise.all([
    supabase.rpc('pdv_get_config', { p_store_id: storeId }),
    supabase.rpc('pdv_get_catalog', { p_store_id: storeId }),
    supabase.rpc('pdv_list_sales', { p_store_id: storeId, p_limit: 100 }),
  ]);

  if (configRes.error) throw configRes.error;
  if (catalogRes.error) throw catalogRes.error;
  if (vendasRes.error) throw vendasRes.error;

  const cfg = configRes.data as {
    loja?: LojaInfo;
    operadores?: unknown;
    senhaConfig?: Record<string, unknown>;
  };
  const cat = catalogRes.data as {
    categorias?: Categoria[];
    complementos?: Complemento[];
    produtos?: Produto[];
  };

  const loja = cfg.loja ?? { nome: 'Loja', endereco: '', telefone: '', cnpj: '' };
  const operadores = mapOperadores(cfg.operadores).map(({ pin: _pin, ...op }) => ({
    ...op,
    pin: '',
  }));

  return {
    loja,
    operadores,
    senhaConfig: mapSenhaConfig(cfg.senhaConfig),
    categorias: cat.categorias ?? [],
    complementos: cat.complementos ?? [],
    produtos: (cat.produtos ?? []).map((p) => {
      const rawIds = p.complementoIds;
      const complementoIds = Array.isArray(rawIds) ? rawIds.map(String) : [];
      return {
        ...p,
        id: String(p.id),
        categoriaId: String(p.categoriaId),
        preco: Number(p.preco),
        complementoIds,
      };
    }),
    vendas: mapVendas(vendasRes.data),
  };
}

export async function verifyOperadorPin(
  storeId: string,
  operadorId: string,
  pin: string,
): Promise<Operador> {
  if (!supabase) throw new Error('Supabase não configurado');
  const { data, error } = await supabase.rpc('pdv_verify_pin', {
    p_store_id: storeId,
    p_operador_id: operadorId,
    p_pin: pin,
  });
  if (error) throw error;
  const row = data as Record<string, unknown>;
  return {
    id: String(row.id),
    nome: String(row.nome),
    cargo: String(row.cargo ?? ''),
    pin: String(row.pin),
    cor: String(row.cor ?? '#6366f1'),
    iniciais: String(row.iniciais ?? '??'),
  };
}

export async function registerSaleRemote(storeId: string, venda: Venda): Promise<string> {
  if (!supabase) throw new Error('Supabase não configurado');
  await ensurePdvAuthSession();
  const { data, error } = await supabase.rpc('pdv_register_sale', {
    p_store_id: storeId,
    p_venda: salePayload(venda),
  });
  if (error) throw error;
  return String(data);
}

function salePayload(venda: Venda) {
  const vendaId = asUuidOrNull(venda.id) ?? crypto.randomUUID();
  return {
    id: vendaId,
    senha: venda.senha,
    comanda: venda.comanda,
    cliente: venda.cliente,
    data: venda.data,
    hora: venda.hora,
    pagamento: venda.pagamento,
    total: venda.total,
    troco: venda.troco,
    valorRecebido: venda.valorRecebido,
    operadorId: asUuidOrNull(venda.operadorId) ?? '',
    operadorNome: venda.operadorNome,
    timestamp: venda.timestamp,
    itens: venda.itens.map((i) => ({
      carrinhoItemId: asUuidOrNull(i.carrinhoItemId) ?? crypto.randomUUID(),
      produtoId: asUuidOrNull(i.produtoId),
      nome: i.nome,
      precoBase: i.precoBase,
      precoUnitario: i.precoUnitario,
      quantidade: i.quantidade,
      subtotal: i.subtotal,
      observacao: i.observacao ?? '',
      opcoes: Array.isArray(i.opcoes)
        ? i.opcoes.map((o) => ({
            id: String(o.id ?? ''),
            nome: String(o.nome ?? ''),
            preco: Number(o.preco ?? 0),
          }))
        : [],
    })),
  };
}

export async function updateSaleRemote(storeId: string, venda: Venda): Promise<string> {
  if (!supabase) throw new Error('Supabase não configurado');
  const { data, error } = await supabase.rpc('pdv_update_sale', {
    p_store_id: storeId,
    p_venda: salePayload(venda),
  });
  if (error) throw error;
  return String(data);
}

export async function deleteSaleRemote(storeId: string, vendaId: string): Promise<void> {
  if (!supabase) throw new Error('Supabase não configurado');
  const { error } = await supabase.rpc('pdv_delete_sale', {
    p_store_id: storeId,
    p_venda_id: vendaId,
  });
  if (error) throw error;
}

export async function syncSenhaConfigRemote(storeId: string, config: SenhaConfig): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.rpc('pdv_update_senha_config', {
    p_store_id: storeId,
    p_config: {
      proximaSenha: config.proximaSenha,
      minimo: config.minimo,
      maximo: config.maximo,
      incrementoAutomatico: config.incrementoAutomatico,
      reiniciarACadaDia: config.reiniciarACadaDia,
      ultimaDataOperacao: config.ultimaDataOperacao,
      controleAtivo: config.controleAtivo !== false,
    },
  });
  if (error) throw error;
}
