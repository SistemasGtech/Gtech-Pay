-- Usuários convidados pelo dashboard entram sem esperar e-mail de confirmação.
-- Reenviar o cadastro (ou o limite de e-mail) volta a vincular quem já existe no Auth.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
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

    update auth.users
    set email_confirmed_at = coalesce(email_confirmed_at, now()),
        confirmation_token = ''
    where id = new.id;

    return new;
  end if;

  insert into public.stores (nome) values ('DOCERIA & CHURROS') returning id into new_store_id;
  insert into public.profiles (id, store_id, role, email)
  values (new.id, new_store_id, 'admin', new.email);
  insert into public.senha_config (store_id) values (new_store_id);
  return new;
end;
$$;

create or replace function public.attach_store_member_by_email(
  p_email text,
  p_role text default 'operador'
)
returns json
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  sid uuid;
  uid uuid;
  r text;
  em text := lower(trim(p_email));
begin
  if em = '' then
    raise exception 'Informe o e-mail';
  end if;

  select me.store_id into sid
  from public.profiles me
  where me.id = auth.uid() and me.role = 'admin';

  if sid is null then
    raise exception 'Apenas administradores podem vincular usuários';
  end if;

  r := coalesce(nullif(trim(p_role), ''), 'operador');
  if r not in ('admin', 'operador') then
    raise exception 'Papel inválido';
  end if;

  select u.id into uid from auth.users u where lower(u.email) = em;
  if uid is null then
    raise exception 'E-mail não encontrado no Auth. Crie o usuário no Supabase ou use Novo usuário aqui.';
  end if;

  insert into public.profiles (id, store_id, role, email)
  values (uid, sid, r, trim(p_email))
  on conflict (id) do update
    set store_id = excluded.store_id,
        role = excluded.role,
        email = excluded.email;

  update auth.users
  set email_confirmed_at = coalesce(email_confirmed_at, now()),
      confirmation_token = ''
  where id = uid;

  return json_build_object('id', uid, 'email', trim(p_email), 'role', r);
end;
$$;

grant execute on function public.attach_store_member_by_email(text, text) to authenticated;
