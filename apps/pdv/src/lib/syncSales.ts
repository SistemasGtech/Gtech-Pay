import type { SenhaConfig } from '@gtech/shared';
import { ensurePdvAuthSession, formatPdvError, registerSaleRemote, syncSenhaConfigRemote } from './pdvApi';
import { isOnline, loadPendingSales, removePendingSale } from './offlineStore';

function isSaleAlreadyOnServerError(e: unknown): boolean {
  const msg = formatPdvError(e).toLowerCase();
  const code =
    e && typeof e === 'object' && 'code' in e ? String((e as { code: string }).code) : '';
  return (
    code === '23505' ||
    msg.includes('duplicate key') ||
    msg.includes('vendas_pkey') ||
    msg.includes('already exists')
  );
}

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

  try {
    await ensurePdvAuthSession();
  } catch (e) {
    return {
      synced: 0,
      failed: pending.length,
      remaining: pending.length,
      lastError: formatPdvError(e),
    };
  }
  let synced = 0;
  let failed = 0;
  let lastError: string | undefined;

  for (const venda of pending) {
    try {
      await registerSaleRemote(storeId, venda);
      removePendingSale(venda.id);
      synced++;
    } catch (e) {
      if (isSaleAlreadyOnServerError(e)) {
        removePendingSale(venda.id);
        synced++;
        continue;
      }
      failed++;
      lastError = formatPdvError(e);
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
