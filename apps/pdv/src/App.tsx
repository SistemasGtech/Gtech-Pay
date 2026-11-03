import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  Categoria,
  Complemento,
  FormaPagamento,
  ItemCarrinho,
  LojaInfo,
  Operador,
  Produto,
  SenhaConfig,
  Venda,
} from '@gtech/shared';
import { advanceSenhaAfterSale, saveSenhaConfig, setProximaSenha, applyDailyReset, isControleSenhaAtivo, senhaParaVenda } from '@gtech/shared';
import {
  CATEGORIAS_PADRAO,
  loadComplementos,
  loadLoja,
  loadVendas,
  OPERADORES_PADRAO,
  persistVenda,
  PRODUTOS_PADRAO,
  removeVenda,
} from './data/defaults';
import { PrinterSettingsPanel, usePrinterState } from './components/PrinterPanel';
import { UpdateSettingsPanel } from './components/UpdatePanel';
import { SenhaSettingsPanel, useSenhaState } from './components/SenhaPanel';
import { ComplementoItemModal, gruposComplementoDoProduto } from './components/ComplementoItemModal';
import {
  fetchPdvBootstrap,
  formatPdvError,
  getConfiguredStoreId,
  isPdvCloudEnabled,
  normalizeStoreId,
  saveConfiguredStoreId,
  syncSenhaConfigRemote,
  verifyOperadorPin,
  PDV_STORE_ID_KEY,
} from './lib/pdvApi';
import {
  addPendingSale,
  countPendingSales,
  isOnline,
  clearPdvSession,
  loadOperadorPinCache,
  loadPdvSession,
  loadSnapshot,
  mergeVendasForDisplay,
  saveOperadorPin,
  savePdvSession,
  saveSnapshot,
  verifyOperadorPinLocal,
} from './lib/offlineStore';
import { syncPendingSales } from './lib/syncSales';
import { imprimirVenda } from './services/printService';

type Tab = 'vendas' | 'recibos' | 'senha' | 'impressora' | 'atualizar';
type EtapaVenda = 'pedido' | 'pagamento';

