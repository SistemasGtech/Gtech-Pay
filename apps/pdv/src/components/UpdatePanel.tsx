import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import {
  checkForAppUpdate,
  downloadAndInstallUpdate,
  getUpdateManifestUrl,
  setSavedUpdateManifestUrl,
  type PdvUpdateManifest,
} from '../lib/appUpdate';

export function UpdateSettingsPanel() {
  const native = Capacitor.isNativePlatform();
  const [installedName, setInstalledName] = useState('—');
  const [installedCode, setInstalledCode] = useState<number | null>(null);
  const [manifest, setManifest] = useState<PdvUpdateManifest | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [manifestUrlDraft, setManifestUrlDraft] = useState(() => getUpdateManifestUrl());

  const refresh = async () => {
    setLoading(true);
    setMsg('');
    setErrorDetail(null);
    try {
      const check = await checkForAppUpdate();
      if (check.installed) {
        setInstalledName(check.installed.versionName);
        setInstalledCode(check.installed.versionCode);
      } else if (native) {
        setInstalledName('—');
        setInstalledCode(null);
        setErrorDetail(
          'Não leu a versão deste APK. Instale um build recente (com atualização in-app) se acabou de adicionar esta função.',
        );
      }
      setManifest(check.manifest);
      setUpdateAvailable(check.updateAvailable);
      if (check.error) {
        setErrorDetail(check.error);
        setMsg('Não foi possível buscar a lista de versões.');
      } else if (!native) {
        setMsg('No tablet use o APK instalado. No PC esta tela só consulta versões.');
      } else if (!check.manifest) {
        setMsg('Sem resposta do servidor de atualização.');
      } else if (!check.updateAvailable) {
        setMsg('Você já está na versão mais recente publicada (ou o JSON tem o mesmo versionCode).');
      } else {
        setMsg(`Nova versão ${check.manifest.versionName} disponível.`);
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Erro ao verificar.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const salvarUrlManifest = () => {
    const trimmed = manifestUrlDraft.trim();
    if (!trimmed) {
      setSavedUpdateManifestUrl(null);
      setManifestUrlDraft(getUpdateManifestUrl());
    } else {
      setSavedUpdateManifestUrl(trimmed);
    }
    void refresh();
  };

  const instalar = async () => {
    if (!manifest?.apkUrl) return;
    setLoading(true);
    setMsg('Baixando APK… Aceite instalar quando o Android pedir.');
    setErrorDetail(null);
    try {
      await downloadAndInstallUpdate(manifest.apkUrl);
      setMsg('Instalador aberto. Toque em Instalar e substitua o app.');
    } catch (e) {
      const text = e instanceof Error ? e.message : 'Falha no download.';
      setMsg(text);
      setErrorDetail(
        'Confira se o link apkUrl no JSON aponta para um APK público (ex.: GitHub Releases). HTTP 404 = release ainda não criada ou nome do arquivo errado.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4 pb-16">
      <div className="bg-slate-800 border border-slate-700 rounded-3xl p-5 space-y-2">
        <h2 className="text-lg font-black">Atualizar PDV</h2>
        <p className="text-xs text-slate-400 leading-relaxed">
          Verifica uma versão nova na internet e instala o APK no tablet (sem Play Store).
        </p>
        <p className="text-[10px] text-slate-500 break-all">Em uso: {getUpdateManifestUrl()}</p>
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 space-y-2 text-sm">
        <p>
          <span className="text-slate-400">Instalada:</span>{' '}
          <strong>
            {installedName}
            {installedCode != null ? ` (${installedCode})` : ''}
          </strong>
        </p>
        {manifest && (
          <p>
            <span className="text-slate-400">Publicada:</span>{' '}
            <strong>
              {manifest.versionName} ({manifest.versionCode})
            </strong>
          </p>
        )}
        {manifest?.notes && (
          <p className="text-xs text-slate-300 whitespace-pre-wrap">{manifest.notes}</p>
        )}
      </div>

      <div className="bg-slate-900/80 border border-slate-700 rounded-2xl p-4 space-y-2">
        <p className="text-[10px] font-black uppercase text-slate-400">URL do JSON (opcional)</p>
        <input
          value={manifestUrlDraft}
          onChange={(e) => setManifestUrlDraft(e.target.value)}
          placeholder="https://…/pdv-latest.json"
          className="w-full bg-slate-950 border border-slate-600 rounded-xl px-3 py-2 text-xs"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={salvarUrlManifest}
            className="flex-1 py-2 rounded-xl bg-slate-700 text-xs font-bold"
          >
            Salvar URL e verificar
          </button>
          <button
            type="button"
            onClick={() => {
              setSavedUpdateManifestUrl(null);
              setManifestUrlDraft(getUpdateManifestUrl());
            }}
            className="px-3 py-2 rounded-xl border border-slate-600 text-[10px] font-bold"
          >
            Padrão
          </button>
        </div>
        <p className="text-[10px] text-slate-500 leading-snug">
          Por padrão o app consulta o <strong className="text-slate-400">Supabase</strong> (mesma conexão do
          PDV). O link do GitHub Pages só funciona depois do deploy do dashboard. Use o campo acima só se quiser
          outro JSON público (URL direta).
        </p>
      </div>

      {msg && (
        <p className={`text-xs ${updateAvailable ? 'text-amber-400' : 'text-slate-300'}`}>{msg}</p>
      )}
      {errorDetail && <p className="text-[11px] text-red-400/90 leading-snug">{errorDetail}</p>}

      <div className="flex flex-col gap-2">
        <button
          type="button"
          disabled={loading}
          onClick={() => void refresh()}
          className="w-full py-3 bg-slate-700 hover:bg-slate-600 rounded-2xl font-bold text-sm disabled:opacity-50"
        >
          {loading ? 'Verificando…' : 'Verificar atualização'}
        </button>
        {updateAvailable && manifest && (
          <button
            type="button"
            disabled={loading || !native}
            onClick={() => void instalar()}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 rounded-2xl font-black text-sm disabled:opacity-50"
          >
            Baixar e instalar {manifest.versionName}
          </button>
        )}
      </div>

      {!native && (
        <p className="text-[11px] text-slate-500">
          Para testar instalação, abra esta aba no APK do tablet com internet.
        </p>
      )}
    </div>
  );
}
