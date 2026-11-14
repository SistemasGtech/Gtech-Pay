alter table public.stores
  add column if not exists taxas_maquininha jsonb not null default '{
    "pix": 0,
    "cartaoDebito": 0,
    "cartaoCredito": 0,
    "dinheiro": 0
  }'::jsonb;
