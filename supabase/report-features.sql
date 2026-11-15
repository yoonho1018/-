begin;
insert into public.categories(id,main,name,keywords,extra,sort_order)
values ('other','생활','기타 생활불편','{}','발생 장소와 상황을 정리해 지역 민원 창구에 문의하세요.',100)
on conflict(id) do nothing;

alter table public.reports add column photo_path text
check (photo_path is null or (split_part(photo_path,'/',1)=user_id::text and photo_path ~ '^[0-9a-f-]+/[0-9a-f-]+[.]jpg$'));
grant insert(photo_path), update(content,district,dong,category_id,place_text,latitude,longitude,photo_path), delete on public.reports to authenticated;
create policy "Delete own reports" on public.reports for delete to authenticated using (user_id=(select auth.uid()));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('report-photos','report-photos',false,3145728,array['image/jpeg']);
create policy "Upload own report photo" on storage.objects for insert to authenticated
with check(bucket_id='report-photos' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "Read own uploaded photos" on storage.objects for select to authenticated
using(bucket_id='report-photos' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "Members view attached photos" on storage.objects for select to authenticated
using(bucket_id='report-photos' and exists(select 1 from public.reports r where r.photo_path=storage.objects.name));
create policy "Remove unused own report photo" on storage.objects for delete to authenticated
using(bucket_id='report-photos' and (storage.foldername(name))[1]=(select auth.uid())::text
and not exists(select 1 from public.reports r where r.photo_path=storage.objects.name));

create table public.report_follows (
 report_id uuid references public.reports on delete cascade,
 user_id uuid default auth.uid() references auth.users on delete cascade,
 primary key(report_id,user_id)
);
create table public.report_notifications (
 id bigint generated always as identity primary key,
 user_id uuid not null references auth.users on delete cascade,
 report_id uuid not null references public.reports on delete cascade,
 status text not null, created_at timestamptz not null default now()
);
create index report_notifications_recipient on public.report_notifications(user_id,id desc);
alter table public.report_follows enable row level security;
alter table public.report_notifications enable row level security;
revoke all on public.report_follows,public.report_notifications from public,anon,authenticated;
grant select,insert(report_id),delete on public.report_follows to authenticated;
grant select on public.report_notifications to authenticated;
create policy "Manage own follows" on public.report_follows for all to authenticated
using (user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy "Read own notifications" on public.report_notifications for select to authenticated using(user_id=(select auth.uid()));
create function private.notify_report_followers() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.report_notifications(user_id,report_id,status)
 select f.user_id,new.id,new.status from public.report_follows f where f.report_id=new.id;
 return null;
end;
$$;
revoke all on function private.notify_report_followers() from public,anon,authenticated;
create trigger report_status_notifications after update of status on public.reports for each row
when(old.status is distinct from new.status) execute function private.notify_report_followers();
commit;
