import type { Venda } from '@gtech/shared';
import {
  deleteVenda as deleteVendaShared,
  loadVendas as loadVendasShared,
  persistVenda as persistVendaShared,
} from '@gtech/shared';

export {
  loadCategorias,
  loadComplementos,
  loadLoja,
  loadOperadores,
  loadProdutos,
  saveLoja,
  OPERADORES_PADRAO,
  CATEGORIAS_PADRAO,
  COMPLEMENTOS_PADRAO,
  PRODUTOS_PADRAO,
  LOJA_PADRAO,
} from '@gtech/shared';
export function loadVendas(): Venda[] {
  return loadVendasShared();
}

export function persistVenda(venda: Venda): Venda[] {
  return persistVendaShared(venda);
}

export function removeVenda(id: string): Venda[] {
  return deleteVendaShared(id);
}
