-- Vincular ao Auth usuário já criado (ex.: painel Supabase) à loja do admin

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

  return json_build_object('id', uid, 'email', trim(p_email), 'role', r);
end;
$$;

grant execute on function public.attach_store_member_by_email(text, text) to authenticated;
