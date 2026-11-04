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
