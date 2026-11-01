# Gtech PDV + Dashboard

Monorepo: **dashboard** (painel web), **PDV** (tablet), **Supabase** (migrations/RPCs), pacote `@gtech/shared`.

## Dashboard (painel web)

```powershell
cd C:\Users\guilh\Desktop\Programa
npm install
copy apps\dashboard\.env.example apps\dashboard\.env.local
npm run dashboard
```

Abra **http://localhost:5174/** — configure Supabase em `apps/dashboard/.env.local` (veja `docs/SUPABASE.md`).

## App PDV (tablet)

```powershell
copy apps\pdv\.env.example apps\pdv\.env.local
npm run pdv
```

http://localhost:5173/

## GitHub + site online

Repositório: **Gtech-Pay** no GitHub.

1. Código na branch `main` desse repo.
2. **GitHub Pages** (Actions) — passo a passo em `docs/SUPABASE.md` + secrets `VITE_SUPABASE_*`.
3. Dashboard online: `https://SEU_USUARIO.github.io/Gtech-Pay/`
4. PDV no tablet: só **Supabase** + ID da loja (não usa a URL do Pages).
