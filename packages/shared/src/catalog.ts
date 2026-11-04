import type {
  Categoria,
  Complemento,
  LojaInfo,
  Operador,
  Produto,
  Venda,
} from './types';

export const STORAGE_KEYS = {
  loja: 'gtech_loja',
  vendas: 'gtech_vendas',
  operadores: 'gtech_operadores',
  categorias: 'gtech_categorias',
  produtos: 'gtech_produtos',
  complementos: 'gtech_complementos',
} as const;

export const LOJA_PADRAO: LojaInfo = {
  nome: 'DOCERIA & CHURROS',
  endereco: 'Av. Brasil, 1500',
  telefone: '(11) 98765-4321',
  cnpj: '12.345.678/0001-90',
};

export const OPERADORES_PADRAO: Operador[] = [
  {
    id: '1',
    nome: 'João Silva',
    cargo: 'Gerente',
    pin: '1234',
    email: 'gerente@doceria.com',
    cor: '#6366f1',
    iniciais: 'JS',
    ativo: true,
  },
  {
    id: '2',
    nome: 'Maria Souza',
    cargo: 'Caixa',
    pin: '0000',
    email: 'caixa@doceria.com',
    cor: '#10b981',
    iniciais: 'MS',
    ativo: true,
  },
];

export const CATEGORIAS_PADRAO: Categoria[] = [
  { id: '1', nome: 'Churros Tradicionais', cor: '#f59e0b' },
  { id: '2', nome: 'Churros Gourmet', cor: '#ec4899' },
  { id: '3', nome: 'Bebidas', cor: '#3b82f6' },
];

export const COMPLEMENTOS_PADRAO: Complemento[] = [
  {
    id: '200',
    nome: 'Recheio',
    opcoes: [
      { id: '301', nome: 'Doce de leite', preco: 0 },
      { id: '302', nome: 'Nutella', preco: 2 },
      { id: '303', nome: 'Leite ninho', preco: 1.5 },
    ],
  },
  {
    id: '201',
    nome: 'Massa',
    opcoes: [
      { id: '304', nome: 'Tradicional', preco: 0 },
      { id: '305', nome: 'Chocolate', preco: 2 },
    ],
  },
];

export const PRODUTOS_PADRAO: Produto[] = [
  { id: '101', nome: 'Churros Doce de Leite', categoriaId: '1', preco: 12, ativo: true, complementoIds: ['200', '201'] },
  { id: '102', nome: 'Churros Nutella', categoriaId: '2', preco: 16.5, ativo: true, complementoIds: ['200'] },
  { id: '103', nome: 'Coca-Cola Lata', categoriaId: '3', preco: 6, ativo: true, complementoIds: [] },
];

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function loadLoja(): LojaInfo {
  return { ...LOJA_PADRAO, ...readJson<Partial<LojaInfo>>(STORAGE_KEYS.loja, {}) };
}

export function saveLoja(loja: LojaInfo): void {
  writeJson(STORAGE_KEYS.loja, loja);
}

export function loadOperadores(): Operador[] {
  const list = readJson<Operador[]>(STORAGE_KEYS.operadores, []);
  return list.length ? list : OPERADORES_PADRAO;
}

export function saveOperadores(list: Operador[]): void {
  writeJson(STORAGE_KEYS.operadores, list);
}

export function loadCategorias(): Categoria[] {
  const list = readJson<Categoria[]>(STORAGE_KEYS.categorias, []);
  return list.length ? list : CATEGORIAS_PADRAO;
}

export function saveCategorias(list: Categoria[]): void {
  writeJson(STORAGE_KEYS.categorias, list);
}

function migrateComplementos(raw: unknown): Complemento[] {
  if (!Array.isArray(raw) || raw.length === 0) return COMPLEMENTOS_PADRAO;
  const first = raw[0] as Record<string, unknown>;
  if (first && Array.isArray(first.opcoes)) {
    return (raw as Complemento[]).map((g) => ({
      id: String(g.id),
      nome: g.nome,
      opcoes: (g.opcoes ?? []).map((o) => ({
        id: String(o.id),
        nome: o.nome,
        preco: Number(o.preco) || 0,
      })),
    }));
  }
  if (first && 'preco' in first && !('opcoes' in first)) {
    return [
      {
        id: newId(),
        nome: 'Recheio',
        opcoes: (raw as { id: string; nome: string; preco: number }[]).map((o) => ({
          id: String(o.id),
          nome: o.nome,
          preco: Number(o.preco) || 0,
        })),
      },
    ];
  }
  return COMPLEMENTOS_PADRAO;
}

export function loadComplementos(): Complemento[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.complementos);
    if (!raw) return COMPLEMENTOS_PADRAO;
    return migrateComplementos(JSON.parse(raw));
  } catch {
    return COMPLEMENTOS_PADRAO;
  }
}

export function saveComplementos(list: Complemento[]): void {
  writeJson(STORAGE_KEYS.complementos, list);
}

export function loadProdutos(): Produto[] {
  const list = readJson<Produto[]>(STORAGE_KEYS.produtos, []);
  return list.length ? list : PRODUTOS_PADRAO;
}

export function saveProdutos(list: Produto[]): void {
  writeJson(STORAGE_KEYS.produtos, list);
}

export function loadVendas(): Venda[] {
  return readJson<Venda[]>(STORAGE_KEYS.vendas, []).sort((a, b) => b.timestamp - a.timestamp);
}

export function saveVendas(list: Venda[]): void {
  writeJson(STORAGE_KEYS.vendas, list);
}

export function persistVenda(venda: Venda): Venda[] {
  const list = [venda, ...loadVendas()].sort((a, b) => b.timestamp - a.timestamp);
  saveVendas(list);
  return list;
}

export function deleteVenda(id: string): Venda[] {
  const list = loadVendas().filter((v) => v.id !== id);
  saveVendas(list);
  return list;
}

export function replaceVenda(venda: Venda): Venda[] {
  const list = loadVendas();
  const idx = list.findIndex((v) => v.id === venda.id);
  const next =
    idx >= 0
      ? list.map((v) => (v.id === venda.id ? venda : v))
      : [venda, ...list];
  next.sort((a, b) => b.timestamp - a.timestamp);
  saveVendas(next);
  return next;
}
