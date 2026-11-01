import { useEffect, useState } from 'react';
import type { SenhaConfig } from '@gtech/shared';
import {
  advanceSenhaAfterSale,
  applyDailyReset,
  isControleSenhaAtivo,
  loadSenhaConfig,
  peekSenhaAtual,
  resetSenhaCounter,
  saveSenhaConfig,
  setProximaSenha,
} from '@gtech/shared';

type Props = {
  config: SenhaConfig;
  onChange: (c: SenhaConfig) => void;
};

export function useSenhaState() {
  const [senhaConfig, setSenhaConfig] = useState(() => applyDailyReset(loadSenhaConfig()));

  useEffect(() => {
    saveSenhaConfig(senhaConfig);
  }, [senhaConfig]);

  const senhaAtual = peekSenhaAtual(senhaConfig);

  const bump = (delta: number) => {
    setSenhaConfig((prev) => {
      const base = applyDailyReset(prev);
      return setProximaSenha(base, base.proximaSenha + delta);
    });
  };

  const afterSale = () => {
    setSenhaConfig((prev) => advanceSenhaAfterSale(prev));
  };

  const reset = () => {
    if (!confirm('Zerar contador de senha para o início do dia?')) return;
    setSenhaConfig((prev) => resetSenhaCounter(prev, true));
  };

  return { senhaConfig, setSenhaConfig, senhaAtual, bump, afterSale, reset };
}

export function SenhaSettingsPanel({ config, onChange }: Props) {
  const cfg = applyDailyReset(config);
  const display = peekSenhaAtual(cfg);
  const ativo = isControleSenhaAtivo(cfg);

  return (
    <div className="max-w-lg mx-auto w-full p-4 pb-12 space-y-4">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 space-y-3">
        <h2 className="text-base font-black text-white">Controle de senha</h2>
        <button
          type="button"
          onClick={() => onChange({ ...cfg, controleAtivo: !ativo })}
          className={`w-full py-3 rounded-xl text-xs font-black uppercase ${
            ativo ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300 border border-slate-600'
          }`}
        >
          {ativo ? 'Controle ativado' : 'Controle desativado'}
        </button>
      </div>

      <div className={`space-y-4 ${!ativo ? 'opacity-40 pointer-events-none select-none' : ''}`}>
        <div className="bg-amber-400 text-slate-950 rounded-2xl p-4 shadow-lg">
          <p className="text-[10px] font-black uppercase text-center text-slate-900/70">Próxima senha na venda</p>
          <div className="flex items-center justify-center gap-3 mt-3">
            <button
              type="button"
              onClick={() => onChange(setProximaSenha(cfg, cfg.proximaSenha - 1))}
              className="w-12 h-12 shrink-0 rounded-xl bg-slate-950/15 font-black text-xl border border-slate-950/20"
              aria-label="Diminuir senha"
            >
              −
            </button>
            <span className="text-4xl sm:text-5xl font-black font-mono tracking-wider min-w-[4.5rem] text-center">
              #{display}
            </span>
            <button
              type="button"
              onClick={() => onChange(setProximaSenha(cfg, cfg.proximaSenha + 1))}
              className="w-12 h-12 shrink-0 rounded-xl bg-slate-950/15 font-black text-xl border border-slate-950/20"
              aria-label="Aumentar senha"
            >
              +
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <label className="flex items-start gap-2.5 p-3 bg-slate-800 border border-slate-700 rounded-2xl min-w-0">
            <input
              type="checkbox"
              checked={cfg.incrementoAutomatico}
              onChange={(e) => onChange({ ...cfg, incrementoAutomatico: e.target.checked })}
              className="w-5 h-5 mt-0.5 shrink-0 accent-indigo-500"
            />
            <span className="text-xs font-bold leading-snug">Incrementar após cada venda</span>
          </label>

          <label className="flex items-start gap-2.5 p-3 bg-slate-800 border border-slate-700 rounded-2xl min-w-0">
            <input
              type="checkbox"
              checked={cfg.reiniciarACadaDia}
              onChange={(e) => onChange({ ...cfg, reiniciarACadaDia: e.target.checked })}
              className="w-5 h-5 mt-0.5 shrink-0 accent-indigo-500"
            />
            <span className="text-xs font-bold leading-snug">Reiniciar contador a cada dia</span>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="min-w-0">
            <label className="text-[10px] font-bold text-slate-400 uppercase">Mínimo</label>
            <input
              type="number"
              min={1}
              max={99}
              value={cfg.minimo}
              onChange={(e) => onChange({ ...cfg, minimo: Number(e.target.value) || 1 })}
              className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-xl p-2.5 font-mono text-sm"
            />
          </div>
          <div className="min-w-0">
            <label className="text-[10px] font-bold text-slate-400 uppercase">Máximo</label>
            <input
              type="number"
              min={1}
              max={999}
              value={cfg.maximo}
              onChange={(e) => onChange({ ...cfg, maximo: Number(e.target.value) || 99 })}
              className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-xl p-2.5 font-mono text-sm"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            if (confirm('Resetar senha para o número mínimo agora?')) onChange(resetSenhaCounter(cfg, true));
          }}
          className="w-full py-3 rounded-2xl border border-red-500/40 text-red-400 font-bold text-sm bg-red-500/10"
        >
          Resetar contador agora
        </button>
      </div>
    </div>
  );
}
