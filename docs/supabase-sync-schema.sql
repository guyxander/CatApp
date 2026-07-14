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
