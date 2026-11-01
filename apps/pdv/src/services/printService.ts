import type { PrinterConfig } from '@gtech/shared';
import { buildTwoViaReceipt } from '@gtech/shared';
import type { LojaInfo, Venda } from '@gtech/shared';
import { Capacitor } from '@capacitor/core';

export const PRINTER_STORAGE_KEY = 'gtech_printer_config';

export const DEFAULT_PRINTER_CONFIG: PrinterConfig = {
  transport: Capacitor.isNativePlatform() ? 'bluetooth' : 'browser',
  deviceName: '',
  bluetoothAddress: '',
  tcpHost: '',
  tcpPort: 9100,
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
  transport: 'bluetooth' | 'usb' | 'tcp';
  address?: string;
  vendorId?: number;
  productId?: number;
  host?: string;
  port?: number;
}

function normalizeMac(input: string): string {
  const hex = input.replace(/[^0-9a-fA-F]/g, '').toUpperCase();
  if (hex.length !== 12) return input.trim();
  return hex.match(/.{1,2}/g)!.join(':');
}

export function isValidBluetoothMac(mac: string): boolean {
  return /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/i.test(normalizeMac(mac));
}

async function getThermalPrinter() {
  const mod = await import('@devlas/capacitor-thermal-printer');
  return { ThermalPrinter: mod.ThermalPrinter, bytesToBase64: mod.bytesToBase64 };
}

export async function requestPrinterPermissions(config: PrinterConfig): Promise<string | null> {
  if (!Capacitor.isNativePlatform() || config.transport === 'browser') return null;
  try {
    const { ThermalPrinter } = await getThermalPrinter();
    if (config.transport === 'bluetooth') {
      const address = normalizeMac(config.bluetoothAddress);
      if (!isValidBluetoothMac(address)) {
        return 'Informe o MAC Bluetooth (pareie antes em Ajustes → Bluetooth).';
      }
      const perm = await ThermalPrinter.requestPermission({ transport: 'bluetooth', address });
      return perm.granted ? null : 'Permissão Bluetooth negada. Ative em Ajustes do Android.';
    }
    if (config.transport === 'usb') {
      if (config.usbVendorId == null || config.usbProductId == null) {
        return 'Selecione uma impressora USB na lista.';
      }
      const perm = await ThermalPrinter.requestPermission({
        transport: 'usb',
        vendorId: config.usbVendorId,
        productId: config.usbProductId,
      });
      return perm.granted ? null : 'Permissão USB negada. Reconecte o cabo OTG e aceite o diálogo.';
    }
    if (config.transport === 'tcp') {
      const perm = await ThermalPrinter.requestPermission({
        transport: 'tcp',
        host: config.tcpHost?.trim() || '',
        port: config.tcpPort ?? 9100,
      });
      return perm.granted ? null : 'Não foi possível usar a impressora na rede.';
    }
  } catch (e) {
    return e instanceof Error ? e.message : 'Erro ao pedir permissão da impressora.';
  }
  return null;
}

export async function listNativePrinters(
  transport: 'bluetooth' | 'usb' | 'all' = 'all',
): Promise<{ devices: ListedDevice[]; error?: string }> {
  if (!Capacitor.isNativePlatform()) return { devices: [] };
  try {
    const { ThermalPrinter } = await getThermalPrinter();
    const devices: ListedDevice[] = [];

    if (transport === 'bluetooth' || transport === 'all') {
      const bt = await ThermalPrinter.list({ transport: 'bluetooth' });
      for (const d of bt.devices ?? []) {
        if (!d.address) continue;
        devices.push({
          id: `bt:${d.address}`,
          name: d.name ?? d.address,
          transport: 'bluetooth',
          address: d.address,
        });
      }
    }

    if (transport === 'usb' || transport === 'all') {
      const usb = await ThermalPrinter.list({ transport: 'usb' });
      for (const d of usb.devices ?? []) {
        if (d.vendorId == null || d.productId == null) continue;
        devices.push({
          id: `usb:${d.vendorId}:${d.productId}`,
          name: d.name ?? `USB ${d.vendorId}:${d.productId}`,
          transport: 'usb',
          vendorId: d.vendorId,
          productId: d.productId,
        });
      }
    }

    return { devices };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Falha ao listar impressoras';
    console.warn('listNativePrinters', e);
    return { devices: [], error: msg };
  }
}

