/** PIN de 4 dígitos para a aba Resumo (vendas) — armazenado só neste aparelho. */
const KEY = 'gtech_pdv_faturamento_pin';

/** Tempo sem interação na aba Resumo até pedir o PIN de novo (ms). */
export const RESUMO_IDLE_LOCK_MS = 5 * 60 * 1000;

let resumoUnlockUntil = 0;

export function getFaturamentoPin(): string | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== 'string' || !/^\d{4}$/.test(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setFaturamentoPin(pin: string): void {
  localStorage.setItem(KEY, JSON.stringify(pin));
}

export function clearFaturamentoPin(): void {
  localStorage.removeItem(KEY);
}

/** Após PIN correto: desbloqueia e inicia/reinicia a janela de inatividade. */
export function unlockResumoSession(): void {
  resumoUnlockUntil = Date.now() + RESUMO_IDLE_LOCK_MS;
}

/** Renova o temporizador enquanto o painel estiver desbloqueado (toques, scroll). */
export function touchResumoUnlockActivity(): void {
  if (resumoUnlockUntil > Date.now()) {
    resumoUnlockUntil = Date.now() + RESUMO_IDLE_LOCK_MS;
  }
}

export function isResumoUnlockSession(): boolean {
  return Date.now() < resumoUnlockUntil;
}

export function clearResumoUnlockSession(): void {
  resumoUnlockUntil = 0;
}

/** @deprecated use unlockResumoSession */
export function setResumoUnlockSession(value: boolean): void {
  if (value) unlockResumoSession();
  else clearResumoUnlockSession();
}
