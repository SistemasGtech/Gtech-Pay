import type { PrinterConfig } from '@gtech/shared';
import { buildTwoViaReceipt, buildSimpleTestReceipt, bytesToBase64 } from '@gtech/shared';
import type { LojaInfo, Venda } from '@gtech/shared';
import { Capacitor } from '@capacitor/core';
import { ThermalPrinter } from '@devlas/capacitor-thermal-printer';
import { listBondedBluetoothDevices, withTimeout, LIST_TIMEOUT_MS, ensureBondedBluetoothPermission, pingBondedBluetoothPlugin, isAndroidBluetoothConnectGranted, printBluetoothEscPos, probeBluetoothPrinterConnect } from '../lib/bondedBluetooth';

export const PRINTER_STORAGE_KEY = 'gtech_printer_config';

export const DEFAULT_PRINTER_CONFIG: PrinterConfig = {
  transport: Capacitor.isNativePlatform() ? 'bluetooth' : 'browser',
  deviceName: '',
  bluetoothAddress: '',
  tcpHost: '',
  tcpPort: 9100,
  larguraPapel: '58mm',
  imprimirAutomatico: true,
};

export function loadPrinterConfig(): PrinterConfig {
  try {
    const raw = localStorage.getItem(PRINTER_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PRINTER_CONFIG };
    const merged = { ...DEFAULT_PRINTER_CONFIG, ...JSON.parse(raw) } as PrinterConfig;
    if (Capacitor.isNativePlatform() && merged.transport === 'browser') {
      merged.transport = 'bluetooth';
    }
    return merged;
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

function getThermalPrinter() {
  return { ThermalPrinter };
}

export function openAndroidBluetoothSettings(): void {
  if (Capacitor.getPlatform() !== 'android') return;
  window.location.href = 'intent:#Intent;action=android.settings.BLUETOOTH_SETTINGS;end';
}

export function openAppPermissionSettings(): void {
  if (Capacitor.getPlatform() !== 'android') return;
  window.location.href =
    'intent:#Intent;action=android.settings.APPLICATION_DETAILS_SETTINGS;scheme=package;package=com.gtech.pdv;end';
}

/** Texto de diagnóstico (Bluetooth pareados no Android). */
export async function diagnoseBluetoothPrinter(config?: PrinterConfig): Promise<string> {
  const lines: string[] = [
    `App: ${Capacitor.getPlatform()} (nativo=${Capacitor.isNativePlatform()})`,
    `Build JS impressão: 1.0.8`,
  ];
  if (!Capacitor.isNativePlatform()) {
    lines.push('Instale o APK Gtech PDV — Chrome nao lista Bluetooth.');
    return lines.join('\n');
  }
  if (config?.transport === 'bluetooth') {
    const mac = normalizeMac(config.bluetoothAddress?.trim() ?? '');
    lines.push(`MAC salvo no app: ${mac || '(vazio — confirme a impressora)'}`);
    lines.push(`MAC valido: ${mac && isValidBluetoothMac(mac) ? 'sim' : 'nao'}`);
  }
  const ping = await pingBondedBluetoothPlugin();
  lines.push(ping ? `Plugin nativo: v${ping.version} (precisa v8+)` : 'Plugin nativo: AUSENTE no APK');
  lines.push(
    (await isAndroidBluetoothConnectGranted())
      ? 'BLUETOOTH_CONNECT + SCAN (Android): OK para imprimir'
      : 'BLUETOOTH: falta CONNECT ou SCAN — libere as duas em Permissoes do app',
  );
  try {
    const bonded = await listBondedBluetoothDevices();
    lines.push(`Lista nativa — pareados: ${bonded.length}`);
    for (const d of bonded) {
      lines.push(`• ${d.name} — ${d.address}`);
    }
  } catch (e) {
    lines.push(`Lista nativa: ${e instanceof Error ? e.message : e}`);
  }
  if (config?.bluetoothAddress && isValidBluetoothMac(normalizeMac(config.bluetoothAddress))) {
    const mac = normalizeMac(config.bluetoothAddress);
    lines.push('--- Teste conexao SPP (sem imprimir cupom) ---');
    lines.push(await probeBluetoothPrinterConnect(mac));
  }
  return lines.join('\n');
}


export function formatPrintError(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  if (/not implemented|unimplemented|ausente no APK/i.test(raw)) {
    return `${raw} — Reinstale APK 1.0.6 (npm run pdv:build, cap sync, assembleDebug). Desinstale o app antigo antes.`;
  }
  if (/BLUETOOTH_SCAN|permission_denied|BLUETOOTH_CONNECT|Permissao Bluetooth/i.test(raw)) {
    return `${raw} — Configurações → Apps → Gtech PDV → Permissões: ative Dispositivos por perto E Buscar dispositivos Bluetooth. Force parar o app e teste de novo.`;
  }
  if (/connect_failed|Bluetooth desligado|RFCOMM|read failed|socket/i.test(raw)) {
    return `Conexão com a impressora falhou: ${raw}. Impressora ligada, pareada e perto do tablet?`;
  }
  if (/Confirme a impressora|MAC/i.test(raw)) {
    return raw;
  }
  return raw || 'Falha ao imprimir teste.';
}

export function validateBluetoothMacForPrint(bluetoothAddress: string): string | null {
  const mac = normalizeMac(bluetoothAddress.trim());
  if (!bluetoothAddress.trim() || !isValidBluetoothMac(mac)) {
    return 'Confirme a impressora: toque nela na lista e em Confirmar impressora (ou Salvar MAC).';
  }
  return null;
}

/** Valida MAC antes de imprimir (não usa plugin térmico — evita falso erro de permissão). */
export async function ensureBluetoothReadyForPrint(bluetoothAddress: string): Promise<string | null> {
  return validateBluetoothMacForPrint(bluetoothAddress);
}

export async function requestBluetoothAccess(): Promise<string | null> {
  if (!Capacitor.isNativePlatform()) return null;
  if (Capacitor.getPlatform() === 'android') {
    if (await isAndroidBluetoothConnectGranted()) return null;
    const err = await ensureBondedBluetoothPermission();
    if (await isAndroidBluetoothConnectGranted()) return null;
    return err;
  }
  return null;
}

export async function requestPrinterPermissions(config: PrinterConfig): Promise<string | null> {
  if (!Capacitor.isNativePlatform() || config.transport === 'browser') return null;

  if (config.transport === 'bluetooth') {
    return validateBluetoothMacForPrint(config.bluetoothAddress);
  }

  try {
    const { ThermalPrinter } = getThermalPrinter();
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
    const msg = e instanceof Error ? e.message : 'Erro ao pedir permissão da impressora.';
    if (/unimplemented|solo android/i.test(msg)) {
      return 'App sem plugin de impressora USB/rede. Reinstale o APK atualizado.';
    }
    return msg;
  }
  return null;
}

export async function listNativePrinters(
  transport: 'bluetooth' | 'usb' | 'all' = 'all',
): Promise<{ devices: ListedDevice[]; error?: string }> {
  if (!Capacitor.isNativePlatform()) return { devices: [] };
  try {
    const { ThermalPrinter } = getThermalPrinter();
    const devices: ListedDevice[] = [];

    if (transport === 'bluetooth' || transport === 'all') {
      let listError: string | undefined;

      if (Capacitor.getPlatform() === 'android') {
        const permErr = await ensureBondedBluetoothPermission();
        if (permErr && devices.length === 0) {
          /* tenta listar mesmo assim — permissão pode estar OK no Android */
        }

        try {
          const bonded = await listBondedBluetoothDevices();
          for (const d of bonded) {
            devices.push({
              id: `bt:${d.address}`,
              name: d.name || d.address,
              transport: 'bluetooth',
              address: d.address,
            });
          }
        } catch (e) {
          listError = e instanceof Error ? e.message : 'Falha na lista nativa';
          console.warn('listBondedBluetoothDevices', e);
        }
      }

      if (devices.length === 0) {
        await requestBluetoothAccess();
        try {
          let bt = await withTimeout(
            ThermalPrinter.list({ transport: 'bluetooth' }),
            LIST_TIMEOUT_MS,
            'Lista',
          );
          if ((bt.devices?.length ?? 0) === 0) {
            await new Promise((r) => setTimeout(r, 400));
            bt = await ThermalPrinter.list({ transport: 'bluetooth' });
          }
          for (const d of bt.devices ?? []) {
            if (!d.address) continue;
            devices.push({
              id: `bt:${d.address}`,
              name: d.name ?? d.address,
              transport: 'bluetooth',
              address: d.address,
            });
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Falha plugin térmico';
          listError = listError ? `${listError} | ${msg}` : msg;
        }
      }

      if (devices.length === 0 && listError) {
        return { devices: [], error: listError };
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
    let msg = e instanceof Error ? e.message : 'Falha ao listar impressoras';
    if (/unimplemented|solo android/i.test(msg)) {
      msg = 'Plugin de impressora não encontrado. Instale o APK gerado após cap sync.';
    }
    if (/permission|permiso|denied/i.test(msg)) {
      msg = 'Permissão Bluetooth negada. Toque em "Permitir Bluetooth" ou libere nas configurações do app.';
    }
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

function htmlViaCliente(venda: Venda, loja: LojaInfo): string {
  const senha = venda.senha?.trim();
  if (!senha) return '';

  return `
    <div style="margin:16px 0;padding:12px 0;text-align:center;border-top:2px dashed #000;">
      <div style="font-weight:900;font-size:14px;">${loja.nome}</div>
      <div style="font-size:10px;font-weight:bold;margin:6px 0;">2ª VIA — CLIENTE</div>
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
      ${htmlViaCliente(venda, loja)}
    </div>`;

  setTimeout(() => window.print(), 150);
}

async function printViaNative(venda: Venda, loja: LojaInfo, config: PrinterConfig): Promise<void> {
  const { ThermalPrinter } = getThermalPrinter();
  const data = buildTwoViaReceipt(venda, loja, config);
  const payload = bytesToBase64(data);

  if (config.transport === 'bluetooth') {
    const macErr = validateBluetoothMacForPrint(config.bluetoothAddress);
    if (macErr) throw new Error(macErr);
    const address = normalizeMac(config.bluetoothAddress);
    if (Capacitor.getPlatform() === 'android') {
      await printBluetoothEscPos(address, payload);
      return;
    }
    await ThermalPrinter.print({ transport: 'bluetooth', address, data: payload });
    return;
  }

  const permErr = await requestPrinterPermissions(config);
  if (permErr) throw new Error(permErr);

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
  if (
    Capacitor.isNativePlatform() &&
    Capacitor.getPlatform() === 'android' &&
    config.transport === 'bluetooth'
  ) {
    const macErr = validateBluetoothMacForPrint(config.bluetoothAddress);
    if (macErr) throw new Error(macErr);
    const payload = bytesToBase64(buildSimpleTestReceipt(loja));
    await printBluetoothEscPos(normalizeMac(config.bluetoothAddress), payload);
    return;
  }

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
