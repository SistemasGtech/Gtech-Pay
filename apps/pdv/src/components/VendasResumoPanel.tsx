import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Categoria, Produto, Venda } from '@gtech/shared';
import { relatorioItensVendidos, vendasDoDia, totalFaturamento } from '@gtech/shared';
import {
  clearFaturamentoPin,
  getFaturamentoPin,
  setFaturamentoPin,
  unlockResumoSession,
  touchResumoUnlockActivity,
  isResumoUnlockSession,
  clearResumoUnlockSession,
  RESUMO_IDLE_LOCK_MS,
} from '../lib/pdvFaturamentoPin';
import { ConfirmDialog } from './ConfirmDialog';

type SubTab = 'vendas' | 'itens' | 'config';

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function hourOfVenda(v: Venda): number {
  if (v.timestamp && !Number.isNaN(new Date(v.timestamp).getTime())) {
    return new Date(v.timestamp).getHours();
  }
  const m = /^(\d{1,2})/.exec(v.hora?.trim() ?? '');
  if (m) {
    const h = Number(m[1]);
    if (h >= 0 && h <= 23) return h;
  }
  return 12;
}

function pctVsAnterior(hoje: number, anterior: number): number {
  if (anterior <= 0) return hoje > 0 ? 100 : 0;
  return Math.round(((hoje - anterior) / anterior) * 100);
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
}

function SemiGauge({
  label,
  valueText,
  pct,
  color,
  accentClass,
}: {
  label: string;
  valueText: string;
  pct: number;
  color: string;
  accentClass: string;
}) {
  const clamped = Math.min(100, Math.max(0, pct));
  const dash = `${(clamped / 100) * 100} 100`;

  return (
    <div className="flex flex-col items-center min-w-0 flex-1">
      <div className="w-[5rem] h-[2.5rem] sm:w-[5.75rem] sm:h-[2.75rem]">
        <svg viewBox="0 0 100 56" className="w-full h-full">
          <path
            d="M 12 52 A 38 38 0 0 1 88 52"
            fill="none"
            stroke="currentColor"
            strokeWidth="10"
            className="text-slate-700"
          />
          <path
            d="M 12 52 A 38 38 0 0 1 88 52"
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray={dash}
          />
        </svg>
      </div>
      <span className={`text-sm sm:text-base font-black tabular-nums truncate max-w-full text-center ${accentClass}`}>
        {valueText}
      </span>
      <span className="text-[10px] text-slate-500 font-bold">{clamped}%</span>
      <span className="text-[10px] sm:text-xs font-bold text-slate-400 mt-0.5 text-center leading-tight">{label}</span>
    </div>
  );
}

function PinPad({
  value,
  onChange,
  onSubmit,
  disabled,
  maxLen = 4,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  maxLen?: number;
}) {
  const add = (d: string) => {
    if (disabled || value.length >= maxLen) return;
    onChange(value + d);
  };
  const back = () => {
    if (disabled) return;
    onChange(value.slice(0, -1));
  };

  const lastAutoSubmit = useRef('');
  useEffect(() => {
    if (disabled || value.length !== maxLen) {
      if (value.length < maxLen) lastAutoSubmit.current = '';
      return;
    }
    if (lastAutoSubmit.current === value) return;
    lastAutoSubmit.current = value;
    onSubmit();
  }, [value, maxLen, disabled, onSubmit]);

  return (
    <div className={`w-full max-w-[min(100%,20rem)] mx-auto px-2 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <div className="flex flex-col items-stretch gap-6 py-2">
        <div className="flex justify-center gap-4" aria-label={`PIN ${value.length} de ${maxLen}`}>
          {Array.from({ length: maxLen }, (_, i) => (
            <span
              key={i}
              className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full border-2 shrink-0 ${
                i < value.length ? 'bg-indigo-500 border-indigo-400' : 'border-slate-600'
              }`}
            />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((k, idx) =>
            k === '' ? (
              <span key={idx} className="min-h-[3.25rem]" />
            ) : k === '⌫' ? (
              <button
                key={k}
                type="button"
                onClick={back}
                className="min-h-[3.25rem] sm:min-h-[3.75rem] rounded-2xl bg-slate-700 active:bg-slate-600 font-black text-base border border-slate-600/80"
              >
                Apagar
              </button>
            ) : (
              <button
                key={k}
                type="button"
                onClick={() => add(k)}
                className="min-h-[3.25rem] sm:min-h-[3.75rem] rounded-2xl bg-slate-700 hover:bg-slate-600 active:bg-slate-500 font-black text-xl sm:text-2xl border border-slate-600/80"
              >
                {k}
              </button>
            ),
          )}
        </div>
      </div>
    </div>
  );
}

