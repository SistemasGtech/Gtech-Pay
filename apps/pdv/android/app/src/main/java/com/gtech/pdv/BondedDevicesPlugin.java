package com.gtech.pdv;

import android.Manifest;
import android.annotation.SuppressLint;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothSocket;
import android.content.Context;
import android.content.pm.PackageManager;
import android.os.Build;
import android.util.Base64;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.IOException;
import java.io.OutputStream;
import java.lang.reflect.Method;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(
    name = "GtechBondedBluetooth",
    permissions = {
        @Permission(strings = { Manifest.permission.BLUETOOTH_CONNECT }, alias = "btConnect"),
        @Permission(strings = { Manifest.permission.BLUETOOTH_SCAN }, alias = "btScan"),
    }
)
public class BondedDevicesPlugin extends Plugin {

    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");
    private static final int CHUNK_SIZE = 512;
    private static final long CHUNK_GAP_MS = 20L;

    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    @PluginMethod
    public void ping(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("ok", true);
        ret.put("version", 8);
        call.resolve(ret);
    }

    @PluginMethod
    public void isConnectGranted(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("granted", hasAllBluetoothPrintPermissions());
        ret.put("connect", hasOsBluetoothConnectPermission());
        ret.put("scan", hasOsBluetoothScanPermission());
        call.resolve(ret);
    }

    @PluginMethod
    public void syncConnectPermission(PluginCall call) {
        if (hasAllBluetoothPrintPermissions()) {
            JSObject ok = new JSObject();
            ok.put("granted", true);
            call.resolve(ok);
            return;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (!hasOsBluetoothConnectPermission()) {
                requestPermissionForAlias("btConnect", call, "syncAfterConnect");
                return;
            }
            if (!hasOsBluetoothScanPermission()) {
                requestPermissionForAlias("btScan", call, "syncConnectPermCallback");
                return;
            }
        }
        JSObject ok = new JSObject();
        ok.put("granted", hasAllBluetoothPrintPermissions());
        call.resolve(ok);
    }

