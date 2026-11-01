import type { SenhaConfig } from '@gtech/shared';
import { registerSaleRemote, syncSenhaConfigRemote } from './pdvApi';
import { isOnline, loadPendingSales, removePendingSale } from './offlineStore';

export interface SyncResult {
  synced: number;
  failed: number;
  remaining: number;
  lastError?: string;
}

export async function syncPendingSales(
  storeId: string,
  senhaConfig: SenhaConfig,
): Promise<SyncResult> {
  if (!isOnline()) {
    return {
      synced: 0,
      failed: 0,
      remaining: loadPendingSales().length,
      lastError: 'Sem conexão com a internet',
    };
  }

  const pending = [...loadPendingSales()].sort((a, b) => a.timestamp - b.timestamp);
  let synced = 0;
  let failed = 0;
  let lastError: string | undefined;

  for (const venda of pending) {
    try {
      await registerSaleRemote(storeId, venda);
      removePendingSale(venda.id);
      synced++;
    } catch (e) {
      failed++;
      lastError = e instanceof Error ? e.message : 'Erro ao enviar venda';
    }
  }

  if (synced > 0) {
    try {
      await syncSenhaConfigRemote(storeId, senhaConfig);
    } catch (e) {
      lastError = lastError ?? (e instanceof Error ? e.message : 'Erro ao sincronizar senha');
    }
  }

  return {
    synced,
    failed,
    remaining: loadPendingSales().length,
    lastError,
  };
}
