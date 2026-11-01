begin;
-- Disposable users and report exist only inside this rolled-back transaction.
create temp table vote_fixture as select gen_random_uuid() as report_id, array(select gen_random_uuid() from generate_series(1,5)) as users;
insert into auth.users(id) select unnest(users) from vote_fixture;
insert into public.reports(id,user_id,content,district,dong,category_id)
select report_id,users[1],'투표 기능 검증용 임시 제보입니다.','유성구','신성동','road' from vote_fixture;
grant select on vote_fixture to authenticated;
set local role authenticated;
do $$
declare f record; u uuid;
begin
 select * into f from vote_fixture;
 foreach u in array f.users loop
   perform set_config('request.jwt.claim.sub',u::text,true);
   perform public.set_report_vote(f.report_id,1);
   perform public.set_report_vote(f.report_id,1);
 end loop;
 if (select upvotes from public.reports where id=f.report_id) <> 5 then raise exception 'Five unique votes failed'; end if;
 if (select count(*) from public.report_votes where report_id=f.report_id) <> 1 then raise exception 'Other voters exposed'; end if;
 perform public.set_report_vote(f.report_id,-1);
 if not exists(select 1 from public.reports where id=f.report_id and upvotes=4 and downvotes=1) then raise exception 'Switch failed'; end if;
 perform public.set_report_vote(f.report_id,0);
 if not exists(select 1 from public.reports where id=f.report_id and upvotes=4 and downvotes=0) then raise exception 'Cancel failed'; end if;
 begin
   update public.reports set upvotes=999 where id=f.report_id;
   raise exception 'Counter tampering allowed';
 exception when insufficient_privilege then null; end;
 begin
   insert into public.report_votes values(f.report_id,f.users[1],-1);
   raise exception 'Forged voter allowed';
 exception when insufficient_privilege then null; end;
 perform public.set_report_vote(f.report_id,1);
 if (select upvotes from public.reports where id=f.report_id) <> 5 then raise exception 'Promotion failed'; end if;
end $$;
reset role;
rollback;
select 'PASS: five votes, idempotence, switch, cancel, own-only visibility, tamper protection; rolled back' as result;
