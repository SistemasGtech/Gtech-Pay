# Gerar APK — Gtech PDV (tablet)

## Pré-requisitos (Windows)

1. **Node** — já usado no projeto (`npm install` na raiz).
2. **Android Studio** — instala o **Android SDK** e aceite as licenças.
3. **Java para Gradle** — erro `major version 69` = Java 25 (JBR do Android Studio novo). Em `apps/pdv/android/gradle.properties` use **JDK 21** (ex.: Temurin em `C:\Program Files\Eclipse Adoptium\jdk-21.0.13.9-hotspot`). No Android Studio: **Gradle JDK → 21**, não o Embedded JBR 25.
4. **`apps/pdv/.env.local`** — mesma `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` do dashboard (entram **no build** do APK).

Opcional: `VITE_STORE_ID=<uuid-da-loja>` para já abrir conectado à loja.

---

## Passo a passo (PowerShell)

Na pasta do monorepo:

```powershell
cd C:\Users\guilh\Desktop\Programa
npm install
npm run pdv:build
cd apps\pdv
npx cap sync android
```

### Opção A — Android Studio (recomendado)

```powershell
npm run pdv:android
```

1. Na primeira vez: **SDK Manager** → instale **Android SDK Platform 35** e **Build-Tools 34** → aceite licenças.
2. **Settings → Build → Gradle → Gradle JDK:** **Embedded JDK** (do Android Studio) ou **17+**.
3. **Build → Build Bundle(s) / APK(s) → Build APK(s)**.

### Opção B — linha de comando

```powershell
cd apps\pdv\android
.\gradlew.bat assembleDebug
```

APK:

`apps\pdv\android\app\build\outputs\apk\debug\app-debug.apk`

---

## Atalho (depois que `android/` existe)

```powershell
cd C:\Users\guilh\Desktop\Programa
npm run pdv:apk
```

---

## APK de loja (release)

1. Android Studio: `npm run pdv:android` → **Build → Generate Signed Bundle / APK**.
2. Crie um keystore e guarde a senha em local seguro.
3. Use variante **release** para Play Store ou distribuição fixa.

---

## No tablet (primeira vez)

1. Abra o **Gtech PDV** → entre com o **mesmo e-mail e senha** do dashboard (Supabase).
2. A loja é vinculada automaticamente à sua conta (não precisa colar UUID).
3. Impressora: aba **Impressora** no PDV.

O app usa **Supabase com sessão autenticada** (mais seguro que só ID da loja + PIN).

---

## Impressora no tablet (importante)

Depois de atualizar o código do PDV, **gere um APK novo** (`cap sync` inclui o plugin `@devlas/capacitor-thermal-printer`).

No app: aba **Impressora** → pareie a impressora em **Ajustes → Bluetooth** → **Atualizar lista** ou **Salvar MAC** → **Imprimir cupom de teste**.

Modos: **Bluetooth**, **USB OTG** ou **IP na rede** (porta 9100). Na raiz do projeto, após `npm install`, o script `link-pdv-plugins` liga o plugin nativo no monorepo.

---

## Atualizar o PDV pelo próprio app (tablet)

1. No tablet: aba **Atualizar** → **Verificar atualização** → se houver versão nova, **Baixar e instalar**.
2. O app consulta primeiro o **Supabase** (`pdv_get_app_update`) — mesma URL do `.env.local` do PDV. Opcional: `pdv-latest.json` no GitHub Pages após push na `main`. Campo manual na aba Atualizar sobrescreve tudo.
3. **Publicar uma versão nova:**
   - Em `apps/pdv/android/app/build.gradle`, aumente `versionCode` (inteiro, sempre maior) e `versionName`.
   - Gere o APK (`npm run pdv:build`, `cap sync`, `assembleDebug` ou release).
   - Crie um **GitHub Release** com tag (ex.: `pdv-1.0.9`) e anexe o APK; copie a URL direta do arquivo.
   - Atualize `docs/pdv-latest.json` e/ou a linha em **`pdv_app_release`** no Supabase (`version_code`, `version_name`, `apk_url`).
4. **Primeira vez com o botão:** instale manualmente um APK que já inclua o plugin `GtechAppUpdate` (versão com aba Atualizar). Depois disso, as próximas versões podem vir só pela aba.
5. No Android 8+, na primeira instalação “por fora” da Play Store, aceite **Instalar apps desconhecidos** para o Gtech PDV quando o sistema pedir.

---

## Barra de status / barra de apps sobre o PDV

Em tablets com **Android 15** e `targetSdk 35`, o sistema pode desenhar o app “por baixo” do relógio e dos botões de navegação. O PDV corrige isso no `MainActivity` (reserva espaço para as barras) e no CSS (`safe-area-inset`). Se ainda aparecer sobreposto, gere um **APK novo** após `cap sync`.
