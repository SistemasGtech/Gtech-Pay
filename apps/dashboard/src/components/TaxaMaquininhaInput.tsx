import { useEffect, useState } from 'react';
import { formatTaxaPercentBr, parseTaxaPercentBr } from '@gtech/shared';

type Props = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  className?: string;
  /** Muda quando a loja recarrega — reinicia o texto do campo. */
  resetKey?: string;
};

export function TaxaMaquininhaInput({ label, value, onChange, className, resetKey }: Props) {
  const [text, setText] = useState(() => formatTaxaPercentBr(value));

  useEffect(() => {
    setText(formatTaxaPercentBr(value));
  }, [resetKey]);

  return (
    <div className={className}>
      <label className="text-[10px] font-bold uppercase text-slate-500">{label}</label>
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        placeholder="ex.: 1,21"
        value={text}
        onChange={(e) => {
          const raw = e.target.value;
          setText(raw);
          onChange(parseTaxaPercentBr(raw));
        }}
        onBlur={() => setText(formatTaxaPercentBr(value))}
        className="w-full mt-1 bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-sm font-mono"
      />
    </div>
  );
}
