-- O PDV pedia só as últimas 100 vendas. Em dia cheio o resumo cortava o começo
-- do dia e ficava atrás do dashboard. O piso de 5000 vale mesmo para o app já instalado.

create or replace function public.pdv_list_sales(p_store_id uuid, p_limit int default 5000)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  result json;
  v_limit int := least(greatest(coalesce(p_limit, 100), 5000), 8000);
begin
  perform public.pdv_assert_store_for_caller(p_store_id);

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
    limit v_limit
  ) sub;

  return result;
end;
$$;
