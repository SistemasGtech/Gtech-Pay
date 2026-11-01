import type { SenhaConfig } from './types';

export const SENHA_STORAGE_KEY = 'gtech_senha_config';

export const DEFAULT_SENHA_CONFIG: SenhaConfig = {
  proximaSenha: 1,
  minimo: 1,
  maximo: 99,
  incrementoAutomatico: true,
  reiniciarACadaDia: true,
  ultimaDataOperacao: todayIsoDate(),
  controleAtivo: true,
};

export function todayIsoDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function loadSenhaConfig(): SenhaConfig {
  try {
    const raw = localStorage.getItem(SENHA_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SENHA_CONFIG };
    const parsed = JSON.parse(raw) as SenhaConfig;
    return { ...DEFAULT_SENHA_CONFIG, ...parsed };
  } catch {
    return { ...DEFAULT_SENHA_CONFIG };
  }
}

export function saveSenhaConfig(config: SenhaConfig): void {
  localStorage.setItem(SENHA_STORAGE_KEY, JSON.stringify(config));
}

/** Aplica reset diário se configurado */
export function applyDailyReset(config: SenhaConfig): SenhaConfig {
  if (!config.reiniciarACadaDia) return config;
  const hoje = todayIsoDate();
  if (config.ultimaDataOperacao === hoje) return config;
  return {
    ...config,
    proximaSenha: config.minimo,
    ultimaDataOperacao: hoje,
  };
}

export function formatSenha(num: number): string {
  return String(num).padStart(2, '0');
}

export function clampSenha(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export function isControleSenhaAtivo(config: SenhaConfig): boolean {
  return config.controleAtivo !== false;
}

/** Senha gravada na venda (vazio quando controle desligado) */
export function senhaParaVenda(config: SenhaConfig): string {
  if (!isControleSenhaAtivo(config)) return '';
  return peekSenhaAtual(config);
}

/** Senha usada na venda atual (não avança até confirmar) */
export function peekSenhaAtual(config: SenhaConfig): string {
  const cfg = applyDailyReset(config);
  return formatSenha(clampSenha(cfg.proximaSenha, cfg.minimo, cfg.maximo));
}

/** Após venda confirmada */
export function advanceSenhaAfterSale(config: SenhaConfig): SenhaConfig {
  if (!isControleSenhaAtivo(config)) return config;
  let cfg = applyDailyReset(config);
  const hoje = todayIsoDate();
  if (!cfg.incrementoAutomatico) {
    return { ...cfg, ultimaDataOperacao: hoje };
  }
  let next = cfg.proximaSenha + 1;
  if (next > cfg.maximo) next = cfg.minimo;
  return {
    ...cfg,
    proximaSenha: next,
    ultimaDataOperacao: hoje,
  };
}

export function setProximaSenha(config: SenhaConfig, value: number): SenhaConfig {
  return {
    ...config,
    proximaSenha: clampSenha(value, config.minimo, config.maximo),
    ultimaDataOperacao: todayIsoDate(),
  };
}

export function resetSenhaCounter(config: SenhaConfig, toMin = true): SenhaConfig {
  return {
    ...config,
    proximaSenha: toMin ? config.minimo : config.proximaSenha,
    ultimaDataOperacao: todayIsoDate(),
  };
}
