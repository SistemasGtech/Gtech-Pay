-- Gtech PDV — schema inicial (multi-loja via store_id)

create extension if not exists "pgcrypto";

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  nome text not null default 'Minha Loja',
  endereco text not null default '',
  telefone text not null default '',
  cnpj text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  store_id uuid not null references public.stores (id) on delete cascade,
  role text not null default 'admin' check (role in ('admin', 'operador')),
  created_at timestamptz not null default now()
);

create table public.operadores (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  nome text not null,
  cargo text not null default '',
  pin text not null,
  email text,
  cor text not null default '#6366f1',
  iniciais text not null default 'OP',
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.categorias (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  nome text not null,
  cor text not null default '#6366f1',
  created_at timestamptz not null default now()
);

create table public.complementos (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  nome text not null,
  created_at timestamptz not null default now()
);

create table public.complemento_opcoes (
  id uuid primary key default gen_random_uuid(),
  complemento_id uuid not null references public.complementos (id) on delete cascade,
  nome text not null,
  preco numeric(12, 2) not null default 0
);

create table public.produtos (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  categoria_id uuid references public.categorias (id) on delete set null,
  nome text not null,
  preco numeric(12, 2) not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.produto_complementos (
  produto_id uuid not null references public.produtos (id) on delete cascade,
  complemento_id uuid not null references public.complementos (id) on delete cascade,
  primary key (produto_id, complemento_id)
);

create table public.vendas (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  senha text not null,
  comanda text,
  cliente text not null default 'Cliente Balcão',
  data_venda text not null,
  hora text not null,
  pagamento text not null,
  total numeric(12, 2) not null default 0,
  troco numeric(12, 2) not null default 0,
  valor_recebido numeric(12, 2) not null default 0,
  operador_id uuid references public.operadores (id) on delete set null,
  operador_nome text,
  vendido_em bigint not null,
  created_at timestamptz not null default now()
);

create table public.venda_itens (
  id uuid primary key default gen_random_uuid(),
  venda_id uuid not null references public.vendas (id) on delete cascade,
  produto_id uuid,
  nome text not null,
  preco_base numeric(12, 2),
  preco_unitario numeric(12, 2) not null,
  quantidade int not null default 1,
  subtotal numeric(12, 2) not null,
  observacao text not null default '',
  opcoes jsonb not null default '[]'::jsonb
);

create table public.senha_config (
  store_id uuid primary key references public.stores (id) on delete cascade,
  proxima_senha int not null default 1,
  minimo int not null default 1,
  maximo int not null default 99,
  incremento_automatico boolean not null default true,
  reiniciar_cada_dia boolean not null default true,
  ultima_data_operacao date
);

create or replace function public.current_store_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select store_id from public.profiles where id = auth.uid()
$$;

alter table public.stores enable row level security;
alter table public.profiles enable row level security;
alter table public.operadores enable row level security;
alter table public.categorias enable row level security;
alter table public.complementos enable row level security;
alter table public.complemento_opcoes enable row level security;
alter table public.produtos enable row level security;
alter table public.produto_complementos enable row level security;
alter table public.vendas enable row level security;
alter table public.venda_itens enable row level security;
alter table public.senha_config enable row level security;

create policy profiles_select_own on public.profiles for select to authenticated using (id = auth.uid());

create policy stores_select on public.stores for select to authenticated using (id = public.current_store_id());
create policy stores_update on public.stores for update to authenticated using (id = public.current_store_id());

create policy operadores_all on public.operadores for all to authenticated
  using (store_id = public.current_store_id()) with check (store_id = public.current_store_id());

create policy categorias_all on public.categorias for all to authenticated
  using (store_id = public.current_store_id()) with check (store_id = public.current_store_id());

create policy complementos_all on public.complementos for all to authenticated
  using (store_id = public.current_store_id()) with check (store_id = public.current_store_id());

create policy complemento_opcoes_all on public.complemento_opcoes for all to authenticated
  using (exists (
    select 1 from public.complementos c
    where c.id = complemento_id and c.store_id = public.current_store_id()
  ))
  with check (exists (
    select 1 from public.complementos c
    where c.id = complemento_id and c.store_id = public.current_store_id()
  ));

create policy produtos_all on public.produtos for all to authenticated
  using (store_id = public.current_store_id()) with check (store_id = public.current_store_id());

create policy produto_complementos_all on public.produto_complementos for all to authenticated
  using (exists (
    select 1 from public.produtos p where p.id = produto_id and p.store_id = public.current_store_id()
  ))
  with check (exists (
    select 1 from public.produtos p where p.id = produto_id and p.store_id = public.current_store_id()
  ));

create policy vendas_all on public.vendas for all to authenticated
  using (store_id = public.current_store_id()) with check (store_id = public.current_store_id());

create policy venda_itens_all on public.venda_itens for all to authenticated
  using (exists (
    select 1 from public.vendas v where v.id = venda_id and v.store_id = public.current_store_id()
  ))
  with check (exists (
    select 1 from public.vendas v where v.id = venda_id and v.store_id = public.current_store_id()
  ));

create policy senha_config_all on public.senha_config for all to authenticated
  using (store_id = public.current_store_id()) with check (store_id = public.current_store_id());

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_store_id uuid;
begin
  insert into public.stores (nome) values ('DOCERIA & CHURROS') returning id into new_store_id;
  insert into public.profiles (id, store_id, role) values (new.id, new_store_id, 'admin');
  insert into public.senha_config (store_id) values (new_store_id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
