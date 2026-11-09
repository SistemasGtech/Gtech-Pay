import { useCallback, useEffect, useRef, useState } from 'react';
import type { Categoria, Complemento, LojaInfo, Produto, Venda } from '@gtech/shared';
import {
  deleteVenda,
  loadCategorias,
  loadComplementos,
  loadLoja,
  loadProdutos,
  loadVendas,
  saveCategorias,
  saveComplementos,
  saveLoja,
  saveProdutos,
} from '@gtech/shared';
import { traduzirErro } from './lib/mensagensPt';
import { getSession, isSupabaseEnabled, signOut } from './lib/authSupabase';
import {
  deleteVendaRemote,
  fetchDashboardData,
  saveCategoriasRemote,
  saveComplementosRemote,
  saveLojaRemote,
  saveProdutosRemote,
} from './lib/supabaseApi';
import { OverviewPage } from './pages/OverviewPage';
import { CategoriasPage } from './pages/CategoriasPage';
import { ComplementosPage } from './pages/ComplementosPage';
import { ProdutosPage } from './pages/ProdutosPage';
import { VendasPage } from './pages/VendasPage';
import { LojaPage } from './pages/LojaPage';
import { LoginPage } from './pages/LoginPage';
import { UsuariosPage } from './pages/UsuariosPage';

type Nav = 'overview' | 'usuarios' | 'categorias' | 'complementos' | 'produtos' | 'vendas' | 'loja';

/** Intervalo de sincronização com a nuvem / localStorage (vendas do PDV). */
const AUTO_SYNC_MS = 30_000;

const NAV: { id: Nav; label: string }[] = [
  { id: 'overview', label: 'Visão geral' },
  { id: 'usuarios', label: 'Usuários' },
  { id: 'categorias', label: 'Categorias' },
  { id: 'produtos', label: 'Itens' },
  { id: 'complementos', label: 'Complementos' },
  { id: 'vendas', label: 'Histórico' },
  { id: 'loja', label: 'Loja' },
];

