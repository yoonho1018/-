-- Additive upgrade for existing projects. Apply after schema.sql and seed.sql.
begin;
alter table public.reports
  add column place_text text not null default '' check (char_length(place_text) <= 160),
  add column latitude double precision,
  add column longitude double precision,
  add constraint reports_coordinates_check check (
    (latitude is null and longitude is null) or
    (latitude is not null and longitude is not null
      and latitude between 36.10 and 36.60 and longitude between 127.10 and 127.65)
  );
grant insert (place_text, latitude, longitude) on public.reports to authenticated;
create index reports_category_status_idx on public.reports(category_id, status);
create function public.report_map_data(p_main text default null, p_category text default null, p_status text default null)
returns jsonb language sql stable security invoker set search_path = '' as $$
  with selected as materialized (
    select r.district, r.latitude, r.longitude
    from public.reports r join public.categories c on c.id = r.category_id
    where (p_main is null or c.main = p_main)
      and (p_category is null or r.category_id = p_category)
      and (p_status is null or r.status = p_status)
  ), districts as (
    select district, count(*) as count, count(latitude) as located from selected group by district
  ), bins as (
    select round(latitude::numeric, 3) as lat, round(longitude::numeric, 3) as lng, count(*) as count
    from selected where latitude is not null group by 1, 2
  ), displayed as (select * from bins order by count desc, lat, lng limit 5000)
  select jsonb_build_object(
    'total', (select count(*) from selected),
    'located', (select count(latitude) from selected),
    'districts', coalesce((select jsonb_agg(to_jsonb(d)) from districts d), '[]'::jsonb),
    'heat', coalesce((select jsonb_agg(jsonb_build_array(lat,lng,count) order by count desc, lat, lng) from displayed), '[]'::jsonb),
    'truncated', (select count(*) > 5000 from bins)
  );
$$;
revoke all on function public.report_map_data(text,text,text) from public;
grant execute on function public.report_map_data(text,text,text) to anon, authenticated;
commit;