export async function discoverNetworkPrinters(timeoutMs = 5000): Promise<ListedDevice[]> {
  if (!Capacitor.isNativePlatform()) return [];
  try {
    const { ThermalPrinter } = await getThermalPrinter();
    const res = await ThermalPrinter.discover({ transport: 'tcp', timeoutMs });
    return (res.devices ?? []).map((d) => ({
      id: `tcp:${d.host}:${d.port}`,
      name: d.name || `${d.host}:${d.port}`,
      transport: 'tcp' as const,
      host: d.host,
      port: d.port,
    }));
  } catch (e) {
    console.warn('discoverNetworkPrinters', e);
    return [];
  }
}

function formatBrlHtml(value: number): string {
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
}

function htmlViaProducao(venda: Venda, loja: LojaInfo): string {
  const itensHtml = venda.itens
    .map(
      (it) => `
    <div style="margin-bottom:6px;border-bottom:1px dashed #000;padding-bottom:6px;text-align:left;">
      <div style="display:flex;justify-content:space-between;font-weight:900;font-size:13px;gap:4px;">
        <span>${it.quantidade}x ${it.nome}</span>
        <span>${formatBrlHtml(it.subtotal)}</span>
      </div>
      <div style="font-size:10px;color:#333;padding-left:4px;">${formatBrlHtml(it.precoUnitario)}/un</div>
      ${it.opcoes.map((o) => `<div style="font-size:11px;padding-left:8px;font-weight:bold;">• ${o.nome}${o.preco > 0 ? ` (+${formatBrlHtml(o.preco)})` : ''}</div>`).join('')}
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
      <div style="display:flex;justify-content:space-between;font-weight:900;font-size:15px;margin-top:6px;padding-top:4px;border-top:2px solid #000;">
        <span>TOTAL</span><span>${formatBrlHtml(venda.total)}</span>
      </div>
      <div style="text-align:left;font-size:11px;margin-top:4px;">Pagamento: ${venda.pagamento}</div>
      ${
        venda.pagamento === 'Dinheiro'
          ? `<div style="text-align:left;font-size:11px;">Recebido: ${formatBrlHtml(venda.valorRecebido)} · Troco: ${formatBrlHtml(venda.troco)}</div>`
          : ''
      }
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
  const { ThermalPrinter, bytesToBase64: b64 } = await getThermalPrinter();
  const data = buildTwoViaReceipt(venda, loja, config);
  const payload = b64(data);

  const permErr = await requestPrinterPermissions(config);
  if (permErr) throw new Error(permErr);

  if (config.transport === 'bluetooth') {
    const address = normalizeMac(config.bluetoothAddress);
    if (!isValidBluetoothMac(address)) {
      throw new Error('Selecione a impressora ou digite o MAC Bluetooth (AA:BB:CC:DD:EE:FF).');
    }
    await ThermalPrinter.print({ transport: 'bluetooth', address, data: payload });
    return;
  }

  if (config.transport === 'usb') {
    if (config.usbVendorId == null || config.usbProductId == null) {
      throw new Error('Selecione uma impressora USB na lista.');
    }
    await ThermalPrinter.print({
      transport: 'usb',
      vendorId: config.usbVendorId,
      productId: config.usbProductId,
      data: payload,
    });
    return;
  }

  if (config.transport === 'tcp') {
    const host = config.tcpHost?.trim();
    if (!host) throw new Error('Informe o IP da impressora (Wi‑Fi/LAN).');
    await ThermalPrinter.print({
      transport: 'tcp',
      host,
      port: config.tcpPort ?? 9100,
      data: payload,
    });
    return;
  }

  printViaBrowser(venda, loja, config);
}

export async function imprimirVenda(
  venda: Venda,
  loja: LojaInfo,
  config: PrinterConfig,
): Promise<void> {
  if (config.transport === 'browser' || !Capacitor.isNativePlatform()) {
    printViaBrowser(venda, loja, config);
    return;
  }
  await printViaNative(venda, loja, config);
}

export async function testarImpressora(loja: LojaInfo, config: PrinterConfig): Promise<void> {
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

export { normalizeMac };
