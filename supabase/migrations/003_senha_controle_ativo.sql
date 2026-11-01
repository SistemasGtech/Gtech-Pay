alter table public.senha_config
  add column if not exists controle_ativo boolean not null default true;

create or replace function public.pdv_get_config(p_store_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  loja json;
  ops json;
  senha json;
begin
  if not exists (select 1 from stores where id = p_store_id) then
    raise exception 'Loja não encontrada';
  end if;

  select json_build_object(
    'nome', s.nome,
    'endereco', s.endereco,
    'telefone', s.telefone,
    'cnpj', s.cnpj
  ) into loja from stores s where s.id = p_store_id;

  select coalesce(json_agg(json_build_object(
    'id', o.id,
    'nome', o.nome,
    'cargo', o.cargo,
    'cor', o.cor,
    'iniciais', o.iniciais
  ) order by o.nome), '[]'::json) into ops
  from operadores o where o.store_id = p_store_id and o.ativo = true;

  select json_build_object(
    'proximaSenha', sc.proxima_senha,
    'minimo', sc.minimo,
    'maximo', sc.maximo,
    'incrementoAutomatico', sc.incremento_automatico,
    'reiniciarACadaDia', sc.reiniciar_cada_dia,
    'ultimaDataOperacao', sc.ultima_data_operacao,
    'controleAtivo', sc.controle_ativo
  ) into senha from senha_config sc where sc.store_id = p_store_id;

  return json_build_object('loja', loja, 'operadores', ops, 'senhaConfig', senha);
end;
$$;

create or replace function public.pdv_update_senha_config(p_store_id uuid, p_config jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into senha_config (
    store_id, proxima_senha, minimo, maximo, incremento_automatico, reiniciar_cada_dia, ultima_data_operacao, controle_ativo
  ) values (
    p_store_id,
    coalesce((p_config->>'proximaSenha')::int, 1),
    coalesce((p_config->>'minimo')::int, 1),
    coalesce((p_config->>'maximo')::int, 99),
    coalesce((p_config->>'incrementoAutomatico')::boolean, true),
    coalesce((p_config->>'reiniciarACadaDia')::boolean, true),
    nullif(p_config->>'ultimaDataOperacao', '')::date,
    coalesce((p_config->>'controleAtivo')::boolean, true)
  )
  on conflict (store_id) do update set
    proxima_senha = excluded.proxima_senha,
    minimo = excluded.minimo,
    maximo = excluded.maximo,
    incremento_automatico = excluded.incremento_automatico,
    reiniciar_cada_dia = excluded.reiniciar_cada_dia,
    ultima_data_operacao = excluded.ultima_data_operacao,
    controle_ativo = excluded.controle_ativo;
end;
$$;
