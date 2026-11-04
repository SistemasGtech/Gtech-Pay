import { Capacitor } from '@capacitor/core';
import { Network } from '@capacitor/network';

type Listener = (connected: boolean) => void;

const listeners = new Set<Listener>();

let networkConnected =
  typeof navigator !== 'undefined' ? navigator.onLine : true;

/** Última vez que bootstrap/sync falhou por rede (mesmo com sinal). */
let cloudReachable = true;

export function getNetworkConnected(): boolean {
  return networkConnected;
}

export function getCloudReachable(): boolean {
  return cloudReachable;
}

export function setCloudReachable(reachable: boolean): void {
  if (cloudReachable === reachable) return;
  cloudReachable = reachable;
  notifyListeners();
}

/** Para o PDV: rede do aparelho + conseguiu falar com Supabase recentemente. */
export function isOnline(): boolean {
  return networkConnected && cloudReachable;
}

function notifyListeners(): void {
  listeners.forEach((fn) => fn(isOnline()));
}

function setNetworkConnected(connected: boolean): void {
  if (networkConnected === connected) return;
  networkConnected = connected;
  if (!connected) cloudReachable = false;
  notifyListeners();
}

export function subscribeConnectivity(fn: Listener): () => void {
  listeners.add(fn);
  fn(isOnline());
  return () => listeners.delete(fn);
}

export function getConnectivityState(): { network: boolean; cloud: boolean } {
  return { network: networkConnected, cloud: cloudReachable };
}

let monitoringStarted = false;

export async function startNetworkMonitoring(): Promise<void> {
  if (monitoringStarted) return;
  monitoringStarted = true;

  if (Capacitor.isNativePlatform()) {
    try {
      const status = await Network.getStatus();
      setNetworkConnected(status.connected);
      await Network.addListener('networkStatusChange', (status) => {
        setNetworkConnected(status.connected);
      });
    } catch {
      /* fallback abaixo */
    }
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => setNetworkConnected(true));
    window.addEventListener('offline', () => setNetworkConnected(false));
  }
}