    @PermissionCallback
    private void syncAfterConnect(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !hasOsBluetoothScanPermission()) {
            requestPermissionForAlias("btScan", call, "syncConnectPermCallback");
            return;
        }
        JSObject ok = new JSObject();
        ok.put("granted", hasAllBluetoothPrintPermissions());
        call.resolve(ok);
    }

    @PluginMethod
    public void probeConnect(PluginCall call) {
        String address = call.getString("address");
        if (address == null || address.isEmpty()) {
            call.reject("Informe o MAC da impressora", "invalid_data");
            return;
        }
        if (!hasOsBluetoothConnectPermission()) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                requestPermissionForAlias("btConnect", call, "probeConnectPermCallback");
                return;
            }
            call.reject("Sem permissao BLUETOOTH_CONNECT", "permission_denied");
            return;
        }
        runProbeConnect(call, address);
    }

    @PermissionCallback
    private void probeConnectPermCallback(PluginCall call) {
        if (hasOsBluetoothConnectPermission()) {
            runProbeConnect(call, call.getString("address"));
        } else {
            call.reject("Permissao Bluetooth negada", "permission_denied");
        }
    }

    @PluginMethod
    public void printEscPos(PluginCall call) {
        String address = call.getString("address");
        String data = call.getString("data");
        if (address == null || address.isEmpty() || data == null || data.isEmpty()) {
            call.reject("Informe impressora (MAC) e dados", "invalid_data");
            return;
        }
        if (!hasAllBluetoothPrintPermissions()) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                requestPermissionForAlias("btConnect", call, "printEscPosPermCallback");
                return;
            }
            call.reject("Sem permissao BLUETOOTH_CONNECT", "permission_denied");
            return;
        }
        runPrintEscPos(call, address, data);
    }

    @PermissionCallback
    private void printEscPosPermCallback(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !hasOsBluetoothScanPermission()) {
            requestPermissionForAlias("btScan", call, "printEscPosPermCallback2");
            return;
        }
        if (hasAllBluetoothPrintPermissions()) {
            runPrintEscPos(call, call.getString("address"), call.getString("data"));
        } else {
            call.reject("Permissao Bluetooth negada (CONNECT e SCAN)", "permission_denied");
        }
    }

    @PermissionCallback
    private void printEscPosPermCallback2(PluginCall call) {
        if (hasAllBluetoothPrintPermissions()) {
            runPrintEscPos(call, call.getString("address"), call.getString("data"));
        } else {
            call.reject("Permissao Bluetooth negada (CONNECT e SCAN)", "permission_denied");
        }
    }

    private void runProbeConnect(PluginCall call, String address) {
        executor.execute(() -> {
            try {
                if (!hasAllBluetoothPrintPermissions()) {
                    call.reject(
                        "Permissao inativa. Libere Dispositivos por perto e Buscar dispositivos Bluetooth. Force parar o app.",
                        "permission_denied"
                    );
                    return;
                }
                BluetoothAdapter adapter = getAdapter();
                assertBonded(adapter, address);
                BluetoothDevice device = adapter.getRemoteDevice(address);
                try (BluetoothSocket socket = openSocket(device)) {
                    JSObject ok = new JSObject();
                    ok.put("ok", true);
                    ok.put("message", "Conexao SPP OK");
                    call.resolve(ok);
                }
            } catch (SecurityException e) {
                rejectSecurity(call, e);
            } catch (Exception e) {
                String msg = e.getMessage() != null ? e.getMessage() : "Falha ao conectar";
                call.reject(msg, "connect_failed");
            }
        });
    }

    private void runPrintEscPos(PluginCall call, String address, String dataBase64) {
        executor.execute(() -> {
            try {
                if (!hasAllBluetoothPrintPermissions()) {
                    call.reject(
                        "Permissao inativa. Libere Dispositivos por perto e Buscar dispositivos Bluetooth. Force parar o app.",
                        "permission_denied"
                    );
                    return;
                }
                byte[] bytes = Base64.decode(dataBase64, Base64.DEFAULT);
                BluetoothAdapter adapter = getAdapter();
                assertBonded(adapter, address);
                BluetoothDevice device = adapter.getRemoteDevice(address);
                try (BluetoothSocket socket = openSocket(device)) {
                    Thread.sleep(350L);
                    OutputStream out = socket.getOutputStream();
                    int offset = 0;
                    while (offset < bytes.length) {
                        int len = Math.min(CHUNK_SIZE, bytes.length - offset);
                        out.write(bytes, offset, len);
                        out.flush();
                        offset += len;
                        if (offset < bytes.length) {
                            Thread.sleep(CHUNK_GAP_MS);
                        }
                    }
                    long drain = Math.min(5000L, Math.max(500L, bytes.length / 32L));
                    Thread.sleep(drain);
                }
                call.resolve();
            } catch (SecurityException e) {
                rejectSecurity(call, e);
            } catch (Exception e) {
                String msg = e.getMessage() != null ? e.getMessage() : "Falha ao imprimir";
                call.reject(msg, "connect_failed");
            }
        });
    }

    @SuppressLint("MissingPermission")
    private void assertBonded(BluetoothAdapter adapter, String address) throws IOException {
        for (BluetoothDevice d : adapter.getBondedDevices()) {
            if (d.getAddress() != null && d.getAddress().equalsIgnoreCase(address)) {
                return;
            }
        }
        throw new IOException("Impressora nao pareada no Android (Ajustes - Bluetooth)");
    }

    private void rejectSecurity(PluginCall call, SecurityException e) {
        if (hasOsBluetoothConnectPermission()) {
            call.reject(
                "Conexao Bluetooth bloqueada: " + (e.getMessage() != null ? e.getMessage() : "SPP") +
                ". Confirme pareamento e MAC.",
                "connect_failed"
            );
        } else {
            call.reject("Sem permissao BLUETOOTH_CONNECT", "permission_denied");
        }
    }

    @SuppressLint("MissingPermission")
    private BluetoothSocket openSocket(BluetoothDevice device) throws IOException {
        BluetoothAdapter adapter = getAdapter();
        safeCancelDiscovery(adapter);
        IOException last = null;
        try {
            BluetoothSocket socket = device.createInsecureRfcommSocketToServiceRecord(SPP_UUID);
            socket.connect();
            return socket;
        } catch (IOException e) {
            last = e;
        }
        try {
            BluetoothSocket socket = device.createRfcommSocketToServiceRecord(SPP_UUID);
            socket.connect();
            return socket;
        } catch (IOException e) {
            last = e;
        }
        try {
            Method method = device.getClass().getMethod("createRfcommSocket", int.class);
            BluetoothSocket socket = (BluetoothSocket) method.invoke(device, 1);
            socket.connect();
            return socket;
        } catch (Exception e) {
            if (last != null) {
                throw last;
            }
            throw new IOException(e.getMessage() != null ? e.getMessage() : "RFCOMM falhou");
        }
    }

    private BluetoothAdapter getAdapter() throws IOException {
        Context ctx = getContext();
        BluetoothManager bm = (BluetoothManager) ctx.getSystemService(Context.BLUETOOTH_SERVICE);
        BluetoothAdapter adapter = bm != null ? bm.getAdapter() : null;
        if (adapter == null) {
            throw new IOException("Bluetooth desligado ou indisponivel");
        }
        return adapter;
    }

    @SuppressLint("MissingPermission")
    private void safeCancelDiscovery(BluetoothAdapter adapter) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (!hasOsBluetoothScanPermission()) {
                return;
            }
        }
        try {
            if (adapter.isDiscovering()) {
                adapter.cancelDiscovery();
            }
        } catch (SecurityException ignored) {
            /* sem BLUETOOTH_SCAN */
        }
    }

    private boolean hasOsBluetoothConnectPermission() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
            return true;
        }
        android.app.Activity activity = getActivity();
        Context ctx = activity != null ? activity : getContext();
        return (
            ContextCompat.checkSelfPermission(ctx, Manifest.permission.BLUETOOTH_CONNECT) ==
            PackageManager.PERMISSION_GRANTED
        );
    }

    private boolean hasOsBluetoothScanPermission() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
            return true;
        }
        android.app.Activity activity = getActivity();
        Context ctx = activity != null ? activity : getContext();
        return (
            ContextCompat.checkSelfPermission(ctx, Manifest.permission.BLUETOOTH_SCAN) ==
            PackageManager.PERMISSION_GRANTED
        );
    }

    private boolean hasAllBluetoothPrintPermissions() {
        return hasOsBluetoothConnectPermission() && hasOsBluetoothScanPermission();
    }

    @PermissionCallback
    private void syncConnectPermCallback(PluginCall call) {
        JSObject ok = new JSObject();
        ok.put("granted", hasAllBluetoothPrintPermissions());
        call.resolve(ok);
    }

    @PluginMethod
    public void listBonded(PluginCall call) {
        if (hasOsBluetoothConnectPermission()) {
            resolveBonded(call);
            return;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (getPermissionState("btConnect") != PermissionState.GRANTED) {
                requestPermissionForAlias("btConnect", call, "listBondedPermCallback");
                return;
            }
        }
        resolveBonded(call);
    }

    @PermissionCallback
    private void listBondedPermCallback(PluginCall call) {
        if (hasOsBluetoothConnectPermission() || getPermissionState("btConnect") == PermissionState.GRANTED) {
            resolveBonded(call);
        } else {
            call.reject("Permissao Bluetooth negada", "permission_denied");
        }
    }

    private void resolveBonded(PluginCall call) {
        try {
            BluetoothAdapter adapter = getAdapter();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                if (
                    ContextCompat.checkSelfPermission(getContext(), Manifest.permission.BLUETOOTH_CONNECT) !=
                    PackageManager.PERMISSION_GRANTED
                ) {
                    call.reject("Sem permissao BLUETOOTH_CONNECT", "permission_denied");
                    return;
                }
            }
            JSArray arr = new JSArray();
            for (BluetoothDevice device : adapter.getBondedDevices()) {
                JSObject o = new JSObject();
                o.put("name", device.getName() != null ? device.getName() : device.getAddress());
                o.put("address", device.getAddress());
                arr.put(o);
            }
            JSObject ret = new JSObject();
            ret.put("devices", arr);
            call.resolve(ret);
        } catch (IOException e) {
            call.reject(e.getMessage(), "unavailable");
        }
    }
}
