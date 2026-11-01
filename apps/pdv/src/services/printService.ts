import type { PrinterConfig } from '@gtech/shared';
import { buildTwoViaReceipt } from '@gtech/shared';
import type { LojaInfo, Venda } from '@gtech/shared';
import { Capacitor } from '@capacitor/core';

export const PRINTER_STORAGE_KEY = 'gtech_printer_config';

export const DEFAULT_PRINTER_CONFIG: PrinterConfig = {
  transport: Capacitor.isNativePlatform() ? 'bluetooth' : 'browser',
  deviceName: '',
  bluetoothAddress: '',
  larguraPapel: '80mm',
  imprimirAutomatico: true,
};

export function loadPrinterConfig(): PrinterConfig {
  try {
    const raw = localStorage.getItem(PRINTER_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PRINTER_CONFIG };
    return { ...DEFAULT_PRINTER_CONFIG, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_PRINTER_CONFIG };
  }
}

export function savePrinterConfig(config: PrinterConfig): void {
  localStorage.setItem(PRINTER_STORAGE_KEY, JSON.stringify(config));
}

export interface ListedDevice {
  id: string;
  name: string;
  transport: 'bluetooth' | 'usb';
  address?: string;
  vendorId?: number;
  productId?: number;
}

export async function listNativePrinters(): Promise<ListedDevice[]> {
  if (!Capacitor.isNativePlatform()) return [];
  try {
    const { ThermalPrinter } = await import('@devlas/capacitor-thermal-printer');
    const bt = await ThermalPrinter.list({ transport: 'bluetooth' });
    const usb = await ThermalPrinter.list({ transport: 'usb' });
    const devices: ListedDevice[] = [];
    for (const d of bt.devices ?? []) {
      devices.push({
        id: `bt:${d.address}`,
        name: d.name ?? d.address ?? 'Bluetooth',
        transport: 'bluetooth',
        address: d.address,
      });
    }
    for (const d of usb.devices ?? []) {
      devices.push({
        id: `usb:${d.vendorId}:${d.productId}`,
        name: d.name ?? `USB ${d.vendorId}:${d.productId}`,
        transport: 'usb',
        vendorId: d.vendorId,
        productId: d.productId,
      });
    }
    return devices;
  } catch (e) {
    console.warn('listNativePrinters', e);
    return [];
  }
}

function htmlViaProducao(venda: Venda, loja: LojaInfo): string {
  const itensHtml = venda.itens
    .map(
      (it) => `
    <div style="margin-bottom:6px;border-bottom:1px dashed #000;padding-bottom:6px;text-align:left;">
      <div style="font-weight:900;font-size:13px;">${it.quantidade}x ${it.nome}</div>
      ${it.opcoes.map((o) => `<div style="font-size:11px;padding-left:8px;font-weight:bold;">• ${o.nome}</div>`).join('')}
      ${it.observacao ? `<div style="font-weight:900;margin-top:4px;font-size:11px;">OBS: ${it.observacao}</div>` : ''}
    </div>`,
    )
    .join('');

  const qtd = venda.itens.reduce((s, i) => s + i.quantidade, 0);
  const senhaBlock = venda.senha?.trim()
    ? `<div style="margin:8px 0;padding:6px;border:3px solid #000;border-radius:8px;">
        <div style="font-size:11px;font-weight:900;">SENHA</div>
        <div style="font-size:36px;font-weight:900;line-height:1;">#${venda.senha}</div>
      </div>`
    : '';

  return `
    <div style="text-align:center;font-size:12px;line-height:1.35;color:#000;">
      <div style="font-weight:900;border:2px solid #000;padding:4px;margin-bottom:6px;">*** 1ª VIA — PRODUÇÃO ***</div>
      <div style="font-weight:900;font-size:14px;">${loja.nome}</div>
      <div style="font-size:11px;">${venda.data} · ${venda.hora}</div>
      ${senhaBlock}
      <div style="font-weight:900;text-align:left;font-size:12px;margin:6px 0;">CLIENTE: ${venda.cliente}</div>
      <div style="border-top:2px dashed #000;margin:6px 0;"></div>
      ${itensHtml}
      <div style="border-top:2px dashed #000;margin:6px 0;"></div>
      <div style="display:flex;justify-content:space-between;font-weight:900;font-size:12px;">
        <span>Itens</span><span>${qtd}</span>
      </div>
      <div style="text-align:left;font-size:11px;margin-top:4px;">Pagamento: ${venda.pagamento}</div>
    </div>`;
}

