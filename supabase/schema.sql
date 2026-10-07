-- Run once in a NEW Supabase project's SQL Editor, then run seed.sql.
begin;
create table public.main_guides (
  name text primary key,
  body text not null,
  checklist text[] not null
);
create table public.categories (
  id text primary key,
  main text not null references public.main_guides(name),
  name text not null,
  keywords text[] not null,
  extra text not null,
  sort_order integer not null
);
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(trim(content)) between 10 and 1000),
  district text not null check (district in ('유성구', '서구', '중구', '동구', '대덕구')),
  dong text not null check (char_length(trim(dong)) between 1 and 30),
  category_id text not null references public.categories(id),
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now()
);
create index reports_area_idx on public.reports(district, dong, category_id);
create index reports_user_idx on public.reports(user_id, created_at desc);
create index reports_time_idx on public.reports(created_at desc);
alter table public.main_guides enable row level security;
alter table public.categories enable row level security;
alter table public.reports enable row level security;
revoke all on public.main_guides, public.categories, public.reports from anon, authenticated;
grant select on public.main_guides, public.categories, public.reports to anon, authenticated;
grant insert (user_id, content, district, dong, category_id) on public.reports to authenticated;
grant update (status) on public.reports to authenticated;
create policy "Public guides" on public.main_guides for select to anon, authenticated using (true);
create policy "Public categories" on public.categories for select to anon, authenticated using (true);
create policy "Public reports" on public.reports for select to anon, authenticated using (true);
create policy "Create own reports" on public.reports for insert to authenticated with check ((select auth.uid()) = user_id and status = 'open');
create policy "Update own reports" on public.reports for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create function public.report_statistics()
returns table (district text, dong text, main text, count bigint, resolved bigint)
language sql stable security invoker set search_path = ''
as $$
  select r.district, r.dong, c.main, count(*), count(*) filter (where r.status = 'resolved')
  from public.reports r join public.categories c on c.id = r.category_id
  group by r.district, r.dong, c.main;
$$;
revoke all on function public.report_statistics() from public;
grant execute on function public.report_statistics() to anon, authenticated;
commit;
