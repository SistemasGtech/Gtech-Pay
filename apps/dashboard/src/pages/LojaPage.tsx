import { useEffect, useState } from 'react';
import type { LojaInfo } from '@gtech/shared';

type Props = {
  loja: LojaInfo;
  storeId?: string | null;
  cloud?: boolean;
  onSave: (loja: LojaInfo) => void;
};

export function LojaPage({ loja, storeId, cloud, onSave }: Props) {
  const [form, setForm] = useState(loja);
  useEffect(() => setForm(loja), [loja]);

  return (
    <div className="max-w-xl space-y-4">
      <h1 className="text-2xl font-black">Dados da loja</h1>
      <p className="text-sm text-slate-400">Aparecem no cupom e no app de vendas.</p>
      {cloud && storeId && (
        <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-2xl p-4 space-y-2">
          <p className="text-xs font-bold uppercase text-indigo-300">Conectar tablet (PDV)</p>
          <p className="text-sm text-slate-300">
            No app de vendas, cole este ID da loja na tela de configuração (ou defina{' '}
            <code className="text-indigo-200">VITE_STORE_ID</code> no <code className="text-indigo-200">.env.local</code>{' '}
            do PDV).
          </p>
          <div className="flex gap-2 items-center">
            <code className="flex-1 text-xs bg-slate-950 border border-slate-700 rounded-xl p-2.5 font-mono break-all">
              {storeId}
            </code>
            <button
              type="button"
              onClick={() => void navigator.clipboard.writeText(storeId)}
              className="shrink-0 px-3 py-2 bg-indigo-600 rounded-xl text-xs font-bold"
            >
              Copiar
            </button>
          </div>
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(form);
        }}
        className="space-y-3 bg-slate-900 border border-slate-800 rounded-2xl p-5"
      >
        {(
          [
            ['nome', 'Nome do estabelecimento'],
            ['endereco', 'Endereço'],
            ['telefone', 'Telefone'],
            ['cnpj', 'CNPJ'],
          ] as const
        ).map(([field, label]) => (
          <div key={field}>
            <label className="text-[10px] font-bold uppercase text-slate-500">{label}</label>
            <input
              value={form[field]}
              onChange={(e) => setForm({ ...form, [field]: e.target.value })}
              className="w-full mt-1 bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-sm"
            />
          </div>
        ))}
        <button type="submit" className="w-full py-2.5 bg-emerald-600 rounded-xl font-bold text-sm">
          Salvar loja
        </button>
      </form>
    </div>
  );
}
