-- Editar e excluir vendas pelo PDV (recibos)

create or replace function public.pdv_update_sale(p_store_id uuid, p_venda jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  item jsonb;
begin
  perform public.pdv_assert_store_for_caller(p_store_id);

  v_id := (p_venda->>'id')::uuid;
  if v_id is null then
    raise exception 'Venda sem id';
  end if;

  if not exists (select 1 from vendas where id = v_id and store_id = p_store_id) then
    raise exception 'Venda não encontrada';
  end if;

  update vendas set
    senha = p_venda->>'senha',
    comanda = coalesce(p_venda->>'comanda', p_venda->>'senha'),
    cliente = coalesce(p_venda->>'cliente', 'Cliente Balcão'),
    data_venda = p_venda->>'data',
    hora = p_venda->>'hora',
    pagamento = p_venda->>'pagamento',
    total = (p_venda->>'total')::numeric,
    troco = coalesce((p_venda->>'troco')::numeric, 0),
    valor_recebido = coalesce((p_venda->>'valorRecebido')::numeric, (p_venda->>'total')::numeric),
    operador_id = nullif(p_venda->>'operadorId', '')::uuid,
    operador_nome = p_venda->>'operadorNome',
    vendido_em = coalesce((p_venda->>'timestamp')::bigint, vendido_em)
  where id = v_id and store_id = p_store_id;

  delete from venda_itens where venda_id = v_id;

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

create or replace function public.pdv_delete_sale(p_store_id uuid, p_venda_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.pdv_assert_store_for_caller(p_store_id);

  delete from vendas
  where id = p_venda_id and store_id = p_store_id;

  if not found then
    raise exception 'Venda não encontrada';
  end if;
end;
$$;

revoke execute on function public.pdv_update_sale(uuid, jsonb) from anon;
revoke execute on function public.pdv_delete_sale(uuid, uuid) from anon;
grant execute on function public.pdv_update_sale(uuid, jsonb) to authenticated;
grant execute on function public.pdv_delete_sale(uuid, uuid) to authenticated;