function App() {
  const [authed, setAuthed] = useState(false);
  const [booting, setBooting] = useState(isSupabaseEnabled);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [nav, setNav] = useState<Nav>('overview');
  const [toast, setToast] = useState('');

  const [loja, setLoja] = useState<LojaInfo>(() => loadLoja());
  const [categorias, setCategorias] = useState<Categoria[]>(() => loadCategorias());
  const [complementos, setComplementos] = useState<Complemento[]>(() => loadComplementos());
  const [produtos, setProdutos] = useState<Produto[]>(() => loadProdutos());
  const [vendas, setVendas] = useState<Venda[]>(() => loadVendas());
  const [ultimaSync, setUltimaSync] = useState<Date | null>(null);
  const syncEmAndamento = useRef(false);

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  const loadAll = useCallback(async () => {
    if (isSupabaseEnabled) {
      const d = await fetchDashboardData();
      setStoreId(d.storeId);
      setLoja(d.loja);
      setCategorias(d.categorias);
      setComplementos(d.complementos);
      setProdutos(d.produtos);
      setVendas(d.vendas);
      return;
    }
    setLoja(loadLoja());
    setCategorias(loadCategorias());
    setComplementos(loadComplementos());
    setProdutos(loadProdutos());
    setVendas(loadVendas());
  }, []);

  useEffect(() => {
    if (!isSupabaseEnabled) {
      setBooting(false);
      return;
    }
    getSession()
      .then(async (session) => {
        if (session) {
          setAuthed(true);
          await loadAll();
          setUltimaSync(new Date());
        }
      })
      .finally(() => setBooting(false));
  }, [loadAll]);

  const syncSilently = useCallback(async () => {
    if (!authed || syncEmAndamento.current) return;
    syncEmAndamento.current = true;
    try {
      await loadAll();
      setUltimaSync(new Date());
    } catch {
      /* falha pontual — próximo ciclo tenta de novo */
    } finally {
      syncEmAndamento.current = false;
    }
  }, [authed, loadAll]);

  useEffect(() => {
    if (!authed) return;
    const id = window.setInterval(() => {
      void syncSilently();
    }, AUTO_SYNC_MS);
    return () => window.clearInterval(id);
  }, [authed, syncSilently]);

  useEffect(() => {
    if (!authed) return;
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void syncSilently();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [authed, syncSilently]);

  const refreshVendas = useCallback(async () => {
    await syncSilently();
  }, [syncSilently]);

  const persist = async (label: string, local: () => void, remote?: () => Promise<void>) => {
    local();
    if (isSupabaseEnabled && storeId && remote) {
      try {
        await remote();
        notify(`${label} (nuvem)`);
      } catch (e) {
        notify(traduzirErro(e instanceof Error ? e.message : 'Erro ao salvar na nuvem'));
      }
    } else {
      notify(label);
    }
  };

  if (booting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-400 text-sm">Conectando…</div>
    );
  }

  if (!authed) {
    return (
      <LoginPage
        onSuccess={async () => {
          setAuthed(true);
          try {
            await loadAll();
            setUltimaSync(new Date());
          } catch (e) {
            notify(traduzirErro(e instanceof Error ? e.message : 'Erro ao carregar dados'));
          }
        }}
      />
    );
  }

  return (
    <div className="min-h-screen flex bg-slate-950">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white text-sm font-bold px-4 py-2 rounded-xl shadow-lg">
          {toast}
        </div>
      )}

      <aside className="w-56 shrink-0 border-r border-slate-800 bg-slate-900 hidden md:flex flex-col">
        <div className="p-4 border-b border-slate-800">
          <p className="text-[10px] font-black text-indigo-400 uppercase">Painel Gtech Pay</p>
          <p className="text-xs text-slate-400 truncate">{loja.nome}</p>
          <p className="text-[10px] text-slate-600 mt-2" title="Catálogo e vendas atualizam automaticamente a cada 30s">
            {ultimaSync
              ? `Sync ${ultimaSync.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
              : 'Sincronizando…'}
          </p>
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setNav(item.id)}
              className={`w-full text-left px-3 py-2 rounded-xl text-sm font-bold ${
                nav === item.id ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              {item.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => { signOut(); setAuthed(false); }}
            className="w-full py-2 text-xs font-bold text-red-400 border border-red-500/30 rounded-xl mt-1"
          >
            Sair
          </button>
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden flex gap-1 p-2 border-b border-slate-800 overflow-x-auto custom-scroll">
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setNav(item.id)}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold ${
                nav === item.id ? 'bg-indigo-600' : 'bg-slate-800'
              }`}
            >
              {item.label}
            </button>
          ))}
        </header>

        <main className="flex-1 p-4 md:p-8 overflow-y-auto custom-scroll">
          {nav === 'overview' && <OverviewPage vendas={vendas} />}
          {nav === 'usuarios' && (
            <UsuariosPage storeId={storeId} cloud={isSupabaseEnabled} onNotify={notify} />
          )}
          {nav === 'categorias' && (
            <CategoriasPage
              categorias={categorias}
              onSave={(list) => {
                void persist('Categorias salvas', () => {
                  setCategorias(list);
                  saveCategorias(list);
                }, () => saveCategoriasRemote(storeId!, list));
              }}
            />
          )}
          {nav === 'complementos' && (
            <ComplementosPage
              complementos={complementos}
              onSave={(list) => {
                void persist('Complementos salvos', () => {
                  setComplementos(list);
                  saveComplementos(list);
                }, () => saveComplementosRemote(storeId!, list));
              }}
            />
          )}
          {nav === 'produtos' && (
            <ProdutosPage
              produtos={produtos}
              categorias={categorias}
              complementos={complementos}
              onSave={(list) => {
                void persist('Itens salvos', () => {
                  setProdutos(list);
                  saveProdutos(list);
                }, () => saveProdutosRemote(storeId!, list));
              }}
            />
          )}
          {nav === 'vendas' && (
            <VendasPage
              vendas={vendas}
              produtos={produtos}
              categorias={categorias}
              complementos={complementos}
              onChange={() => void refreshVendas()}
              onDelete={async (id) => {
                if (isSupabaseEnabled) await deleteVendaRemote(id);
                else deleteVenda(id);
                await refreshVendas();
              }}
            />
          )}
          {nav === 'loja' && (
            <LojaPage
              loja={loja}
              storeId={storeId}
              cloud={isSupabaseEnabled}
              onSave={(l) => {
                void persist('Dados da loja salvos', () => {
                  setLoja(l);
                  saveLoja(l);
                }, () => saveLojaRemote(storeId!, l));
              }}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