type Mode = 'locked' | 'create' | 'confirmCreate' | 'unlocked';

function faturamentoPorCategoria(
  vendasDia: Venda[],
  produtos: Produto[],
  categorias: Categoria[],
): { catKey: string; nome: string; total: number }[] {
  const nomePorCatId = new Map<string, string>();
  for (const c of categorias) nomePorCatId.set(String(c.id), c.nome);

  const mapaProd = new Map<string, Produto>();
  for (const p of produtos) mapaProd.set(String(p.id), p);

  const totais = new Map<string, number>();
  for (const v of vendasDia) {
    for (const it of v.itens || []) {
      const prod = mapaProd.get(String(it.produtoId));
      const catId = prod ? String(prod.categoriaId) : '_outros';
      const sub = it.subtotal ?? (Number(it.precoUnitario) || 0) * (it.quantidade || 1);
      totais.set(catId, (totais.get(catId) ?? 0) + sub);
    }
  }

  const rows = [...totais.entries()].map(([catId, total]) => ({
    catKey: catId,
    nome: catId === '_outros' ? 'Sem categoria' : (nomePorCatId.get(catId) ?? 'Sem categoria'),
    total,
  }));
  rows.sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, 'pt-BR'));
  return rows;
}

export function VendasResumoPanel({
  vendas,
  produtos,
  categorias,
}: {
  vendas: Venda[];
  produtos: Produto[];
  categorias: Categoria[];
}) {
  const [dia, setDia] = useState(() => startOfDay(new Date()));
  const [subTab, setSubTab] = useState<SubTab>('vendas');
  const [mode, setMode] = useState<Mode>('locked');
  const [storedPin, setStoredPin] = useState<string | null>(() => getFaturamentoPin());
  const [input, setInput] = useState('');
  const [createFirst, setCreateFirst] = useState('');
  const [pinMsg, setPinMsg] = useState('');
  const [configMsg, setConfigMsg] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const [oldPinChange, setOldPinChange] = useState('');
  const [newPinChange, setNewPinChange] = useState('');
  const [newPinChange2, setNewPinChange2] = useState('');

  useEffect(() => {
    const pin = getFaturamentoPin();
    setStoredPin(pin);
    if (pin && isResumoUnlockSession()) {
      setMode('unlocked');
    }
  }, []);

  useEffect(() => {
    if (mode !== 'unlocked') return;
    const check = () => {
      if (!isResumoUnlockSession()) {
        setMode('locked');
        setInput('');
        setPinMsg('Sessão expirada. Digite o PIN novamente.');
      }
    };
    const id = window.setInterval(check, 2000);
    return () => clearInterval(id);
  }, [mode]);

  const diaAnterior = useMemo(() => addDays(dia, -1), [dia]);

  const vendasHoje = useMemo(() => vendasDoDia(vendas, dia), [vendas, dia]);
  const vendasOntem = useMemo(() => vendasDoDia(vendas, diaAnterior), [vendas, diaAnterior]);

  const cupons = vendasHoje.length;
  const cuponsOntem = vendasOntem.length;
  const liquido = totalFaturamento(vendasHoje);
  const liquidoOntem = totalFaturamento(vendasOntem);
  const ticketMedio = cupons > 0 ? liquido / cupons : 0;
  const ticketOntem = cuponsOntem > 0 ? liquidoOntem / cuponsOntem : 0;

  const pctCupons = pctVsAnterior(cupons, cuponsOntem);
  const pctLiq = pctVsAnterior(liquido, liquidoOntem);
  const pctTicket = pctVsAnterior(ticketMedio, ticketOntem);

  const buckets = useMemo(() => {
    const b = Array.from({ length: 24 }, () => 0);
    for (const v of vendasHoje) {
      b[hourOfVenda(v)] += v.total || 0;
    }
    return b;
  }, [vendasHoje]);

  const maxH = useMemo(() => Math.max(1, ...buckets), [buckets]);

  const itensDia = useMemo(() => relatorioItensVendidos(vendasHoje), [vendasHoje]);

  const porCategoria = useMemo(
    () => faturamentoPorCategoria(vendasHoje, produtos, categorias),
    [vendasHoje, produtos, categorias],
  );

  const tituloDia = dia.toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: dia.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  });

  const tryUnlock = useCallback(() => {
    const pin = getFaturamentoPin();
    if (input === pin) {
      unlockResumoSession();
      setMode('unlocked');
      setInput('');
      setPinMsg('');
      setSubTab('vendas');
    } else {
      setPinMsg('PIN incorreto');
      setInput('');
    }
  }, [input]);

  const submitCreate = useCallback(() => {
    if (input.length !== 4 || !/^\d{4}$/.test(input)) return;
    setCreateFirst(input);
    setInput('');
    setMode('confirmCreate');
    setPinMsg('Confirme o PIN');
  }, [input]);

  const submitConfirmCreate = useCallback(() => {
    if (input !== createFirst) {
      setPinMsg('Os PINs não coincidem');
      setInput('');
      return;
    }
    setFaturamentoPin(input);
    setStoredPin(input);
    unlockResumoSession();
    setMode('unlocked');
    setInput('');
    setCreateFirst('');
    setPinMsg('');
    setSubTab('vendas');
  }, [input, createFirst]);

  const startCreate = () => {
    setMode('create');
    setInput('');
    setPinMsg('Defina um PIN de 4 dígitos');
  };

  if (!storedPin) {
    if (mode === 'create' || mode === 'confirmCreate') {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-8 max-w-md mx-auto w-full">
          <h2 className="text-lg font-black text-white mb-1">Proteger resumo</h2>
          <p className="text-xs text-slate-400 text-center mb-6 px-2">{pinMsg || 'Crie um PIN de 4 dígitos para ver faturamento e itens.'}</p>
          <PinPad
            value={input}
            onChange={setInput}
            onSubmit={() => void (mode === 'create' ? submitCreate() : submitConfirmCreate())}
            maxLen={4}
          />
          <button
            type="button"
            onClick={() => {
              setMode('locked');
              setInput('');
              setPinMsg('');
            }}
            className="mt-8 text-xs text-slate-500"
          >
            Voltar
          </button>
        </div>
      );
    }

    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto">
        <h2 className="text-xl font-black text-white mb-2">Resumo de vendas</h2>
        <p className="text-sm text-slate-400 mb-6">
          Defina um PIN de 4 dígitos neste tablet. Só quem souber o PIN verá o faturamento.
        </p>
        <button
          type="button"
          onClick={startCreate}
          className="w-full py-4 rounded-2xl bg-indigo-600 font-black text-sm uppercase"
        >
          Definir PIN
        </button>
      </div>
    );
  }

  if (mode === 'locked') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-8 max-w-md mx-auto w-full min-h-0">
        <h2 className="text-lg font-black text-white mb-2">Resumo de vendas</h2>
        <p className="text-xs text-slate-400 mb-4 text-center px-2">Digite o PIN para visualizar</p>
        {pinMsg && <p className="text-xs text-red-400 mb-4 text-center">{pinMsg}</p>}
        <PinPad value={input} onChange={setInput} onSubmit={tryUnlock} maxLen={4} />
      </div>
    );
  }

  const idleMinutes = Math.round(RESUMO_IDLE_LOCK_MS / 60_000);

  return (
    <div
      className="flex-1 flex flex-col min-h-0 bg-slate-950"
      onPointerDownCapture={() => touchResumoUnlockActivity()}
      onScrollCapture={() => touchResumoUnlockActivity()}
    >
      <ConfirmDialog
        open={confirmClear}
        title="Remover PIN do resumo?"
        message="Qualquer pessoa poderá abrir o resumo neste tablet até definir um PIN de novo."
        confirmLabel="Remover"
        danger
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => {
          clearFaturamentoPin();
          clearResumoUnlockSession();
          setStoredPin(null);
          setMode('locked');
          setConfirmClear(false);
          setInput('');
        }}
      />

      <div className="shrink-0 pt-3 pb-2 px-3 border-b border-slate-800">
        <h2 className="text-center text-sm font-black text-white">Resumo de vendas</h2>
        <div className="flex items-center justify-center gap-4 mt-2">
          <button
            type="button"
            aria-label="Dia anterior"
            onClick={() => setDia((d) => addDays(d, -1))}
            className="p-2 rounded-xl bg-slate-800 text-slate-200 font-black"
          >
            ‹
          </button>
          <span className="text-sm font-bold text-slate-200 capitalize min-w-[10rem] text-center">{tituloDia}</span>
          <button
            type="button"
            aria-label="Próximo dia"
            onClick={() => setDia((d) => addDays(d, 1))}
            disabled={startOfDay(dia) >= startOfDay(new Date())}
            className="p-2 rounded-xl bg-slate-800 text-slate-200 font-black disabled:opacity-40 disabled:pointer-events-none"
          >
            ›
          </button>
        </div>
      </div>

      <div
        className="flex-1 overflow-y-auto custom-scroll pb-20"
        onScroll={() => touchResumoUnlockActivity()}
      >
        {subTab === 'vendas' && (
          <div className="p-3 space-y-4">
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Indicadores do dia</p>
              <div className="flex justify-between gap-1 sm:gap-2">
                <SemiGauge
                  label="Cupons"
                  valueText={String(cupons)}
                  pct={Math.min(100, Math.abs(pctCupons))}
                  color="#f97316"
                  accentClass="text-orange-400"
                />
                <SemiGauge
                  label="Vendas líquidas"
                  valueText={formatCurrency(liquido)}
                  pct={Math.min(100, Math.abs(pctLiq))}
                  color="#22c55e"
                  accentClass="text-emerald-400 text-xs sm:text-sm"
                />
                <SemiGauge
                  label="Ticket médio"
                  valueText={formatCurrency(ticketMedio)}
                  pct={Math.min(100, Math.abs(pctTicket))}
                  color="#3b82f6"
                  accentClass="text-blue-400 text-xs sm:text-sm"
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-2 text-center">
                % em relação ao dia anterior (mesmo período de calendário)
              </p>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4">
              <p className="text-xs font-bold text-slate-500 uppercase mb-2">Faturamento por hora</p>
              <div className="flex items-end gap-0.5 h-28 px-1">
                {buckets.map((v, h) => {
                  const pct = (v / maxH) * 100;
                  return (
                    <div key={h} className="flex-1 flex flex-col items-center min-w-0 group">
                      <div
                        className="w-full max-w-[10px] mx-auto rounded-t bg-emerald-500/80"
                        style={{ height: `${Math.max(4, pct)}%` }}
                        title={`${h}h — ${formatCurrency(v)}`}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between text-[8px] text-slate-600 font-mono mt-1 px-0.5">
                <span>0</span>
                <span>6</span>
                <span>12</span>
                <span>18</span>
                <span>23</span>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-800">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Por categoria</p>
                {porCategoria.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-2">Sem vendas neste dia</p>
                ) : (
                  <ul className="space-y-2.5">
                    {porCategoria.map((row) => (
                      <li key={row.catKey} className="flex justify-between items-baseline gap-4">
                        <span className="text-sm font-bold text-slate-200 truncate min-w-0">{row.nome}</span>
                        <span className="text-sm font-mono font-black text-emerald-400 shrink-0 tabular-nums">
                          {formatCurrency(row.total)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}

        {subTab === 'itens' && (
          <div className="p-3">
            <p className="text-xs text-slate-500 mb-2">
              Itens vendidos em {dia.toLocaleDateString('pt-BR')}
            </p>
            {itensDia.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">Nenhuma venda neste dia</p>
            ) : (
              <ul className="space-y-2">
                {itensDia.map((row) => (
                  <li
                    key={row.chave}
                    className="flex justify-between gap-2 p-3 rounded-2xl bg-slate-900 border border-slate-800"
                  >
                    <span className="text-sm font-bold text-slate-200 truncate">{row.nome}</span>
                    <div className="text-right shrink-0">
                      <span className="block text-xs text-slate-500">{row.quantidade} un.</span>
                      <span className="text-sm font-mono font-bold text-emerald-400">{formatCurrency(row.faturamento)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {subTab === 'config' && (
          <div className="p-4 space-y-4 max-w-md mx-auto">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 space-y-3">
              <p className="text-sm font-black text-white">Alterar PIN</p>
              <p className="text-xs text-slate-500">Digite o PIN atual e o novo PIN (4 dígitos).</p>
              {configMsg && <p className="text-xs font-bold text-emerald-400">{configMsg}</p>}
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold text-slate-500">PIN atual</label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={oldPinChange}
                  onChange={(e) => setOldPinChange(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 font-mono text-center tracking-widest"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold text-slate-500">Novo PIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={newPinChange}
                  onChange={(e) => setNewPinChange(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 font-mono text-center tracking-widest"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold text-slate-500">Repita o novo PIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={newPinChange2}
                  onChange={(e) => setNewPinChange2(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 font-mono text-center tracking-widest"
                />
              </div>
              <button
                type="button"
                disabled={oldPinChange.length !== 4 || newPinChange.length !== 4 || newPinChange !== newPinChange2}
                onClick={() => {
                  setConfigMsg('');
                  if (oldPinChange !== getFaturamentoPin()) {
                    setConfigMsg('PIN atual incorreto');
                    return;
                  }
                  setFaturamentoPin(newPinChange);
                  setStoredPin(newPinChange);
                  unlockResumoSession();
                  setOldPinChange('');
                  setNewPinChange('');
                  setNewPinChange2('');
                  setConfigMsg('PIN alterado');
                  setTimeout(() => setConfigMsg(''), 2500);
                }}
                className="w-full py-3 rounded-xl bg-indigo-600 font-black text-sm disabled:opacity-40"
              >
                Salvar novo PIN
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                clearResumoUnlockSession();
                setMode('locked');
                setInput('');
              }}
              className="w-full py-3 rounded-xl border border-slate-600 font-bold text-sm text-slate-300"
            >
              Bloquear agora
            </button>
            <button type="button" onClick={() => setConfirmClear(true)} className="w-full py-2 text-sm text-red-400 font-bold">
              Remover PIN deste tablet
            </button>
            <p className="text-[10px] text-slate-500 text-center leading-snug">
              Sem toques nesta aba por {idleMinutes} minutos, o resumo bloqueia e pede o PIN de novo.
            </p>
          </div>
        )}
      </div>

      <nav
        className="shrink-0 fixed bottom-0 left-0 right-0 flex border-t border-slate-800 bg-slate-900/95 backdrop-blur z-30"
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))' }}
      >
        {(
          [
            ['vendas', 'Vendas'],
            ['itens', 'Itens'],
            ['config', 'PIN'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setSubTab(id)}
            className={`flex-1 flex flex-col items-center justify-center py-2.5 text-[11px] font-bold ${
              subTab === id ? 'text-white' : 'text-slate-500'
            }`}
          >
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}
