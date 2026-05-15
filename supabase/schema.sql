create table if not exists public.districts (
  id text primary key,
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null unique,
  clan_id text not null references public.districts (id),
  total_distance_km numeric(8,2) not null default 0,
  total_duration_seconds integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  clan_id text not null references public.districts (id),
  distance_km numeric(6,2) not null check (distance_km > 0),
  duration_seconds integer not null check (duration_seconds > 0),
  created_at timestamptz not null default now()
);

insert into public.districts (id, name)
values
  ('vieux-lille', 'Vieux-Lille'),
  ('centre', 'Centre'),
  ('vauban-esquermes', 'Vauban-Esquermes'),
  ('wazemmes', 'Wazemmes'),
  ('moulins', 'Moulins'),
  ('fives', 'Fives'),
  ('saint-maurice-pellevoisin', 'Saint-Maurice Pellevoisin'),
  ('bois-blancs', 'Bois-Blancs'),
  ('lille-sud', 'Lille-Sud'),
  ('hellemmes', 'Hellemmes')
on conflict (id) do nothing;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nickname, clan_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nickname', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'clan_id', 'centre')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

alter table public.districts enable row level security;
alter table public.profiles enable row level security;
alter table public.runs enable row level security;

create policy "districts are readable by everyone"
on public.districts
for select
to authenticated, anon
using (true);

create policy "profiles are readable by everyone"
on public.profiles
for select
to authenticated, anon
using (true);

create policy "users can insert their own profile"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

create policy "users can update their own profile"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "users can insert their own runs"
on public.runs
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "runs are readable by everyone"
on public.runs
for select
to authenticated, anon
using (true);
