# Supabase — Gtech PDV

## Projeto na nuvem

| Campo | Valor |
|--------|--------|
| **Nome** | Gtech PDV |
| **Região** | sa-east-1 (São Paulo) |
| **Project ref** | `psfkpbicgqsadmkwusau` |
| **URL** | https://psfkpbicgqsadmkwusau.supabase.co |
| **Painel** | https://supabase.com/dashboard/project/psfkpbicgqsadmkwusau |

Schema aplicado: `supabase/migrations/001_initial_schema.sql`

## Configurar o dashboard local

Arquivo `apps/dashboard/.env.local` (já criado, não vai pro git):

```env
VITE_SUPABASE_URL=https://psfkpbicgqsadmkwusau.supabase.co
VITE_SUPABASE_ANON_KEY=sua_chave_anon
```

Reinicie o Vite após alterar o `.env`:

```powershell
npm run dashboard
```

## Primeiro acesso

1. Abra http://localhost:5174/
2. Clique em **Criar conta admin**
3. Use seu **e-mail** e uma senha (mín. 6 caracteres)
4. Se o Supabase pedir confirmação de e-mail: em **Authentication → Providers → Email**, desative *Confirm email* para testes, ou confirme o link no e-mail
5. Ao cadastrar, o banco cria automaticamente: **loja**, **perfil admin** e **config de senha**

Login: **e-mail + senha** (não usa mais `admin`/`123` quando a nuvem está ativa).

**Esqueceu a senha:** envia link por e-mail (Supabase Auth).

## Publicar dashboard online (GitHub Pages — recomendado)

Incluído no repo: workflow `.github/workflows/deploy-dashboard-pages.yml`.

1. Envie o código para o GitHub (`main`).
2. No repositório: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. **Settings → Secrets and variables → Actions → New repository secret:**
   - `VITE_SUPABASE_URL` — ex. `https://psfkpbicgqsadmkwusau.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` — chave **anon** do projeto
4. **Actions** → rode *Deploy dashboard (GitHub Pages)* ou faça push na `main`.
5. URL do site (repo **Gtech-Pay**): `https://SEU_USUARIO.github.io/Gtech-Pay/` — respeite maiúsculas/minúsculas do nome do repo.
6. No Supabase: **Authentication → URL Configuration** → *Site URL* e *Redirect URLs* com essa URL (com barra no final).

## Publicar dashboard online (Vercel ou outro)

Alternativa ao Pages: build `npm run dashboard:build`, pasta `apps/dashboard/dist`, mesmas variáveis `VITE_*`. No Supabase Auth, use a URL pública do host.

## Tabelas principais

- `stores`, `profiles` — loja e vínculo com usuário Auth
- `operadores`, `categorias`, `complementos`, `complemento_opcoes`, `produtos`
- `vendas`, `venda_itens` — histórico
- `senha_config` — fila de senhas (sincronizada com o PDV)

RLS: cada usuário logado só vê dados da **própria loja**. O PDV usa RPCs `pdv_*` (migration `002_pdv_rpc.sql`) com **anon key + ID da loja**.

## Conectar o app PDV (tablet)

1. Copie `apps/pdv/.env.example` → `apps/pdv/.env.local` (mesma URL e anon key do dashboard)
2. No dashboard logado na nuvem: menu **Loja** → copie o **ID da loja**
3. Rode `npm run pdv` e, na primeira abertura, cole o UUID na tela **Conectar loja** (fica salvo no tablet)
4. Cadastros (itens, operadores, senha) vêm do dashboard; vendas e senha atualizam a nuvem em tempo real

Opcional no `.env.local` do PDV: `VITE_STORE_ID=<uuid>` para pular a tela de colar ID.

Login no PDV: escolha operador + PIN cadastrado no dashboard (validação via `pdv_verify_pin`).
