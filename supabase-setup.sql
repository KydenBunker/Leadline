-- In your OWN Supabase project: open SQL Editor and run this entire file.
-- This stores one appointment per row. Only its authenticated owner can access it.
create table if not exists public.leadline_appointments (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);
create index if not exists leadline_appointments_user_idx on public.leadline_appointments(user_id);
alter table public.leadline_appointments enable row level security;
revoke all on public.leadline_appointments from anon, authenticated;
grant select, insert, update, delete on public.leadline_appointments to authenticated;

drop policy if exists "Leadline select own" on public.leadline_appointments;
create policy "Leadline select own" on public.leadline_appointments for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists "Leadline insert own" on public.leadline_appointments;
create policy "Leadline insert own" on public.leadline_appointments for insert to authenticated
  with check ((select auth.uid()) = user_id);
drop policy if exists "Leadline update own" on public.leadline_appointments;
create policy "Leadline update own" on public.leadline_appointments for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
drop policy if exists "Leadline delete own" on public.leadline_appointments;
create policy "Leadline delete own" on public.leadline_appointments for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Leadline v3: Project Designer work sessions, still private to their creator.
-- Safe to run when upgrading an existing Leadline v2 Supabase project.
create table if not exists public.leadline_hours (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);
create index if not exists leadline_hours_user_idx on public.leadline_hours(user_id);
alter table public.leadline_hours enable row level security;
revoke all on public.leadline_hours from anon, authenticated;
grant select, insert, update, delete on public.leadline_hours to authenticated;
drop policy if exists "Leadline hours select own" on public.leadline_hours;
create policy "Leadline hours select own" on public.leadline_hours for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Leadline hours insert own" on public.leadline_hours;
create policy "Leadline hours insert own" on public.leadline_hours for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Leadline hours update own" on public.leadline_hours;
create policy "Leadline hours update own" on public.leadline_hours for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Leadline hours delete own" on public.leadline_hours;
create policy "Leadline hours delete own" on public.leadline_hours for delete to authenticated using ((select auth.uid()) = user_id);

-- Synchronize personal preferences (weekly SDR goal, designer pay estimate settings).
create table if not exists public.leadline_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.leadline_preferences enable row level security;
revoke all on public.leadline_preferences from anon, authenticated;
grant select, insert, update, delete on public.leadline_preferences to authenticated;
drop policy if exists "Leadline prefs select own" on public.leadline_preferences;
create policy "Leadline prefs select own" on public.leadline_preferences for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Leadline prefs insert own" on public.leadline_preferences;
create policy "Leadline prefs insert own" on public.leadline_preferences for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Leadline prefs update own" on public.leadline_preferences;
create policy "Leadline prefs update own" on public.leadline_preferences for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Leadline prefs delete own" on public.leadline_preferences;
create policy "Leadline prefs delete own" on public.leadline_preferences for delete to authenticated using ((select auth.uid()) = user_id);