function htmlViaCliente(venda: Venda): string {
  const senha = venda.senha?.trim();
  if (!senha) return '';

  return `
    <div style="margin:16px 0;padding:12px 0;text-align:center;border-top:2px dashed #000;border-bottom:2px dashed #000;">
      <div style="font-size:10px;font-weight:bold;margin-bottom:8px;">— CORTE — 2ª VIA CLIENTE —</div>
      <div style="font-size:56px;font-weight:900;line-height:1;letter-spacing:2px;">#${senha}</div>
    </div>`;
}

function printViaBrowser(venda: Venda, loja: LojaInfo, config: PrinterConfig): void {
  const area = document.getElementById('thermal-receipt-print-area');
  if (!area) return;
  const largura = config.larguraPapel === '58mm' ? '58mm' : '80mm';
  area.style.width = largura;

  area.innerHTML = `
    <div style="font-family:monospace;padding:4mm;">
      ${htmlViaProducao(venda, loja)}
      ${htmlViaCliente(venda)}
    </div>`;

  setTimeout(() => window.print(), 150);
}

async function printViaNative(venda: Venda, loja: LojaInfo, config: PrinterConfig): Promise<void> {
  const { ThermalPrinter, bytesToBase64: b64 } = await import('@devlas/capacitor-thermal-printer');
  const data = buildTwoViaReceipt(venda, loja, config);
  const payload = b64(data);

  if (config.transport === 'bluetooth') {
    if (!config.bluetoothAddress) throw new Error('Selecione uma impressora Bluetooth pareada.');
    const target = { transport: 'bluetooth' as const, address: config.bluetoothAddress };
    const perm = await ThermalPrinter.requestPermission(target);
    if (!perm.granted) throw new Error('Permissão Bluetooth negada.');
    await ThermalPrinter.print({ ...target, data: payload });
    return;
  }

  if (config.transport === 'usb') {
    if (config.usbVendorId == null || config.usbProductId == null) {
      throw new Error('Selecione uma impressora USB.');
    }
    const target = {
      transport: 'usb' as const,
      vendorId: config.usbVendorId,
      productId: config.usbProductId,
    };
    const perm = await ThermalPrinter.requestPermission(target);
    if (!perm.granted) throw new Error('Permissão USB negada.');
    await ThermalPrinter.print({ ...target, data: payload });
    return;
  }

  printViaBrowser(venda, loja, config);
}

export async function imprimirVenda(
  venda: Venda,
  loja: LojaInfo,
  config: PrinterConfig
): Promise<void> {
  if (config.transport === 'browser' || !Capacitor.isNativePlatform()) {
    printViaBrowser(venda, loja, config);
    return;
  }
  await printViaNative(venda, loja, config);
}

export async function testarImpressora(
  loja: LojaInfo,
  config: PrinterConfig
): Promise<void> {
  const agora = new Date();
  const vendaTeste: Venda = {
    id: 'test',
    timestamp: Date.now(),
    senha: '99',
    comanda: '99',
    cliente: 'Teste Gtech',
    data: agora.toLocaleDateString('pt-BR'),
    hora: agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    pagamento: 'PIX',
    valorRecebido: 1,
    troco: 0,
    total: 1,
    itens: [
      {
        carrinhoItemId: 't1',
        produtoId: '0',
        nome: 'TESTE DE IMPRESSAO',
        precoBase: 1,
        precoUnitario: 1,
        quantidade: 1,
        subtotal: 1,
        opcoes: [],
        observacao: 'Sem cebola',
      },
    ],
  };
  await imprimirVenda(vendaTeste, loja, config);
}
