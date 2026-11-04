import type { Venda } from '@gtech/shared';
import { saveVendas } from '@gtech/shared';
import type { PdvBootstrap } from './pdvApi';
export { isOnline, setCloudReachable, subscribeConnectivity, startNetworkMonitoring, getConnectivityState, getNetworkConnected } from './networkStatus';

export const SNAPSHOT_KEY = 'gtech_pdv_snapshot';
export const PENDING_SALES_KEY = 'gtech_pdv_pending_sales';
export const PIN_CACHE_KEY = 'gtech_pdv_operador_pins';
export const SESSION_KEY = 'gtech_pdv_session';

export interface StoredSession {
  storeId: string;
  operadorId: string;
  savedAt: number;
}

export interface StoredSnapshot {
  storeId: string;
  updatedAt: number;
  bootstrap: PdvBootstrap;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export function saveSnapshot(storeId: string, bootstrap: PdvBootstrap): void {
  const payload: StoredSnapshot = {
    storeId,
    updatedAt: Date.now(),
    bootstrap,
  };
  writeJson(SNAPSHOT_KEY, payload);
}

export function loadSnapshot(storeId: string): StoredSnapshot | null {
  const snap = readJson<StoredSnapshot | null>(SNAPSHOT_KEY, null);
  if (!snap) return null;
  if (normalizeSnapshotStoreId(snap.storeId) !== normalizeSnapshotStoreId(storeId)) return null;
  return snap;
}

export function loadLatestSnapshot(): StoredSnapshot | null {
  return readJson<StoredSnapshot | null>(SNAPSHOT_KEY, null);
}

function normalizeSnapshotStoreId(id: string): string {
  return String(id).trim().toLowerCase();
}

/** Carrega catálogo salvo no tablet (preferindo o storeId informado). */
export function loadSnapshotForBootstrap(preferredStoreId: string | null): StoredSnapshot | null {
  if (preferredStoreId) {
    const hit = loadSnapshot(preferredStoreId);
    if (hit) return hit;
  }
  return loadLatestSnapshot();
}

export function loadPendingSales(): Venda[] {
  return readJson<Venda[]>(PENDING_SALES_KEY, []);
}

export function addPendingSale(venda: Venda): void {
  const list = loadPendingSales().filter((v) => v.id !== venda.id);
  writeJson(PENDING_SALES_KEY, [venda, ...list]);
}

export function removePendingSale(vendaId: string): void {
  writeJson(
    PENDING_SALES_KEY,
    loadPendingSales().filter((v) => v.id !== vendaId),
  );
}

export function countPendingSales(): number {
  return loadPendingSales().length;
}

export function mergeVendasForDisplay(server: Venda[], pending: Venda[]): Venda[] {
  const map = new Map<string, Venda>();
  for (const v of server) map.set(v.id, v);
  for (const v of pending) map.set(v.id, v);
  return [...map.values()].sort((a, b) => b.timestamp - a.timestamp);
}

export function syncVendasDisplayFromServer(server: Venda[]): Venda[] {
  const merged = mergeVendasForDisplay(server, loadPendingSales());
  saveVendas(merged);
  return merged;
}

export function loadOperadorPinCache(): Record<string, string> {
  return readJson<Record<string, string>>(PIN_CACHE_KEY, {});
}

export function saveOperadorPin(operadorId: string, pin: string): void {
  const cache = loadOperadorPinCache();
  cache[operadorId] = pin;
  writeJson(PIN_CACHE_KEY, cache);
}

export function verifyOperadorPinLocal(operadorId: string, pin: string): boolean {
  return loadOperadorPinCache()[operadorId] === pin;
}

export function savePdvSession(storeId: string, operadorId: string): void {
  const payload: StoredSession = { storeId, operadorId, savedAt: Date.now() };
  writeJson(SESSION_KEY, payload);
}

export function loadPdvSession(): StoredSession | null {
  return readJson<StoredSession | null>(SESSION_KEY, null);
}

export function clearPdvSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

export function clearOperadorPin(operadorId: string): void {
  const cache = loadOperadorPinCache();
  delete cache[operadorId];
  writeJson(PIN_CACHE_KEY, cache);
}
