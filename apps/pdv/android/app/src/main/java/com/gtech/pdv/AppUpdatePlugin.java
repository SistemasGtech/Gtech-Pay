package com.gtech.pdv;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "GtechAppUpdate")
public class AppUpdatePlugin extends Plugin {

    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    @PluginMethod
    public void getInstalledVersion(PluginCall call) {
        try {
            android.content.pm.PackageInfo info = getContext()
                .getPackageManager()
                .getPackageInfo(getContext().getPackageName(), 0);
            JSObject ret = new JSObject();
            ret.put("versionName", info.versionName != null ? info.versionName : "?");
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                ret.put("versionCode", info.getLongVersionCode());
            } else {
                ret.put("versionCode", info.versionCode);
            }
            call.resolve(ret);
        } catch (Exception e) {
            call.reject(e.getMessage() != null ? e.getMessage() : "Versao indisponivel");
        }
    }

    @PluginMethod
    public void fetchManifest(PluginCall call) {
        String urlString = call.getString("url");
        if (urlString == null || urlString.isEmpty()) {
            call.reject("URL do manifest invalida");
            return;
        }
        executor.execute(() -> {
            HttpURLConnection conn = null;
            try {
                URL url = new URL(urlString);
                conn = (HttpURLConnection) url.openConnection();
                conn.setConnectTimeout(30_000);
                conn.setReadTimeout(30_000);
                conn.setInstanceFollowRedirects(true);
                conn.setRequestProperty("Accept", "application/json");
                conn.connect();
                int code = conn.getResponseCode();
                InputStream in = code >= 200 && code < 300 ? conn.getInputStream() : conn.getErrorStream();
                String body = readStream(in);
                JSObject ret = new JSObject();
                ret.put("statusCode", code);
                ret.put("body", body != null ? body : "");
                call.resolve(ret);
            } catch (Exception e) {
                call.reject(e.getMessage() != null ? e.getMessage() : "Falha ao baixar manifest", e);
            } finally {
                if (conn != null) {
                    conn.disconnect();
                }
            }
        });
    }

    private static String readStream(InputStream in) throws Exception {
        if (in == null) {
            return "";
        }
        try (InputStream stream = in; ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buf = new byte[8192];
            int n;
            while ((n = stream.read(buf)) >= 0) {
                out.write(buf, 0, n);
            }
            return out.toString("UTF-8");
        }
    }

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.isEmpty()) {
            call.reject("URL do APK invalida");
            return;
        }
        executor.execute(() -> {
            try {
                File apk = downloadApk(url);
                bridge
                    .getActivity()
                    .runOnUiThread(() -> {
                        try {
                            openInstallIntent(apk);
                            call.resolve();
                        } catch (Exception e) {
                            call.reject(e.getMessage() != null ? e.getMessage() : "Falha ao abrir instalador");
                        }
                    });
            } catch (Exception e) {
                call.reject(e.getMessage() != null ? e.getMessage() : "Falha no download", e);
            }
        });
    }

    private File downloadApk(String urlString) throws Exception {
        URL url = new URL(urlString);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setConnectTimeout(30_000);
        conn.setReadTimeout(120_000);
        conn.setInstanceFollowRedirects(true);
        conn.connect();
        int code = conn.getResponseCode();
        if (code < 200 || code >= 300) {
            throw new Exception("Download HTTP " + code);
        }
        File dir = getContext().getCacheDir();
        File out = new File(dir, "gtech-pdv-update.apk");
        if (out.exists()) {
            //noinspection ResultOfMethodCallIgnored
            out.delete();
        }
        try (InputStream in = conn.getInputStream(); FileOutputStream fos = new FileOutputStream(out)) {
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) >= 0) {
                fos.write(buf,  0, n);
            }
        } finally {
            conn.disconnect();
        }
        return out;
    }

    private void openInstallIntent(File apk) {
        Activity activity = getActivity();
        if (activity == null) {
            throw new IllegalStateException("Activity indisponivel");
        }
        String authority = getContext().getPackageName() + ".fileprovider";
        Uri uri = FileProvider.getUriForFile(getContext(), authority, apk);
        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setDataAndType(uri, "application/vnd.android.package-archive");
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        activity.startActivity(intent);
    }
}
