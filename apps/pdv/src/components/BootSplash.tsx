import { GtechPayLogo } from './GtechPayLogo';

type Props = {
  message?: string;
};

export function BootSplash({ message = 'Carregando…' }: Props) {
  return (
    <div className="boot-splash min-h-screen min-h-[100dvh] flex flex-col items-center justify-center bg-slate-950 px-6">
      <GtechPayLogo className="w-[clamp(7rem,22vw,11rem)] h-[clamp(7rem,22vw,11rem)] mx-auto object-contain boot-splash-logo" />
      <p className="mt-6 text-sm font-black uppercase tracking-[0.2em] text-indigo-400">Gtech Pay</p>
      <p className="mt-2 text-xs font-bold text-slate-500 text-center max-w-xs">{message}</p>
      <div className="mt-8 h-1 w-36 rounded-full bg-slate-800 overflow-hidden" aria-hidden>
        <div className="boot-splash-bar h-full rounded-full bg-indigo-500" />
      </div>
    </div>
  );
}
