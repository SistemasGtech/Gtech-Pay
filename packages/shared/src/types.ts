export type FormaPagamento = 'PIX' | 'Cartão Crédito' | 'Cartão Débito' | 'Dinheiro';

export type PrinterTransport = 'browser' | 'bluetooth' | 'usb' | 'tcp';

export interface PrinterConfig {
  transport: PrinterTransport;
  /** Nome amigável / impressora pareada */
  deviceName: string;
  /** MAC Bluetooth (SPP) — formato AA:BB:CC:DD:EE:FF */
  bluetoothAddress: string;
  usbVendorId?: number;
  usbProductId?: number;
  /** Impressora na rede (ESC/POS porta 9100) */
  tcpHost?: string;
  tcpPort?: number;
  larguraPapel: '58mm' | '80mm';
  imprimirAutomatico: boolean;
}

export interface SenhaConfig {
  /** Próxima senha a ser usada na venda */
  proximaSenha: number;
  minimo: number;
  maximo: number;
  /** Incrementa automaticamente após confirmar venda */
  incrementoAutomatico: boolean;
  /** Zera para `minimo` quando muda o dia (local) */
  reiniciarACadaDia: boolean;
  /** yyyy-mm-dd da última venda ou reset */
  ultimaDataOperacao: string;
  /** Exibe e incrementa fila de senha nas vendas */
  controleAtivo?: boolean;
}

/** Taxa % da maquininha sobre o valor da venda (comparar com extrato da adquirente). */
export interface TaxasMaquininha {
  pix: number;
  cartaoDebito: number;
  cartaoCredito: number;
  dinheiro: number;
}

export interface LojaInfo {
  nome: string;
  endereco: string;
  telefone: string;
  cnpj: string;
  taxasMaquininha?: TaxasMaquininha;
}

export interface Operador {
  id: string;
  nome: string;
  cargo: string;
  pin: string;
  email?: string;
  cor: string;
  iniciais: string;
  ativo?: boolean;
}

export interface Categoria {
  id: string;
  nome: string;
  cor: string;
}

export interface OpcaoComplemento {
  id: string;
  nome: string;
  preco: number;
}

/** Grupo de complemento (ex.: Recheio) com lista de opções */
export interface Complemento {
  id: string;
  nome: string;
  opcoes: OpcaoComplemento[];
}

export interface Produto {
  id: string;
  nome: string;
  categoriaId: string;
  preco: number;
  ativo: boolean;
  complementoIds: string[];
}

export interface ItemCarrinho {
  carrinhoItemId: string;
  produtoId: string;
  nome: string;
  precoBase: number;
  precoUnitario: number;
  quantidade: number;
  subtotal: number;
  opcoes: { id: string; nome: string; preco: number }[];
  observacao: string;
}

export interface Venda {
  id: string;
  timestamp: number;
  senha: string;
  comanda: string;
  cliente: string;
  hora: string;
  data: string;
  pagamento: FormaPagamento;
  valorRecebido: number;
  troco: number;
  itens: ItemCarrinho[];
  total: number;
  operadorId?: string;
  operadorNome?: string;
}
