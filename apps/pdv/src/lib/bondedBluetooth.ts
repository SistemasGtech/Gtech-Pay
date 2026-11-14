import { Capacitor, registerPlugin } from '@capacitor/core';

export interface BondedBtDevice {
  name: string;
  address: string;
}

interface BondedBluetoothPermissions {
  btConnect?: 'prompt' | 'prompt-with-rationale' | 'granted' | 'denied' | 'limited';
}

interface GtechBondedBluetoothPlugin {
  ping(): Promise<{ ok: boolean; version: number }>;
  isConnectGranted(): Promise<{ granted: boolean }>;
  syncConnectPermission(): Promise<{ granted: boolean }>;
  probeConnect(options: { address: string }): Promise<{ ok: boolean; message?: string }>;
  printEscPos(options: { address: string; data: string }): Promise<void>;
  listBonded(): Promise<{ devices: BondedBtDevice[] }>;
  checkPermissions(): Promise<BondedBluetoothPermissions>;
  requestPermissions(): Promise<BondedBluetoothPermissions>;
}

export const GtechBondedBluetooth = registerPlugin<GtechBondedBluetoothPlugin>('GtechBondedBluetooth');

const LIST_TIMEOUT_MS = 12_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} demorou demais (${ms / 1000}s). Tente MAC manual.`)), ms),
    ),
  ]);
}

function pluginMissingMessage(): string {
  return 'Este APK não inclui o plugin Bluetooth nativo. Rode: npm run pdv:build, npx cap sync android, assembleDebug e instale de novo.';
}

function isPluginMissingError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /not implemented|unimplemented|plugin.*not/i.test(msg);
}

/** Confirma que o APK contém o plugin Java GtechBondedBluetooth. */
export async function pingBondedBluetoothPlugin(): Promise<{ ok: boolean; version: number } | null> {
  if (Capacitor.getPlatform() !== 'android') return null;
  try {
    return await withTimeout(GtechBondedBluetooth.ping(), 5000, 'Plugin');
  } catch (e) {
    if (isPluginMissingError(e)) return null;
    throw e;
  }
}

/** BLUETOOTH_CONNECT no Android + prova prática (listBonded). */
export async function isAndroidBluetoothConnectGranted(): Promise<boolean> {
  if (Capacitor.getPlatform() !== 'android') return true;

  try {
    const r = await GtechBondedBluetooth.isConnectGranted();
    if (r.granted === true) return true;
  } catch {
    /* APK antigo sem isConnectGranted */
  }

  try {
    await withTimeout(GtechBondedBluetooth.listBonded(), 5000, 'Lista');
    return true;
  } catch {
    return false;
  }
}

/** Pede BLUETOOTH_CONNECT se o Android ainda não concedeu. */
export async function ensureBondedBluetoothPermission(): Promise<string | null> {
  if (Capacitor.getPlatform() !== 'android') return null;

  if (await isAndroidBluetoothConnectGranted()) return null;

  const ping = await pingBondedBluetoothPlugin();
  if (!ping?.ok) return pluginMissingMessage();

  try {
    await GtechBondedBluetooth.requestPermissions();
  } catch (e) {
    if (isPluginMissingError(e)) return pluginMissingMessage();
  }

  if (await isAndroidBluetoothConnectGranted()) return null;

  return 'Permissão negada. Configurações → Apps → Gtech PDV → Permissões → Dispositivos por perto / Bluetooth.';
}

/** Lista aparelhos pareados no Android (Ajustes → Bluetooth). */
export async function listBondedBluetoothDevices(): Promise<BondedBtDevice[]> {
  const res = await withTimeout(GtechBondedBluetooth.listBonded(), LIST_TIMEOUT_MS, 'Lista Bluetooth');
  return res.devices ?? [];
}

const PRINT_TIMEOUT_MS = 120_000;

/** Evita round-trip nativo de permissão a cada cupom (válido até o app fechar). */
let bluetoothPrintSessionReady = false;

/** Abre o pedido de BLUETOOTH_CONNECT (Dispositivos por perto) antes de imprimir. */
export async function syncAndroidBluetoothConnectPermission(): Promise<boolean> {
  if (Capacitor.getPlatform() !== 'android') return true;
  try {
    const r = await GtechBondedBluetooth.syncConnectPermission();
    return r.granted === true || (await isAndroidBluetoothConnectGranted());
  } catch {
    return await isAndroidBluetoothConnectGranted();
  }
}

/** Impressão ESC/POS via SPP — não usa o plugin térmico (evita falso erro de permissão). */
export async function printBluetoothEscPos(address: string, dataBase64: string): Promise<void> {
  const mac = address.trim();
  if (!bluetoothPrintSessionReady) {
    const ok = await syncAndroidBluetoothConnectPermission();
    bluetoothPrintSessionReady = ok;
  }
  await withTimeout(
    GtechBondedBluetooth.printEscPos({ address: mac, data: dataBase64 }),
    PRINT_TIMEOUT_MS,
    'Impressão',
  );
}

export function resetBluetoothPrintSession(): void {
  bluetoothPrintSessionReady = false;
}

export async function probeBluetoothPrinterConnect(address: string): Promise<string> {
  try {
    const r = await withTimeout(
      GtechBondedBluetooth.probeConnect({ address: address.trim() }),
      20_000,
      'Teste conexão',
    );
    return r.message ?? 'Conexão SPP OK';
  } catch (e) {
    if (isPluginMissingError(e)) {
      return 'ERRO: printEscPos/probeConnect ausente — APK sem Java novo (cap sync + assembleDebug).';
    }
    return e instanceof Error ? e.message : String(e);
  }
}

export { LIST_TIMEOUT_MS, withTimeout };
