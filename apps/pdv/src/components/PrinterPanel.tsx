import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import type { LojaInfo, PrinterConfig } from '@gtech/shared';
import {
  DEFAULT_PRINTER_CONFIG,
  discoverNetworkPrinters,
  isValidBluetoothMac,
  listNativePrinters,
  loadPrinterConfig,
  normalizeMac,
  requestBluetoothAccess,
  requestPrinterPermissions,
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
  const [manualMac, setManualMac] = useState(config.bluetoothAddress);
  const native = Capacitor.isNativePlatform();

  useEffect(() => {
    setManualMac(config.bluetoothAddress);
  }, [config.bluetoothAddress]);

  const listTransport =
    config.transport === 'usb' ? 'usb' : config.transport === 'bluetooth' ? 'bluetooth' : 'all';

  const refreshDevices = async () => {
    setLoading(true);
    setMsg('');
    if (config.transport === 'tcp') {
      setMsg('Buscando impressoras na rede Wi‑Fi (porta 9100)…');
      const found = await discoverNetworkPrinters(6000);
      setDevices(found);
      setLoading(false);
      if (found.length === 0) {
        setMsg('Nenhuma impressora na rede. Digite o IP manualmente abaixo.');
      }
      return;
    }
    const { devices: list, error } = await listNativePrinters(listTransport);
    setDevices(list);
    setLoading(false);
    if (error) {
      setMsg(error);
      return;
    }
    if (native && list.length === 0) {
      setMsg(
        config.transport === 'usb'
          ? 'Nenhuma USB detectada. Use cabo OTG e toque Atualizar.'
          : 'Lista vazia: pareie a impressora em Ajustes → Bluetooth do tablet (não dentro do app). Depois toque Atualizar. A lista mostra todos os aparelhos pareados — escolha a impressora ou digite o MAC abaixo.',
      );
    }
  };

  const permitirBluetooth = async () => {
    setLoading(true);
    setMsg('');
    const err = await requestBluetoothAccess();
    if (err) {
      setMsg(err);
      setLoading(false);
      return;
    }
    await refreshDevices();
  };

  useEffect(() => {
    if (native && config.transport !== 'browser') refreshDevices();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ao mudar modo de conexão
  }, [native, config.transport]);

  const selectDevice = (d: ListedDevice) => {
    if (d.transport === 'bluetooth') {
      onChange({
        ...config,
        transport: 'bluetooth',
        deviceName: d.name,
        bluetoothAddress: d.address ?? '',
      });
      setManualMac(d.address ?? '');
    } else if (d.transport === 'usb') {
      onChange({
        ...config,
        transport: 'usb',
        deviceName: d.name,
        usbVendorId: d.vendorId,
        usbProductId: d.productId,
      });
    } else if (d.transport === 'tcp') {
      onChange({
        ...config,
        transport: 'tcp',
        deviceName: d.name,
        tcpHost: d.host ?? '',
        tcpPort: d.port ?? 9100,
      });
    }
    setMsg(`Selecionada: ${d.name}`);
  };

  const applyManualMac = () => {
    const mac = normalizeMac(manualMac);
    if (!isValidBluetoothMac(mac)) {
      setMsg('MAC inválido. Ex.: AA:BB:CC:DD:EE:FF');
      return;
    }
    onChange({
      ...config,
      transport: 'bluetooth',
      bluetoothAddress: mac,
      deviceName: config.deviceName || 'Bluetooth manual',
    });
    setMsg(`MAC salvo: ${mac}`);
  };

  const openBluetoothSettings = () => {
    window.open('intent:#Intent;action=android.settings.BLUETOOTH_SETTINGS;end', '_system');
  };

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <div className="bg-slate-800 border border-slate-700 rounded-3xl p-5 space-y-1">
        <h2 className="text-lg font-black">Impressora térmica</h2>
        <p className="text-xs text-slate-400">
          {native
            ? 'Tablet: Bluetooth (SPP), USB OTG ou IP na rede. Pareie Bluetooth no Android antes de imprimir.'
            : 'No PC: modo navegador. No tablet use o APK instalado.'}
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
          <option value="tcp">Rede Wi‑Fi / LAN (IP porta 9100)</option>
        </select>

        {config.transport === 'tcp' && (
          <div className="grid grid-cols-3 gap-2">
            <input
              value={config.tcpHost ?? ''}
              onChange={(e) => onChange({ ...config, tcpHost: e.target.value })}
              placeholder="IP ex. 192.168.0.50"
              className="col-span-2 bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-sm font-mono"
            />
            <input
              type="number"
              value={config.tcpPort ?? 9100}
              onChange={(e) => onChange({ ...config, tcpPort: Number(e.target.value) || 9100 })}
              className="bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-sm font-mono"
            />
          </div>
        )}

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
            {config.tcpHost ? ` (${config.tcpHost}:${config.tcpPort ?? 9100})` : ''}
          </p>
        )}
      </div>

      {native && config.transport === 'bluetooth' && (
        <div className="bg-amber-500/10 border border-amber-500/40 rounded-2xl p-4 space-y-2 text-xs text-amber-100 leading-relaxed">
          <p className="font-black text-amber-200">Antes da lista</p>
          <ol className="list-decimal list-inside space-y-1 text-slate-300">
            <li>Ligue a impressora 58mm</li>
            <li>Android → <strong>Bluetooth</strong> → parear (PIN 0000 ou 1234)</li>
            <li>Aqui: <strong>Permitir Bluetooth</strong> → <strong>Atualizar lista</strong></li>
          </ol>
          <button
            type="button"
            disabled={loading}
            onClick={() => void permitirBluetooth()}
            className="w-full py-2.5 mt-2 bg-indigo-600 rounded-xl font-bold text-sm text-white"
          >
            Permitir Bluetooth e buscar
          </button>
        </div>
      )}

      {native && config.transport === 'bluetooth' && (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 space-y-3">
          <p className="text-[10px] font-bold text-slate-400 uppercase">MAC manual (se não aparecer na lista)</p>
          <div className="flex gap-2">
            <input
              value={manualMac}
              onChange={(e) => setManualMac(e.target.value)}
              placeholder="AA:BB:CC:DD:EE:FF"
              className="flex-1 bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-sm font-mono uppercase"
            />
            <button
              type="button"
              onClick={applyManualMac}
              className="px-3 py-2 bg-indigo-600 rounded-xl text-xs font-bold"
            >
              Salvar MAC
            </button>
          </div>
          <button
            type="button"
            onClick={openBluetoothSettings}
            className="text-xs font-bold text-indigo-400 underline"
          >
            Abrir Ajustes Bluetooth do Android
          </button>
        </div>
      )}

      {native && config.transport !== 'browser' && (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 space-y-3">
          <div className="flex flex-wrap gap-2 justify-between items-center">
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
          setMsg('');
          const perm = await requestPrinterPermissions(config);
          if (perm) {
            setMsg(perm);
            return;
          }
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
          Bluetooth/USB/rede no tablet: gere e instale o APK (`docs/APK-PDV.md`).
        </p>
      )}
    </div>
  );
}

export { DEFAULT_PRINTER_CONFIG };
