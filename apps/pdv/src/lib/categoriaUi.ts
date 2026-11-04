import type { CSSProperties } from 'react';

const FALLBACK = '#6366f1';

export function normalizeCategoriaCor(cor?: string): string {
  const c = cor?.trim();
  if (!c || !/^#[0-9a-f]{3,8}$/i.test(c)) return FALLBACK;
  return c;
}

export function categoriaChipStyle(cor: string | undefined, active: boolean): CSSProperties {
  const hex = normalizeCategoriaCor(cor);
  if (active) {
    return { backgroundColor: hex, borderColor: hex };
  }
  return { borderColor: hex, backgroundColor: 'rgb(15 23 42)' };
}

export function produtoCategoriaStyle(cor: string | undefined): CSSProperties {
  const hex = normalizeCategoriaCor(cor);
  return {
    borderLeftWidth: 4,
    borderLeftStyle: 'solid',
    borderLeftColor: hex,
  };
}

/** Cores alternadas nos títulos de grupos de complemento (divisórias no modal). */
export const COMPLEMENTO_GRUPO_THEMES = [
  { title: 'text-cyan-300', headerBorder: 'border-cyan-500/45', panel: 'border-cyan-500/35 bg-cyan-950/35 border-l-cyan-400' },
  { title: 'text-amber-300', headerBorder: 'border-amber-500/45', panel: 'border-amber-500/35 bg-amber-950/30 border-l-amber-400' },
  { title: 'text-emerald-300', headerBorder: 'border-emerald-500/45', panel: 'border-emerald-500/35 bg-emerald-950/30 border-l-emerald-400' },
  { title: 'text-fuchsia-300', headerBorder: 'border-fuchsia-500/45', panel: 'border-fuchsia-500/35 bg-fuchsia-950/30 border-l-fuchsia-400' },
  { title: 'text-violet-300', headerBorder: 'border-violet-500/45', panel: 'border-violet-500/35 bg-violet-950/30 border-l-violet-400' },
  { title: 'text-rose-300', headerBorder: 'border-rose-500/45', panel: 'border-rose-500/35 bg-rose-950/30 border-l-rose-400' },
  { title: 'text-sky-300', headerBorder: 'border-sky-500/45', panel: 'border-sky-500/35 bg-sky-950/30 border-l-sky-400' },
  { title: 'text-lime-300', headerBorder: 'border-lime-500/45', panel: 'border-lime-500/35 bg-lime-950/25 border-l-lime-400' },
] as const;

export function complementoGrupoTheme(index: number) {
  return COMPLEMENTO_GRUPO_THEMES[index % COMPLEMENTO_GRUPO_THEMES.length];
}
