-- Ordem dos grupos de complemento por item (painel + PDV)

alter table public.produto_complementos
  add column if not exists sort_order int not null default 0;

with ranked as (
  select
    produto_id,
    complemento_id,
    row_number() over (partition by produto_id order by complemento_id) - 1 as rn
  from public.produto_complementos
)
update public.produto_complementos pc
set sort_order = ranked.rn
from ranked
where pc.produto_id = ranked.produto_id and pc.complemento_id = ranked.complemento_id;

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
  perform public.pdv_assert_store_for_caller(p_store_id);

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
        select coalesce(json_agg(pc.complemento_id order by pc.sort_order, pc.complemento_id), '[]'::json)
        from produto_complementos pc where pc.produto_id = p.id
      )
    ) order by p.nome
  ), '[]'::json)
  into prods from produtos p where p.store_id = p_store_id;

  return json_build_object('categorias', cats, 'complementos', comps, 'produtos', prods);
end;
$$;
