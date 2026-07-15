-- CatApp user sync support applied to Supabase project nntlgxqwngsewmpkajls.
-- Keep this file as the source record for app/database expectations.

alter table public.profiles
  add column if not exists email text,
  add column if not exists home_parish text,
  add column if not exists home_parish_address text,
  add column if not exists home_parish_phone text,
  add column if not exists home_parish_mass_times text,
  add column if not exists home_parish_confession_times text;

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;

grant select, insert, update, delete on public.user_settings to authenticated;

create policy "Users can read own settings" on public.user_settings
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert own settings" on public.user_settings
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update own settings" on public.user_settings
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users insert own profile" on public.profiles
  for insert to authenticated
  with check ((select auth.uid()) = id);

create policy "authenticated users can add parish records" on public.parishes
  for insert to authenticated
  with check (length(trim(name)) > 0 and length(trim(address)) > 0);

create policy "authenticated users can update parish records" on public.parishes
  for update to authenticated
  using (true)
  with check (length(trim(name)) > 0 and length(trim(address)) > 0);

create policy "authenticated users can read parish records" on public.parishes
  for select to authenticated
  using (true);

-- Admin portal queue/action support.
-- Applied as idempotent policies in Supabase so admins can manage review queues.
create or replace function public.is_catapp_admin()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin', false)
    or exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.is_admin = true
    );
$$;

revoke all on function public.is_catapp_admin() from public;
grant execute on function public.is_catapp_admin() to authenticated;

grant select, insert, update, delete on
  public.parish_edit_requests,
  public.community_reports,
  public.community_posts,
  public.identity_verification_requests,
  public.hymn_correction_requests,
  public.reading_approval_requests,
  public.advertisements,
  public.admin_audit_logs
to authenticated;

alter table public.identity_verification_requests
  add column if not exists document_url text,
  add column if not exists document_path text,
  add column if not exists document_file_name text,
  add column if not exists document_mime_type text;

alter table public.advertisements
  add column if not exists body text,
  add column if not exists target_url text,
  add column if not exists starts_at timestamptz,
  add column if not exists ends_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

drop policy if exists "Admins can manage advertisements" on public.advertisements;
create policy "Admins can manage advertisements" on public.advertisements
  for all to authenticated
  using (public.is_catapp_admin())
  with check (public.is_catapp_admin());

drop policy if exists "Admins can manage admin_audit_logs" on public.admin_audit_logs;
create policy "Admins can manage admin_audit_logs" on public.admin_audit_logs
  for all to authenticated
  using (public.is_catapp_admin())
  with check (public.is_catapp_admin());

create or replace function public.create_catapp_ad(
  p_title text,
  p_sponsor text default null,
  p_placement text default 'today_top',
  p_body text default null,
  p_target_url text default null,
  p_status text default 'active',
  p_starts_at timestamptz default null,
  p_ends_at timestamptz default null
)
returns public.advertisements
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_ad public.advertisements;
begin
  if not public.is_catapp_admin() then
    raise exception 'Admin access is required.' using errcode = '42501';
  end if;

  if length(trim(coalesce(p_title, ''))) = 0 then
    raise exception 'Add an advert title before saving.' using errcode = '22023';
  end if;

  insert into public.advertisements (
    title,
    sponsor,
    placement,
    body,
    target_url,
    status,
    starts_at,
    ends_at,
    updated_at
  ) values (
    trim(p_title),
    nullif(trim(coalesce(p_sponsor, '')), ''),
    coalesce(nullif(trim(coalesce(p_placement, '')), ''), 'today_top'),
    nullif(trim(coalesce(p_body, '')), ''),
    nullif(trim(coalesce(p_target_url, '')), ''),
    coalesce(nullif(trim(coalesce(p_status, '')), ''), 'active'),
    coalesce(p_starts_at, now()),
    p_ends_at,
    now()
  )
  returning * into inserted_ad;

  return inserted_ad;
end;
$$;

revoke all on function public.create_catapp_ad(text, text, text, text, text, text, timestamptz, timestamptz) from public;
revoke execute on function public.create_catapp_ad(text, text, text, text, text, text, timestamptz, timestamptz) from anon;
grant execute on function public.create_catapp_ad(text, text, text, text, text, text, timestamptz, timestamptz) to authenticated;

insert into storage.buckets (id, name, public)
values ('baptismal-cards', 'baptismal-cards', true)
on conflict (id) do update set public = true;

create policy "authenticated users can upload own baptismal cards" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'baptismal-cards'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

create policy "authenticated users can read baptismal card uploads" on storage.objects
  for select to authenticated
  using (bucket_id = 'baptismal-cards');
