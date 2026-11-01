import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import type { LojaInfo, PrinterConfig } from '@gtech/shared';
import {
  DEFAULT_PRINTER_CONFIG,
  listNativePrinters,
  loadPrinterConfig,
  savePrinterConfig,
  testarImpressora,
  type ListedDevice,
} from '../services/printService';

type Props = {
  loja: LojaInfo;
  config: PrinterConfig;
  onChange: (c: PrinterConfig) => void;
};

export function usePrinterState() {
  const [printerConfig, setPrinterConfig] = useState(() => loadPrinterConfig());

  useEffect(() => {
    savePrinterConfig(printerConfig);
  }, [printerConfig]);

  return { printerConfig, setPrinterConfig };
}

export function PrinterSettingsPanel({ loja, config, onChange }: Props) {
  const [devices, setDevices] = useState<ListedDevice[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const native = Capacitor.isNativePlatform();

  const refreshDevices = async () => {
    setLoading(true);
    setMsg('');
    const list = await listNativePrinters();
    setDevices(list);
    setLoading(false);
    if (native && list.length === 0) {
      setMsg('Nenhuma impressora listada. Pareie Bluetooth em Ajustes do Android ou conecte USB OTG.');
    }
  };

  useEffect(() => {
    if (native) refreshDevices();
  }, [native]);

  const selectDevice = (d: ListedDevice) => {
    if (d.transport === 'bluetooth') {
      onChange({
        ...config,
        transport: 'bluetooth',
        deviceName: d.name,
        bluetoothAddress: d.address ?? '',
      });
    } else {
      onChange({
        ...config,
        transport: 'usb',
        deviceName: d.name,
        usbVendorId: d.vendorId,
        usbProductId: d.productId,
      });
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <div className="bg-slate-800 border border-slate-700 rounded-3xl p-5 space-y-1">
        <h2 className="text-lg font-black">Impressora térmica</h2>
        <p className="text-xs text-slate-400">
          {native
            ? 'Android: Bluetooth (pareada) ou USB OTG. 1ª via produção + 2ª via só senha (ESC/POS).'
            : 'No navegador do PC: impressão pelo sistema (Spooler). No tablet, instale o APK Capacitor.'}
        </p>
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 space-y-3">
        <label className="text-[10px] font-bold text-slate-400 uppercase">Modo de conexão</label>
        <select
          value={config.transport}
          onChange={(e) =>
            onChange({ ...config, transport: e.target.value as PrinterConfig['transport'] })
          }
          className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-sm font-bold"
        >
          <option value="browser">Navegador / Spooler (teste no PC)</option>
          <option value="bluetooth">Bluetooth ESC/POS</option>
          <option value="usb">USB OTG ESC/POS</option>
        </select>

        <label className="text-[10px] font-bold text-slate-400 uppercase">Bobina</label>
        <select
          value={config.larguraPapel}
          onChange={(e) => onChange({ ...config, larguraPapel: e.target.value as '58mm' | '80mm' })}
          className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-sm font-bold"
        >
          <option value="80mm">80 mm (padrão balcão)</option>
          <option value="58mm">58 mm (portátil)</option>
        </select>

        <label className="flex items-center gap-3 p-3 bg-slate-900 rounded-xl border border-slate-700">
          <input
            type="checkbox"
            checked={config.imprimirAutomatico}
            onChange={(e) => onChange({ ...config, imprimirAutomatico: e.target.checked })}
            className="w-5 h-5 accent-indigo-500"
          />
          <span className="text-sm font-bold">Imprimir automaticamente ao finalizar venda</span>
        </label>

        {config.deviceName && (
          <p className="text-xs text-emerald-400 font-bold">
            Selecionada: {config.deviceName}
            {config.bluetoothAddress ? ` (${config.bluetoothAddress})` : ''}
          </p>
        )}
      </div>

      {native && config.transport !== 'browser' && (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm font-bold">Dispositivos</span>
            <button
              type="button"
              onClick={refreshDevices}
              disabled={loading}
              className="text-xs font-bold text-indigo-400 px-3 py-1.5 bg-slate-900 rounded-lg border border-slate-700"
            >
              {loading ? '...' : 'Atualizar lista'}
            </button>
          </div>
          {msg && <p className="text-xs text-amber-400">{msg}</p>}
          <div className="space-y-2 max-h-48 overflow-y-auto custom-scroll">
            {devices.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => selectDevice(d)}
                className="w-full text-left p-3 rounded-xl bg-slate-900 border border-slate-700 hover:border-indigo-500 text-sm"
              >
                <span className="font-bold block">{d.name}</span>
                <span className="text-[10px] text-slate-400 uppercase">{d.transport}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={async () => {
          try {
            await testarImpressora(loja, config);
            setMsg('Teste enviado. Verifique a impressora.');
          } catch (e) {
            setMsg(e instanceof Error ? e.message : 'Falha ao imprimir teste.');
          }
        }}
        className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 rounded-2xl font-black text-sm"
      >
        Imprimir cupom de teste (senha #99)
      </button>

      {!native && (
        <p className="text-[11px] text-slate-500 text-center">
          Para Bluetooth/USB no tablet: rode <code className="text-indigo-400">npm run pdv:android</code> e instale o APK.
        </p>
      )}
    </div>
  );
}

export { DEFAULT_PRINTER_CONFIG };
