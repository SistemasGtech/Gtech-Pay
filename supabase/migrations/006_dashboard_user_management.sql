-- Gestão de usuários no dashboard: e-mail no perfil, equipe da loja, convites

alter table public.profiles
  add column if not exists email text;

update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id and (p.email is null or p.email = '');

create table if not exists public.store_invites (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(16), 'hex'),
  role text not null default 'operador' check (role in ('admin', 'operador')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  used_at timestamptz
);

create index if not exists store_invites_store_id_idx on public.store_invites (store_id);

alter table public.store_invites enable row level security;

create policy store_invites_select on public.store_invites
  for select to authenticated
  using (
    store_id = public.current_store_id()
    and exists (select 1 from public.profiles me where me.id = auth.uid() and me.role = 'admin')
  );

create policy store_invites_delete on public.store_invites
  for delete to authenticated
  using (
    store_id = public.current_store_id()
    and used_at is null
    and exists (select 1 from public.profiles me where me.id = auth.uid() and me.role = 'admin')
  );

drop policy if exists profiles_select_own on public.profiles;

create policy profiles_select_store on public.profiles
  for select to authenticated
  using (store_id = public.current_store_id());

create policy profiles_update_admin on public.profiles
  for update to authenticated
  using (
    store_id = public.current_store_id()
    and exists (select 1 from public.profiles me where me.id = auth.uid() and me.role = 'admin')
    and id <> auth.uid()
  )
  with check (store_id = public.current_store_id());

create policy profiles_delete_admin on public.profiles
  for delete to authenticated
  using (
    store_id = public.current_store_id()
    and id <> auth.uid()
    and exists (select 1 from public.profiles me where me.id = auth.uid() and me.role = 'admin')
  );

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_store_id uuid;
  invite_token text := nullif(trim(new.raw_user_meta_data->>'invite_token'), '');
  inv public.store_invites%rowtype;
begin
  if invite_token is not null then
    select * into inv
    from public.store_invites
    where token = invite_token
      and used_at is null
      and expires_at > now()
    for update;

    if not found then
      raise exception 'Convite inválido ou expirado';
    end if;

    insert into public.profiles (id, store_id, role, email)
    values (new.id, inv.store_id, inv.role, new.email);

    update public.store_invites set used_at = now() where id = inv.id;
    return new;
  end if;

  insert into public.stores (nome) values ('DOCERIA & CHURROS') returning id into new_store_id;
  insert into public.profiles (id, store_id, role, email)
  values (new.id, new_store_id, 'admin', new.email);
  insert into public.senha_config (store_id) values (new_store_id);
  return new;
end;
$$;

create or replace function public.create_store_invite(p_role text default 'operador')
returns table (token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  sid uuid;
  r text := coalesce(nullif(trim(p_role), ''), 'operador');
begin
  if r not in ('admin', 'operador') then
    raise exception 'Papel inválido';
  end if;

  select me.store_id into sid
  from public.profiles me
  where me.id = auth.uid() and me.role = 'admin';

  if sid is null then
    raise exception 'Apenas administradores podem convidar';
  end if;

  return query
  insert into public.store_invites (store_id, role, created_by)
  values (sid, r, auth.uid())
  returning store_invites.token, store_invites.expires_at;
end;
$$;

grant execute on function public.create_store_invite(text) to authenticated;
