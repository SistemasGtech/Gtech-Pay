package com.gtech.pdv;

import android.Manifest;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.Window;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private static final int REQUEST_BLUETOOTH = 44001;

    private static final int GTECH_BAR_COLOR = Color.parseColor("#0f172a");

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(BondedDevicesPlugin.class);
        registerPlugin(AppUpdatePlugin.class);
        getTheme().applyStyle(R.style.OptOutEdgeToEdgeEnforcement, false);
        super.onCreate(savedInstanceState);
        applyGtechSystemBars();
        promptBluetoothPermissions();
    }

    /** Mantém header e botões do PDV fora da barra de status e da barra de apps. */
    private void applyGtechSystemBars() {
        Window window = getWindow();
        WindowCompat.setDecorFitsSystemWindows(window, true);
        window.setStatusBarColor(GTECH_BAR_COLOR);
        window.setNavigationBarColor(GTECH_BAR_COLOR);
        WindowInsetsControllerCompat insets = WindowCompat.getInsetsController(window, window.getDecorView());
        if (insets != null) {
            insets.setAppearanceLightStatusBars(false);
            insets.setAppearanceLightNavigationBars(false);
        }
    }

    /** Android 12+: CONNECT (parear/imprimir) + SCAN (cancelDiscovery antes do SPP). */
    private void promptBluetoothPermissions() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
            return;
        }
        boolean needConnect =
            ContextCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_CONNECT) !=
            PackageManager.PERMISSION_GRANTED;
        boolean needScan =
            ContextCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_SCAN) !=
            PackageManager.PERMISSION_GRANTED;
        if (needConnect || needScan) {
            ActivityCompat.requestPermissions(
                this,
                new String[] {
                    Manifest.permission.BLUETOOTH_CONNECT,
                    Manifest.permission.BLUETOOTH_SCAN,
                },
                REQUEST_BLUETOOTH
            );
        }
    }
}
