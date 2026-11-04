type Props = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/** Confirmação legível no WebView Android (evita alert/confirm nativo escuro). */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  danger = false,
  onConfirm,
  onCancel,
}: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pdv-confirm-title"
    >
      <div className="bg-slate-800 border-2 border-slate-600 rounded-2xl max-w-md w-full p-5 shadow-2xl">
        <h3 id="pdv-confirm-title" className="text-lg font-black text-white">
          {title}
        </h3>
        <p className="mt-3 text-base font-bold text-slate-100 leading-relaxed">{message}</p>
        <div className="mt-6 flex flex-wrap gap-3 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold text-sm border border-slate-500"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-5 py-3 rounded-xl font-bold text-sm text-white ${
              danger ? 'bg-red-600 hover:bg-red-500' : 'bg-indigo-600 hover:bg-indigo-500'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
