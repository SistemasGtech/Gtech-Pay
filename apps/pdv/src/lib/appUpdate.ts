import { Capacitor, registerPlugin } from '@capacitor/core';

export interface InstalledAppVersion {
  versionName: string;
  versionCode: number;
}

export interface PdvUpdateManifest {
  versionCode: number;
  versionName: string;
  apkUrl: string;
  notes?: string;
}

interface GtechAppUpdatePlugin {
  getInstalledVersion(): Promise<InstalledAppVersion>;
  fetchManifest(options: { url: string }): Promise<{ statusCode: number; body: string }>;
  downloadAndInstall(options: { url: string }): Promise<void>;
}

const GtechAppUpdate = registerPlugin<GtechAppUpdatePlugin>('GtechAppUpdate');

const MANIFEST_URL_STORAGE_KEY = 'gtech_pdv_update_manifest_url';

const FALLBACK_MANIFEST_URLS = [
  'https://sistemasgtech.github.io/Gtech-Pay/pdv-latest.json',
  'https://cdn.jsdelivr.net/gh/SistemasGtech/Gtech-Pay@main/docs/pdv-latest.json',
  'https://raw.githubusercontent.com/SistemasGtech/Gtech-Pay/main/docs/pdv-latest.json',
];

export function getSavedUpdateManifestUrl(): string | null {
  try {
    const v = localStorage.getItem(MANIFEST_URL_STORAGE_KEY)?.trim();
    return v || null;
  } catch {
    return null;
  }
}

export function setSavedUpdateManifestUrl(url: string | null): void {
  try {
    if (url?.trim()) {
      localStorage.setItem(MANIFEST_URL_STORAGE_KEY, url.trim());
    } else {
      localStorage.removeItem(MANIFEST_URL_STORAGE_KEY);
    }
  } catch {
    /* ignore */
  }
}

function supabaseConfig(): { url: string; anonKey: string } | null {
  const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
  const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();
  if (!url || !anonKey) return null;
  return { url: url.replace(/\/$/, ''), anonKey };
}

/** Onde o app busca a versão (para exibir na tela). */
export function getUpdateManifestUrl(): string {
  const saved = getSavedUpdateManifestUrl();
  if (saved) return saved;
  const fromEnv = import.meta.env.VITE_PDV_UPDATE_MANIFEST_URL as string | undefined;
  if (fromEnv?.trim()) return fromEnv.trim();
  const sb = supabaseConfig();
  if (sb) return `${sb.url}/rest/v1/rpc/pdv_get_app_update`;
  return FALLBACK_MANIFEST_URLS[0];
}

function parseManifestJson(raw: string): PdvUpdateManifest {
  let data: PdvUpdateManifest;
  try {
    data = JSON.parse(raw) as PdvUpdateManifest;
  } catch {
    throw new Error('Arquivo de atualização não é um JSON válido.');
  }
  if (data.versionCode == null || Number.isNaN(Number(data.versionCode)) || !data.apkUrl?.trim()) {
    throw new Error('JSON inválido: precisa de versionCode (número) e apkUrl.');
  }
  return {
    ...data,
    versionCode: Number(data.versionCode),
    apkUrl: data.apkUrl.trim(),
  };
}

async function fetchManifestHttpGet(url: string): Promise<PdvUpdateManifest> {
  if (Capacitor.getPlatform() === 'android') {
    const res = await GtechAppUpdate.fetchManifest({ url });
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw new Error(`HTTP ${res.statusCode}`);
    }
    return parseManifestJson(res.body);
  }
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return parseManifestJson(await res.text());
}

async function fetchManifestFromSupabase(): Promise<PdvUpdateManifest> {
  const cfg = supabaseConfig();
  if (!cfg) {
    throw new Error('Supabase não configurado neste build do APK.');
  }
  const url = `${cfg.url}/rest/v1/rpc/pdv_get_app_update`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: cfg.anonKey,
      Authorization: `Bearer ${cfg.anonKey}`,
    },
    body: '{}',
  });
  if (!res.ok) {
    throw new Error(`Supabase HTTP ${res.status}`);
  }
  return parseManifestJson(JSON.stringify(await res.json()));
}

export async function getInstalledAppVersion(): Promise<InstalledAppVersion | null> {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const v = await GtechAppUpdate.getInstalledVersion();
    return {
      versionName: v.versionName,
      versionCode: Number(v.versionCode),
    };
  } catch {
    return null;
  }
}

export async function fetchUpdateManifest(): Promise<PdvUpdateManifest> {
  const saved = getSavedUpdateManifestUrl();
  const fromEnv = (import.meta.env.VITE_PDV_UPDATE_MANIFEST_URL as string | undefined)?.trim();

  if (saved) {
    return fetchManifestHttpGet(saved);
  }
  if (fromEnv) {
    return fetchManifestHttpGet(fromEnv);
  }

  const errors: string[] = [];

  if (supabaseConfig()) {
    try {
      return await fetchManifestFromSupabase();
    } catch (e) {
      errors.push(
        `Supabase: ${e instanceof Error ? e.message : 'erro'}`,
      );
    }
  }

  for (const url of FALLBACK_MANIFEST_URLS) {
    try {
      return await fetchManifestHttpGet(url);
    } catch (e) {
      errors.push(`${url} → ${e instanceof Error ? e.message : 'erro'}`);
    }
  }

  throw new Error(
    `Não foi possível ler a versão publicada. ${errors.join(' | ')}. ` +
      'Publique docs/pdv-latest.json no GitHub (push na main) ou atualize a tabela pdv_app_release no Supabase.',
  );
}

export async function checkForAppUpdate(): Promise<{
  installed: InstalledAppVersion | null;
  manifest: PdvUpdateManifest | null;
  updateAvailable: boolean;
  error: string | null;
}> {
  const installed = await getInstalledAppVersion();
  if (!Capacitor.isNativePlatform()) {
    return { installed, manifest: null, updateAvailable: false, error: null };
  }
  try {
    const manifest = await fetchUpdateManifest();
    const localCode = installed?.versionCode ?? 0;
    return {
      installed,
      manifest,
      updateAvailable: manifest.versionCode > localCode,
      error: null,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erro ao verificar atualização.';
    return { installed, manifest: null, updateAvailable: false, error: message };
  }
}

export async function downloadAndInstallUpdate(apkUrl: string): Promise<void> {
  if (Capacitor.getPlatform() !== 'android') {
    throw new Error('Instalação automática só no app Android (APK).');
  }
  await GtechAppUpdate.downloadAndInstall({ url: apkUrl });
}
