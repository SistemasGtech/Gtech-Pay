-- RPCs para o app PDV (anon key + store_id conhecido do tablet)

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
    'ultimaDataOperacao', sc.ultima_data_operacao
  ) into senha from senha_config sc where sc.store_id = p_store_id;

  return json_build_object('loja', loja, 'operadores', ops, 'senhaConfig', senha);
end;
$$;

create or replace function public.pdv_get_catalog(p_store_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  cats json;
  comps json;
  prods json;
begin
  if not exists (select 1 from stores where id = p_store_id) then
    raise exception 'Loja não encontrada';
  end if;

  select coalesce(json_agg(json_build_object('id', c.id, 'nome', c.nome, 'cor', c.cor) order by c.nome), '[]'::json)
  into cats from categorias c where c.store_id = p_store_id;

  select coalesce(json_agg(
    json_build_object(
      'id', cm.id,
      'nome', cm.nome,
      'opcoes', (
        select coalesce(json_agg(json_build_object('id', o.id, 'nome', o.nome, 'preco', o.preco) order by o.nome), '[]'::json)
        from complemento_opcoes o where o.complemento_id = cm.id
      )
    ) order by cm.nome
  ), '[]'::json)
  into comps from complementos cm where cm.store_id = p_store_id;

  select coalesce(json_agg(
    json_build_object(
      'id', p.id,
      'nome', p.nome,
      'categoriaId', p.categoria_id,
      'preco', p.preco,
      'ativo', p.ativo,
      'complementoIds', (
        select coalesce(json_agg(pc.complemento_id), '[]'::json)
        from produto_complementos pc where pc.produto_id = p.id
      )
    ) order by p.nome
  ), '[]'::json)
  into prods from produtos p where p.store_id = p_store_id;

  return json_build_object('categorias', cats, 'complementos', comps, 'produtos', prods);
end;
$$;

create or replace function public.pdv_verify_pin(p_store_id uuid, p_operador_id uuid, p_pin text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  op operadores%rowtype;
begin
  select * into op from operadores
  where store_id = p_store_id and id = p_operador_id and ativo = true and pin = p_pin
  limit 1;

  if not found then
    raise exception 'PIN incorreto';
  end if;

  return json_build_object(
    'id', op.id,
    'nome', op.nome,
    'cargo', op.cargo,
    'cor', op.cor,
    'iniciais', op.iniciais,
    'pin', op.pin
  );
end;
$$;

create or replace function public.pdv_register_sale(p_store_id uuid, p_venda jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  item jsonb;
begin
  if not exists (select 1 from stores where id = p_store_id) then
    raise exception 'Loja não encontrada';
  end if;

  v_id := coalesce((p_venda->>'id')::uuid, gen_random_uuid());

  insert into vendas (
    id, store_id, senha, comanda, cliente, data_venda, hora, pagamento,
    total, troco, valor_recebido, operador_id, operador_nome, vendido_em
  ) values (
    v_id,
    p_store_id,
    p_venda->>'senha',
    coalesce(p_venda->>'comanda', p_venda->>'senha'),
    coalesce(p_venda->>'cliente', 'Cliente Balcão'),
    p_venda->>'data',
    p_venda->>'hora',
    p_venda->>'pagamento',
    (p_venda->>'total')::numeric,
    coalesce((p_venda->>'troco')::numeric, 0),
    coalesce((p_venda->>'valorRecebido')::numeric, (p_venda->>'total')::numeric),
    nullif(p_venda->>'operadorId', '')::uuid,
    p_venda->>'operadorNome',
    coalesce((p_venda->>'timestamp')::bigint, (extract(epoch from now()) * 1000)::bigint)
  );

  for item in select * from jsonb_array_elements(coalesce(p_venda->'itens', '[]'::jsonb))
  loop
    insert into venda_itens (
      id, venda_id, produto_id, nome, preco_base, preco_unitario, quantidade, subtotal, observacao, opcoes
    ) values (
      coalesce((item->>'carrinhoItemId')::uuid, gen_random_uuid()),
      v_id,
      nullif(item->>'produtoId', '')::uuid,
      item->>'nome',
      (item->>'precoBase')::numeric,
      (item->>'precoUnitario')::numeric,
      coalesce((item->>'quantidade')::int, 1),
      (item->>'subtotal')::numeric,
      coalesce(item->>'observacao', ''),
      coalesce(item->'opcoes', '[]'::jsonb)
    );
  end loop;

  return v_id;
end;
$$;

create or replace function public.pdv_list_sales(p_store_id uuid, p_limit int default 100)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  result json;
begin
  select coalesce(json_agg(v order by (v->>'timestamp')::bigint desc), '[]'::json)
  into result
  from (
    select json_build_object(
      'id', va.id,
      'senha', va.senha,
      'comanda', va.comanda,
      'cliente', va.cliente,
      'data', va.data_venda,
      'hora', va.hora,
      'pagamento', va.pagamento,
      'total', va.total,
      'troco', va.troco,
      'valorRecebido', va.valor_recebido,
      'timestamp', va.vendido_em,
      'operadorId', va.operador_id,
      'operadorNome', va.operador_nome,
      'itens', (
        select coalesce(json_agg(json_build_object(
          'carrinhoItemId', vi.id,
          'produtoId', vi.produto_id,
          'nome', vi.nome,
          'precoBase', vi.preco_base,
          'precoUnitario', vi.preco_unitario,
          'quantidade', vi.quantidade,
          'subtotal', vi.subtotal,
          'observacao', vi.observacao,
          'opcoes', vi.opcoes
        )), '[]'::json)
        from venda_itens vi where vi.venda_id = va.id
      )
    ) as v
    from vendas va
    where va.store_id = p_store_id
    order by va.vendido_em desc
    limit p_limit
  ) sub;

  return result;
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
    store_id, proxima_senha, minimo, maximo, incremento_automatico, reiniciar_cada_dia, ultima_data_operacao
  ) values (
    p_store_id,
    coalesce((p_config->>'proximaSenha')::int, 1),
    coalesce((p_config->>'minimo')::int, 1),
    coalesce((p_config->>'maximo')::int, 99),
    coalesce((p_config->>'incrementoAutomatico')::boolean, true),
    coalesce((p_config->>'reiniciarACadaDia')::boolean, true),
    nullif(p_config->>'ultimaDataOperacao', '')::date
  )
  on conflict (store_id) do update set
    proxima_senha = excluded.proxima_senha,
    minimo = excluded.minimo,
    maximo = excluded.maximo,
    incremento_automatico = excluded.incremento_automatico,
    reiniciar_cada_dia = excluded.reiniciar_cada_dia,
    ultima_data_operacao = excluded.ultima_data_operacao;
end;
$$;

grant execute on function public.pdv_get_config(uuid) to anon, authenticated;
grant execute on function public.pdv_get_catalog(uuid) to anon, authenticated;
grant execute on function public.pdv_verify_pin(uuid, uuid, text) to anon, authenticated;
grant execute on function public.pdv_register_sale(uuid, jsonb) to anon, authenticated;
grant execute on function public.pdv_list_sales(uuid, int) to anon, authenticated;
grant execute on function public.pdv_update_senha_config(uuid, jsonb) to anon, authenticated;
