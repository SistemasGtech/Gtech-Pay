-- Versão publicada do APK PDV (leitura pública para tablets)
create table if not exists public.pdv_app_release (
  singleton boolean primary key default true check (singleton),
  version_code int not null,
  version_name text not null,
  apk_url text not null,
  notes text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.pdv_app_release enable row level security;

drop policy if exists pdv_app_release_select_anon on public.pdv_app_release;
create policy pdv_app_release_select_anon on public.pdv_app_release
  for select to anon, authenticated using (true);

insert into public.pdv_app_release (singleton, version_code, version_name, apk_url, notes)
values (
  true,
  11,
  '1.0.10',
  'https://github.com/SistemasGtech/Gtech-Pay/releases/download/pdv-1.0.10/app-debug.apk',
  'Atualize version_code e apk_url aqui (SQL) ou via dashboard. GitHub Pages pdv-latest.json e opcional.'
)
on conflict (singleton) do update set
  version_code = excluded.version_code,
  version_name = excluded.version_name,
  apk_url = excluded.apk_url,
  notes = excluded.notes,
  updated_at = now();

create or replace function public.pdv_get_app_update()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'versionCode', r.version_code,
    'versionName', r.version_name,
    'apkUrl', r.apk_url,
    'notes', r.notes
  )
  from public.pdv_app_release r
  where r.singleton is true;
$$;

grant execute on function public.pdv_get_app_update() to anon, authenticated;
