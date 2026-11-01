# Gerar APK — Gtech PDV (tablet)

## Pré-requisitos (Windows)

1. **Node** — já usado no projeto (`npm install` na raiz).
2. **Android Studio** — instala o **Android SDK** e aceite as licenças.
3. **Java 17+** — Capacitor 7 / Gradle recente preferem JDK 17. No Android Studio: **Settings → Build → Gradle → Gradle JDK → 17**.
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

1. Abra o app → cole o **ID da loja** (dashboard → Loja) se não usou `VITE_STORE_ID`.
2. Operador + PIN → **Salvar PIN** (com internet uma vez).
3. Impressora: aba **Impressora** no PDV.

O app fala com **Supabase**, não com a URL do GitHub Pages.

---

## Impressora no tablet (importante)

Depois de atualizar o código do PDV, **gere um APK novo** (`cap sync` inclui o plugin `@devlas/capacitor-thermal-printer`).

No app: aba **Impressora** → pareie a impressora em **Ajustes → Bluetooth** → **Atualizar lista** ou **Salvar MAC** → **Imprimir cupom de teste**.

Modos: **Bluetooth**, **USB OTG** ou **IP na rede** (porta 9100). Na raiz do projeto, após `npm install`, o script `link-pdv-plugins` liga o plugin nativo no monorepo.