function App() {
  const [storeId, setStoreId] = useState<string | null>(() =>
    isPdvCloudEnabled ? getConfiguredStoreId() : null,
  );
  const [needsSetup, setNeedsSetup] = useState(isPdvCloudEnabled && !getConfiguredStoreId());
  const [setupInput, setSetupInput] = useState('');
  const [bootLoading, setBootLoading] = useState(isPdvCloudEnabled && Boolean(getConfiguredStoreId()));
  const [bootError, setBootError] = useState('');
  const [cloudReady, setCloudReady] = useState(false);

  const [usuario, setUsuario] = useState<Operador | null>(null);
  const [operadores, setOperadores] = useState<Operador[]>(OPERADORES_PADRAO);
  const [produtos, setProdutos] = useState<Produto[]>(PRODUTOS_PADRAO);
  const [categorias, setCategorias] = useState<Categoria[]>(CATEGORIAS_PADRAO);
  const [complementos, setComplementos] = useState<Complemento[]>(() =>
    isPdvCloudEnabled ? [] : loadComplementos(),
  );
  const [loja, setLoja] = useState<LojaInfo>(loadLoja);
  const [itemModal, setItemModal] = useState<Produto | null>(null);

  const [tab, setTab] = useState<Tab>('vendas');
  const [pinOp, setPinOp] = useState<Operador | null>(null);
  const [pin, setPin] = useState('');
  const [erroLogin, setErroLogin] = useState('');
  const [pinChecking, setPinChecking] = useState(false);

  const { senhaConfig, setSenhaConfig, senhaAtual } = useSenhaState();
  const controleSenhaAtivo = isControleSenhaAtivo(senhaConfig);
  const { printerConfig, setPrinterConfig } = usePrinterState();

  const [categoriaId, setCategoriaId] = useState('todas');
  const [busca, setBusca] = useState('');
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
  const [cliente, setCliente] = useState('');
  const [pagamento, setPagamento] = useState<FormaPagamento>('PIX');
  const [valorRecebido, setValorRecebido] = useState('');
  const [vendas, setVendas] = useState<Venda[]>(() => loadVendas());
  const [ultimaVenda, setUltimaVenda] = useState<Venda | null>(null);
  const [toast, setToast] = useState('');
  const [etapaVenda, setEtapaVenda] = useState<EtapaVenda>('pedido');
  const [pendingCount, setPendingCount] = useState(() =>
    isPdvCloudEnabled ? countPendingSales() : 0,
  );
  const [syncing, setSyncing] = useState(false);

  const senhaConfigRef = useRef(senhaConfig);
  senhaConfigRef.current = senhaConfig;
  const syncingRef = useRef(false);
  const storeIdRef = useRef(storeId);
  storeIdRef.current = storeId;

  const produtosFiltrados = useMemo(() => {
    return produtos.filter((p) => {
      if (!p.ativo) return false;
      if (categoriaId !== 'todas' && String(p.categoriaId) !== categoriaId) return false;
      if (busca && !p.nome.toLowerCase().includes(busca.toLowerCase())) return false;
      return true;
    });
  }, [produtos, categoriaId, busca]);

  const total = useMemo(() => carrinho.reduce((s, i) => s + i.subtotal, 0), [carrinho]);
  const troco = useMemo(() => {
    if (pagamento !== 'Dinheiro') return 0;
    return Math.max(0, (parseFloat(valorRecebido) || 0) - total);
  }, [pagamento, valorRecebido, total]);

  const notify = (t: string) => {
    setToast(t);
    setTimeout(() => setToast(''), 2500);
  };

  const pushSenhaConfig = useCallback(
    (c: SenhaConfig) => {
      setSenhaConfig(c);
      saveSenhaConfig(c);
      if (isPdvCloudEnabled && storeId && isOnline()) {
        void syncSenhaConfigRemote(storeId, c).catch((e) => {
          notify(e instanceof Error ? e.message : 'Erro ao sincronizar senha');
        });
      }
    },
    [setSenhaConfig, storeId],
  );

  const applyBootstrap = useCallback(
    (data: Awaited<ReturnType<typeof fetchPdvBootstrap>>, sid: string) => {
      setLoja(data.loja);
      setOperadores(data.operadores);
      setCategorias(data.categorias);
      setComplementos(data.complementos);
      setProdutos(data.produtos);
      setSenhaConfig(data.senhaConfig);
      saveSenhaConfig(data.senhaConfig);
      setVendas(mergeVendasForDisplay(data.vendas, loadVendas()));
      setStoreId(sid);
      setNeedsSetup(false);
      setCloudReady(true);
      setPendingCount(countPendingSales());
    },
    [setSenhaConfig],
  );

  const runSync = useCallback(async (silent = false, sid?: string) => {
    const effectiveStoreId = sid ?? storeIdRef.current;
    if (!isPdvCloudEnabled || !effectiveStoreId || syncingRef.current) return;
    if (!isOnline()) {
      if (!silent) notify('Sem internet para sincronizar');
      return;
    }
    syncingRef.current = true;
    setSyncing(true);
    try {
      const result = await syncPendingSales(
        effectiveStoreId,
        applyDailyReset(senhaConfigRef.current),
      );
      setPendingCount(result.remaining);
      if (result.synced > 0 && !silent) {
        notify(
          result.remaining
            ? `${result.synced} venda(s) enviada(s). ${result.remaining} pendente(s).`
            : `${result.synced} venda(s) sincronizada(s)!`,
        );
      } else if (result.failed > 0 && !silent) {
        notify(result.lastError ?? 'Falha ao sincronizar');
      }
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, []);

  const loadFromCache = useCallback(
    (sid: string) => {
      const snap = loadSnapshot(sid);
      if (!snap) {
        setBootError('Sem dados no tablet. Conecte à internet uma vez para baixar a loja.');
        setCloudReady(false);
        return false;
      }
      applyBootstrap(snap.bootstrap, sid);
      setVendas(loadVendas());
      setBootError('');
      return true;
    },
    [applyBootstrap],
  );

  const loadCloud = useCallback(
    async (sid: string, options?: { background?: boolean }) => {
      const normalized = normalizeStoreId(sid);
      if (!normalized) {
        setBootError('ID da loja inválido. Copie o UUID completo no dashboard → Loja.');
        setBootLoading(false);
        return;
      }

      const background = options?.background;
      if (!background) {
        setBootLoading(true);
        setCloudReady(false);
      }
      setBootError('');
      try {
        saveConfiguredStoreId(normalized);
        const data = await fetchPdvBootstrap(normalized);
        saveSnapshot(normalized, data);
        applyBootstrap(data, normalized);
        void runSync(true, normalized);
      } catch (e) {
        if (loadFromCache(normalized)) {
          if (!background) notify('Modo offline — usando dados salvos no tablet');
        } else {
          setBootError(formatPdvError(e));
          setCloudReady(false);
        }
      } finally {
        if (!background) setBootLoading(false);
      }
    },
    [applyBootstrap, loadFromCache, runSync],
  );

  const loadCloudRef = useRef(loadCloud);
  loadCloudRef.current = loadCloud;
  const runSyncRef = useRef(runSync);
  runSyncRef.current = runSync;
  const bootstrappedRef = useRef(false);

  useEffect(() => {
    if (!isPdvCloudEnabled || bootstrappedRef.current) return;
    bootstrappedRef.current = true;
    const sid = getConfiguredStoreId();
    if (!sid) {
      setNeedsSetup(true);
      setBootLoading(false);
      return;
    }
    if (isOnline()) void loadCloudRef.current(sid);
    else {
      setBootLoading(true);
      loadFromCache(sid);
      setBootLoading(false);
    }
  }, [loadFromCache]);

  useEffect(() => {
    if (needsSetup || bootLoading) return;
    const sid = storeId ?? (isPdvCloudEnabled ? getConfiguredStoreId() : null);
    if (isPdvCloudEnabled && !sid) return;
    const session = loadPdvSession();
    if (!session) return;
    if (isPdvCloudEnabled && session.storeId !== sid) return;
    const op = operadores.find((o) => o.id === session.operadorId);
    if (op) setUsuario(op);
  }, [needsSetup, bootLoading, storeId, operadores]);

  useEffect(() => {
    if (!isPdvCloudEnabled) return;
    const onOnline = () => {
      const sid = storeIdRef.current ?? getConfiguredStoreId();
      if (!sid) return;
      void loadCloudRef.current(sid, { background: true }).then(() => runSyncRef.current(true, sid));
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, []);

  const newCarrinhoItemId = () => (isPdvCloudEnabled ? crypto.randomUUID() : String(Date.now() + Math.random()));

  const addItemAoCarrinho = (item: ItemCarrinho) => {
    setCarrinho((c) => [...c, item]);
    notify(`${item.quantidade}x ${item.nome} adicionado`);
    setItemModal(null);
  };

  const handleProdutoClick = (prod: Produto) => {
    const grupos = gruposComplementoDoProduto(prod, complementos);
    if (grupos.length === 0) {
      addItemAoCarrinho({
        carrinhoItemId: newCarrinhoItemId(),
        produtoId: prod.id,
        nome: prod.nome,
        precoBase: prod.preco,
        precoUnitario: prod.preco,
        quantidade: 1,
        subtotal: prod.preco,
        opcoes: [],
        observacao: '',
      });
      return;
    }
    setItemModal(prod);
  };

  const avancarSenhaPosVenda = useCallback(() => {
    setSenhaConfig((prev) => {
      const next = advanceSenhaAfterSale(prev);
      saveSenhaConfig(next);
      if (isPdvCloudEnabled && storeId && isOnline()) {
        void syncSenhaConfigRemote(storeId, next).catch(() => {
          /* senha vai na fila junto com vendas ao sincronizar */
        });
      }
      return next;
    });
  }, [setSenhaConfig, storeId]);

  const finalizar = async (opts?: { valorRecebidoDinheiro?: number }) => {
    if (!carrinho.length || !usuario) return;
    const recebidoDinheiro =
      opts?.valorRecebidoDinheiro ?? (parseFloat(valorRecebido) || 0);
    if (pagamento === 'Dinheiro' && recebidoDinheiro < total) {
      notify('Valor recebido insuficiente');
      return;
    }

    const senha = senhaParaVenda(applyDailyReset(senhaConfig));
    const agora = new Date();
    const trocoVenda =
      pagamento === 'Dinheiro' ? Math.max(0, recebidoDinheiro - total) : 0;
    const venda: Venda = {
      id: isPdvCloudEnabled ? crypto.randomUUID() : String(Date.now()),
      timestamp: Date.now(),
      senha,
      comanda: senha,
      cliente: cliente.trim() || 'Cliente Balcão',
      data: agora.toLocaleDateString('pt-BR'),
      hora: agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      pagamento,
      valorRecebido: pagamento === 'Dinheiro' ? recebidoDinheiro : total,
      troco: trocoVenda,
      itens: [...carrinho],
      total,
      operadorId: usuario.id,
      operadorNome: usuario.nome,
    };

    setVendas(persistVenda(venda));
    avancarSenhaPosVenda();

    if (isPdvCloudEnabled && storeId) {
      addPendingSale(venda);
      setPendingCount(countPendingSales());
      if (isOnline()) {
        const result = await syncPendingSales(
          storeId,
          advanceSenhaAfterSale(applyDailyReset(senhaConfig)),
        );
        setPendingCount(result.remaining);
      } else {
        notify('Venda salva offline. Envia quando a internet voltar.');
      }
    }

    setUltimaVenda(venda);
    setCarrinho([]);
    setCliente('');
    setValorRecebido('');
    setPagamento('PIX');
    setEtapaVenda('pedido');
    if (!isPdvCloudEnabled || isOnline()) {
      notify(senha ? `Venda #${senha} registrada` : 'Venda registrada');
    }

    if (printerConfig.imprimirAutomatico) {
      try {
        await imprimirVenda(venda, loja, printerConfig);
      } catch (e) {
        notify(e instanceof Error ? e.message : 'Erro ao imprimir');
      }
    }
  };

  const finishLogin = (op: Operador, pinCode: string, saveForTablet: boolean) => {
    if (saveForTablet) {
      saveOperadorPin(op.id, pinCode);
      const sid = storeId ?? getConfiguredStoreId();
      if (sid) savePdvSession(sid, op.id);
      notify('PIN salvo — próxima vez entra direto neste tablet');
    }
    setUsuario(op);
    setPinOp(null);
    setPin('');
    setErroLogin('');
  };

  const submitPin = (pinCode: string, saveForTablet: boolean) => {
    if (!pinOp || pinCode.length !== 4 || pinChecking) return;
    if (isPdvCloudEnabled && storeId) {
      setPinChecking(true);
      if (isOnline()) {
        void verifyOperadorPin(storeId, pinOp.id, pinCode)
          .then((op) => finishLogin(op, pinCode, saveForTablet))
          .catch((e) => {
            setErroLogin(formatPdvError(e).includes('PIN') ? 'PIN incorreto' : formatPdvError(e));
            setPin('');
          })
          .finally(() => setPinChecking(false));
      } else if (verifyOperadorPinLocal(pinOp.id, pinCode)) {
        finishLogin({ ...pinOp, pin: pinCode }, pinCode, saveForTablet);
        setPinChecking(false);
      } else {
        setErroLogin(
          loadOperadorPinCache()[pinOp.id]
            ? 'PIN incorreto'
            : saveForTablet
              ? 'Conecte à internet uma vez para validar e salvar o PIN.'
              : 'Offline: use Salvar PIN após login com internet, ou PIN já salvo.',
        );
        setPin('');
        setPinChecking(false);
      }
      return;
    }
    if (pinOp.pin === pinCode) {
      if (saveForTablet) notify('PIN salvo neste tablet');
      setUsuario(pinOp);
      setPinOp(null);
      setPin('');
      setErroLogin('');
    } else {
      setErroLogin('PIN incorreto');
      setPin('');
    }
  };

  const pressPin = (n: string) => {
    if (!pinOp || pin.length >= 4 || pinChecking) return;
    setPin((p) => p + n);
  };

  const entrarComPin = () => {
    if (pin.length !== 4) {
      setErroLogin('Digite os 4 dígitos do PIN');
      return;
    }
    submitPin(pin, false);
  };

  const salvarPinEEntrar = () => {
    if (pin.length !== 4) {
      setErroLogin('Digite os 4 dígitos do PIN');
      return;
    }
    submitPin(pin, true);
  };

  if (needsSetup) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
          <div className="text-center">
            <p className="text-indigo-400 text-[11px] font-black uppercase">Gtech PDV</p>
            <h1 className="font-black text-lg uppercase">Conectar loja</h1>
            <p className="text-xs text-slate-400 mt-2">
              Cole o ID da loja copiado no dashboard (menu Loja).
            </p>
          </div>
          <input
            value={setupInput}
            onChange={(e) => setSetupInput(e.target.value)}
            placeholder="UUID da loja"
            className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs font-mono"
          />
          {bootError && <p className="text-red-400 text-xs text-center font-bold">{bootError}</p>}
          {!isPdvCloudEnabled && (
            <p className="text-amber-400 text-xs text-center font-bold">
              Supabase não configurado. Crie <code className="text-amber-200">apps/pdv/.env.local</code> e reinicie{' '}
              <code className="text-amber-200">npm run pdv</code>.
            </p>
          )}
          <button
            type="button"
            disabled={!normalizeStoreId(setupInput) || bootLoading || !isPdvCloudEnabled}
            onClick={() => void loadCloud(setupInput)}
            className="w-full py-3 rounded-2xl bg-indigo-600 disabled:bg-slate-700 font-black text-xs uppercase"
          >
            {bootLoading ? 'Conectando…' : 'Salvar e carregar'}
          </button>
        </div>
      </div>
    );
  }

  if (bootLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-sm font-bold text-slate-400">
        Carregando dados da loja…
      </div>
    );
  }

  if (bootError && isPdvCloudEnabled) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950">
        <div className="max-w-md text-center space-y-3">
          <p className="text-red-400 font-bold text-sm">{bootError}</p>
          <button
            type="button"
            onClick={() => {
              setNeedsSetup(true);
              setBootError('');
            }}
            className="px-4 py-2 bg-slate-800 rounded-xl text-xs font-bold"
          >
            Reconfigurar ID da loja
          </button>
        </div>
      </div>
    );
  }

  if (!usuario) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
          <div className="text-center">
            <p className="text-indigo-400 text-[11px] font-black uppercase">Gtech PDV</p>
            <h1 className="font-black text-lg uppercase">{loja.nome}</h1>
            {isPdvCloudEnabled && (
              <p className="text-[10px] text-emerald-400 font-bold mt-1">Conectado à nuvem</p>
            )}
          </div>
          {erroLogin && <p className="text-red-400 text-xs text-center font-bold">{erroLogin}</p>}
          {!pinOp ? (
            <div className="space-y-2">
              {isPdvCloudEnabled && storeId && cloudReady && operadores.length === 0 ? (
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/40 space-y-3 text-center">
                  <p className="text-sm font-black text-amber-200">Loja conectada, mas sem operadores</p>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    No <strong>dashboard</strong> (login com e-mail na nuvem), vá em <strong>Operadores</strong>, crie
                    um operador com <strong>PIN de 4 dígitos</strong> e salve. Depois toque em Atualizar aqui.
                  </p>
                  <button
                    type="button"
                    onClick={() => void loadCloud(storeId)}
                    disabled={bootLoading}
                    className="w-full py-2.5 bg-indigo-600 rounded-xl text-xs font-bold disabled:opacity-50"
                  >
                    {bootLoading ? 'Atualizando…' : 'Atualizar lista de operadores'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      localStorage.removeItem(PDV_STORE_ID_KEY);
                      setStoreId(null);
                      setCloudReady(false);
                      setNeedsSetup(true);
                      setSetupInput('');
                    }}
                    className="text-[11px] text-slate-500 font-bold"
                  >
                    Trocar ID da loja
                  </button>
                </div>
              ) : (
                operadores.map((op) => (
                  <button
                    key={op.id}
                    type="button"
                    onClick={() => {
                      setPinOp(op);
                      setErroLogin('');
                    }}
                    className="w-full flex items-center gap-3 p-3 rounded-2xl bg-slate-800 border border-slate-700"
                  >
                    <span
                      className="w-10 h-10 rounded-xl font-black text-xs flex items-center justify-center text-white"
                      style={{ backgroundColor: op.cor }}
                    >
                      {op.iniciais}
                    </span>
                    <span className="font-bold text-sm">{op.nome}</span>
                  </button>
                ))
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-center text-sm font-bold">{pinOp.nome}</p>
              <p className="text-center text-[10px] font-bold uppercase text-slate-500 tracking-wide">Digite seu PIN</p>
              <div className="flex justify-center gap-2.5 py-1" aria-label={`PIN ${pin.length} de 4 dígitos`}>
                {[0, 1, 2, 3].map((i) => {
                  const filled = pin.length > i;
                  return (
                    <div
                      key={i}
                      className={`w-12 h-14 rounded-xl border-2 flex items-center justify-center transition-all ${
                        filled
                          ? 'border-indigo-500 bg-indigo-500/25 shadow-[0_0_12px_rgba(99,102,241,0.35)]'
                          : 'border-slate-600 bg-slate-950'
                      }`}
                    >
                      <span
                        className={`text-2xl font-black leading-none ${
                          filled ? 'text-indigo-300' : 'text-slate-700'
                        }`}
                      >
                        {filled ? '•' : ''}
                      </span>
                    </div>
                  );
                })}
              </div>
              {pinChecking && (
                <p className="text-center text-xs font-bold text-indigo-400 animate-pulse">Verificando PIN…</p>
              )}
              <div className={`grid grid-cols-3 gap-2 ${pinChecking ? 'opacity-50 pointer-events-none' : ''}`}>
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => {
                      if (k === 'C') setPin('');
                      else if (k === '⌫') setPin((p) => p.slice(0, -1));
                      else pressPin(k);
                    }}
                    className="py-3 bg-slate-800 rounded-xl font-black border border-slate-700"
                  >
                    {k}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={pin.length !== 4 || pinChecking}
                  onClick={entrarComPin}
                  className="py-3 rounded-2xl bg-indigo-600 disabled:bg-slate-800 disabled:text-slate-500 font-black text-xs uppercase border border-indigo-500/50 disabled:border-slate-700"
                >
                  Entrar
                </button>
                <button
                  type="button"
                  disabled={pin.length !== 4 || pinChecking}
                  onClick={salvarPinEEntrar}
                  className="py-3 rounded-2xl bg-emerald-600 disabled:bg-slate-800 disabled:text-slate-500 font-black text-[10px] uppercase leading-tight border border-emerald-500/50 disabled:border-slate-700"
                >
                  Salvar PIN
                </button>
              </div>
              <p className="text-[10px] text-center text-slate-500 leading-snug">
                <strong className="text-slate-400">Salvar PIN</strong> mantém você logado ao reabrir o app (valide uma vez com internet).
              </p>
              <button type="button" onClick={() => setPinOp(null)} className="text-xs text-indigo-400 w-full">
                Voltar
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-950">
      {toast && (
        <div className="fixed top-[max(0.75rem,env(safe-area-inset-top,0px))] left-1/2 -translate-x-1/2 z-50 bg-slate-800 border border-slate-600 px-4 py-2 rounded-xl text-xs font-bold">
          {toast}
        </div>
      )}

      <header className="shrink-0 flex flex-wrap gap-2 items-center justify-between p-2 border-b border-slate-800 bg-slate-900">
        <div>
          <p className="text-[10px] text-indigo-400 font-black uppercase">Gtech PDV</p>
          <p className="text-xs font-bold truncate max-w-[200px]">{usuario.nome}</p>
        </div>
        <nav className="flex flex-wrap gap-1">
          {(
            [
              ['vendas', 'Vendas'],
              ['recibos', 'Recibos'],
              ['senha', 'Senha'],
              ['impressora', 'Impressora'],
              ['atualizar', 'Atualizar'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                if (id !== 'vendas') setEtapaVenda('pedido');
                setTab(id);
              }}
              className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold border ${
                tab === id ? 'bg-indigo-600 border-indigo-500' : 'bg-slate-800 border-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setEtapaVenda('pedido');
              clearPdvSession();
              setUsuario(null);
            }}
            className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold border border-red-500/40 text-red-400"
          >
            Sair
          </button>
        </nav>
      </header>

      {isPdvCloudEnabled && cloudReady && (
        <div className="shrink-0 px-2 py-1.5 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-900/80 text-[10px]">
          <span className={`font-bold ${isOnline() ? 'text-emerald-400' : 'text-amber-400'}`}>
            {isOnline() ? 'Online' : 'Offline — vendas salvas no tablet'}
          </span>
          {pendingCount > 0 && (
            <button
              type="button"
              disabled={syncing || !isOnline()}
              onClick={() => void runSync()}
              className="px-2.5 py-1 rounded-lg bg-indigo-600 disabled:bg-slate-700 font-bold"
            >
              {syncing ? 'Enviando…' : `Sincronizar (${pendingCount})`}
            </button>
          )}
        </div>
      )}

      {tab === 'senha' && (
        <div className="flex-1 min-h-0 overflow-y-auto custom-scroll">
          <SenhaSettingsPanel
            config={senhaConfig}
            onChange={(c) => pushSenhaConfig(c)}
          />
        </div>
      )}

      {tab === 'impressora' && (
        <div className="flex-1 min-h-0 overflow-y-auto custom-scroll">
          <PrinterSettingsPanel loja={loja} config={printerConfig} onChange={setPrinterConfig} />
        </div>
      )}

      {tab === 'atualizar' && (
        <div className="flex-1 min-h-0 overflow-y-auto custom-scroll">
          <UpdateSettingsPanel />
        </div>
      )}

      {tab === 'recibos' && (
        <div className="flex-1 overflow-y-auto p-4 custom-scroll">
          {vendas.length === 0 ? (
            <p className="text-center text-slate-500 text-sm">Nenhuma venda ainda</p>
          ) : (
            <ul className="max-w-xl mx-auto space-y-2">
              {vendas.map((v) => (
                <li key={v.id} className="flex items-center justify-between p-3 bg-slate-800 rounded-2xl border border-slate-700">
                  <div>
                    <span className="font-mono font-black text-amber-400">#{v.senha}</span>
                    <span className="text-xs text-slate-400 ml-2">
                      {v.data} {v.hora}
                    </span>
                    <p className="text-sm font-bold">{v.cliente}</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="font-mono text-emerald-400 font-bold">R$ {v.total.toFixed(2)}</span>
                    <button
                      type="button"
                      onClick={() => imprimirVenda(v, loja, printerConfig)}
                      className="text-xs bg-indigo-600 px-2 py-1 rounded-lg font-bold"
                    >
                      Imprimir
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === 'vendas' && etapaVenda === 'pedido' && (
        <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
          <section className="flex-1 flex flex-col min-h-0 border-r border-slate-800">
            <div className="p-2 flex gap-2 overflow-x-auto shrink-0 border-b border-slate-800">
              <button
                type="button"
                onClick={() => setCategoriaId('todas')}
                className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap ${
                  categoriaId === 'todas' ? 'bg-indigo-600' : 'bg-slate-800'
                }`}
              >
                Todos
              </button>
              {categorias.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategoriaId(String(c.id))}
                  className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap ${
                    categoriaId === String(c.id) ? 'bg-indigo-600' : 'bg-slate-800'
                  }`}
                >
                  {c.nome}
                </button>
              ))}
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar..."
                className="ml-auto bg-slate-900 border border-slate-700 rounded-xl px-2 py-1 text-xs min-w-[120px]"
              />
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scroll">
              {produtosFiltrados.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleProdutoClick(p)}
                  className="w-full flex justify-between items-center p-3 bg-slate-900 rounded-2xl border border-slate-800 hover:border-indigo-500 text-left"
                >
                  <span className="text-xs font-bold uppercase">{p.nome}</span>
                  <span className="font-mono text-emerald-400 font-bold text-sm">R$ {p.preco.toFixed(2)}</span>
                </button>
              ))}
            </div>
          </section>

          <aside className="w-full md:w-[380px] flex flex-col bg-slate-900 shrink-0 min-h-[40vh] md:min-h-0">
            {controleSenhaAtivo && (
            <div className="p-3 flex items-center justify-between border-b border-slate-800 bg-slate-950">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold">Senha deste pedido</span>
                <p className="text-[11px] text-slate-500">Ajuste antes de confirmar</p>
              </div>
              <div className="flex items-center gap-2 bg-amber-400 text-slate-950 px-3 py-1 rounded-2xl">
                <button type="button" onClick={() => pushSenhaConfig(setProximaSenha(applyDailyReset(senhaConfig), applyDailyReset(senhaConfig).proximaSenha - 1))} className="font-black px-1">
                  −
                </button>
                <span className="font-mono font-black text-2xl">#{senhaAtual}</span>
                <button type="button" onClick={() => pushSenhaConfig(setProximaSenha(applyDailyReset(senhaConfig), applyDailyReset(senhaConfig).proximaSenha + 1))} className="font-black px-1">
                  +
                </button>
              </div>
            </div>
            )}

            <input
              value={cliente}
              onChange={(e) => setCliente(e.target.value)}
              placeholder="Cliente (opcional)"
              className="m-2 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs"
            />

            <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scroll">
              {carrinho.map((item) => (
                <div key={item.carrinhoItemId} className="p-2 bg-slate-800 rounded-xl border border-slate-700 text-xs">
                  <div className="flex justify-between font-bold">
                    <span>
                      {item.quantidade > 1 ? `${item.quantidade}x ` : ''}
                      {item.nome}
                    </span>
                    <button type="button" onClick={() => setCarrinho((c) => c.filter((i) => i.carrinhoItemId !== item.carrinhoItemId))}>
                      ✕
                    </button>
                  </div>
                  {item.opcoes.length > 0 && (
                    <p className="text-[10px] text-slate-400 mt-0.5">{item.opcoes.map((o) => o.nome).join(' · ')}</p>
                  )}
                  {item.observacao && <p className="text-[10px] text-amber-400/90 mt-0.5">Obs: {item.observacao}</p>}
                  <span className="text-emerald-400 font-mono">R$ {item.subtotal.toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="p-3 border-t border-slate-800 space-y-2 shrink-0">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-400">
                  {carrinho.length} {carrinho.length === 1 ? 'item' : 'itens'}
                </span>
                <span className="text-xl font-black font-mono text-emerald-400">R$ {total.toFixed(2)}</span>
              </div>
              <button
                type="button"
                disabled={!carrinho.length}
                onClick={() => {
                  setPagamento('PIX');
                  setValorRecebido('');
                  setEtapaVenda('pagamento');
                }}
                className="w-full py-3 rounded-2xl bg-indigo-600 disabled:bg-slate-700 font-black text-xs uppercase"
              >
                Finalizar pedido
              </button>
            </div>
          </aside>
        </div>
      )}

      {tab === 'vendas' && etapaVenda === 'pagamento' && (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-slate-950">
          <div className="flex-1 overflow-y-auto custom-scroll p-4 max-w-lg mx-auto w-full space-y-4">
            <button
              type="button"
              onClick={() => setEtapaVenda('pedido')}
              className="text-xs font-bold text-indigo-400"
            >
              ← Voltar e editar pedido
            </button>

            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase text-indigo-400">Pagamento</p>
              <h2 className="text-lg font-black">Fechar comanda</h2>
              <p className="text-xs text-slate-400">
                {controleSenhaAtivo && (
                  <>
                    Senha <span className="font-mono font-black text-amber-400">#{senhaAtual}</span>
                  </>
                )}
                {cliente.trim() && (
                  <>
                    {controleSenhaAtivo ? ' · ' : ''}
                    {cliente.trim()}
                  </>
                )}
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 space-y-2">
              <p className="text-[10px] font-bold uppercase text-slate-500">Resumo do pedido</p>
              {carrinho.map((item) => (
                <div key={item.carrinhoItemId} className="text-xs border-b border-slate-800 last:border-0 pb-2 last:pb-0">
                  <div className="flex justify-between font-bold">
                    <span>
                      {item.quantidade > 1 ? `${item.quantidade}x ` : ''}
                      {item.nome}
                    </span>
                    <span className="font-mono text-emerald-400">R$ {item.subtotal.toFixed(2)}</span>
                  </div>
                  {item.opcoes.length > 0 && (
                    <p className="text-[10px] text-slate-500">{item.opcoes.map((o) => o.nome).join(' · ')}</p>
                  )}
                </div>
              ))}
              <div className="flex justify-between items-center pt-2 border-t border-slate-800">
                <span className="text-sm font-bold">Total</span>
                <span className="text-2xl font-black font-mono text-emerald-400">R$ {total.toFixed(2)}</span>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase text-slate-500">Forma de pagamento</p>
              <div className="grid grid-cols-2 gap-2">
                {(['PIX', 'Cartão Crédito', 'Cartão Débito', 'Dinheiro'] as FormaPagamento[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => {
                      setPagamento(f);
                      if (f !== 'Dinheiro') setValorRecebido('');
                    }}
                    className={`py-3 rounded-2xl text-[11px] font-bold border ${
                      pagamento === f ? 'bg-indigo-600 border-indigo-500' : 'border-slate-700 bg-slate-900'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {pagamento === 'Dinheiro' && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
                <label className="text-[10px] font-bold uppercase text-slate-500 block">Valor recebido</label>
                <div className="flex gap-2 items-stretch">
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min={0}
                    value={valorRecebido}
                    onChange={(e) => setValorRecebido(e.target.value)}
                    placeholder="0,00"
                    className="flex-1 min-w-0 bg-slate-950 border border-slate-700 rounded-xl p-3 text-lg font-mono font-black"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setValorRecebido(total.toFixed(2));
                      void finalizar({ valorRecebidoDinheiro: total });
                    }}
                    className="shrink-0 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-black text-xs uppercase leading-tight text-center min-w-[88px]"
                  >
                    Cobrar
                    <span className="block text-[10px] font-mono font-bold opacity-90 mt-0.5">
                      R$ {total.toFixed(2)}
                    </span>
                  </button>
                </div>
                {(parseFloat(valorRecebido) || 0) >= total && total > 0 && (
                  <div className="flex justify-between items-center bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3">
                    <span className="text-xs font-bold text-emerald-300">Troco</span>
                    <span className="text-xl font-black font-mono text-emerald-400">R$ {troco.toFixed(2)}</span>
                  </div>
                )}
                {(parseFloat(valorRecebido) || 0) > 0 && (parseFloat(valorRecebido) || 0) < total && (
                  <p className="text-xs font-bold text-red-400">Valor recebido menor que o total.</p>
                )}
              </div>
            )}
          </div>

          <div className="shrink-0 p-4 border-t border-slate-800 bg-slate-900 max-w-lg mx-auto w-full">
            <button
              type="button"
              disabled={
                !carrinho.length ||
                (pagamento === 'Dinheiro' && (parseFloat(valorRecebido) || 0) < total)
              }
              onClick={() => void finalizar()}
              className="w-full py-4 rounded-2xl bg-emerald-600 disabled:bg-slate-700 font-black text-sm uppercase"
            >
              {controleSenhaAtivo ? `Confirmar venda #${senhaAtual}` : 'Confirmar venda'}
            </button>
          </div>
        </div>
      )}

      {itemModal && tab === 'vendas' && etapaVenda === 'pedido' && (
        <ComplementoItemModal
          produto={itemModal}
          complementos={complementos}
          onClose={() => setItemModal(null)}
          onConfirm={addItemAoCarrinho}
          newCarrinhoItemId={newCarrinhoItemId}
        />
      )}

      {ultimaVenda && tab === 'vendas' && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-40">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-sm w-full text-center space-y-3">
            <p className="text-sm font-bold">Venda concluída</p>
            {ultimaVenda.senha ? (
              <p className="text-5xl font-black font-mono text-amber-400">#{ultimaVenda.senha}</p>
            ) : (
              <p className="text-2xl font-black text-emerald-400">OK</p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => imprimirVenda(ultimaVenda, loja, printerConfig)}
                className="flex-1 py-2 bg-indigo-600 rounded-xl text-xs font-bold"
              >
                Reimprimir
              </button>
              <button
                type="button"
                onClick={() => setUltimaVenda(null)}
                className="flex-1 py-2 bg-emerald-600 rounded-xl text-xs font-bold"
              >
                Nova venda
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                if (isPdvCloudEnabled) {
                  notify('Estorno: use o histórico no dashboard');
                  setUltimaVenda(null);
                  return;
                }
                setVendas(removeVenda(ultimaVenda.id));
                setUltimaVenda(null);
              }}
              className="text-xs text-red-400 font-bold"
            >
              Estornar venda
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
