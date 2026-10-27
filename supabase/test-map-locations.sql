-- Integration checks using an existing auth user. Everything is rolled back.
begin;
do $$
declare
  test_user uuid;
  first_report uuid;
  base_count integer;
  after_count integer;
  changed integer;
begin
  select id into test_user from auth.users limit 1;
  if test_user is null then raise exception 'Requires an existing auth user'; end if;
  perform set_config('request.jwt.claim.sub', test_user::text, true);
  execute 'set local role authenticated';
  base_count := (public.report_map_data(null,'road','open')->>'total')::integer;
  insert into public.reports(user_id,content,district,dong,category_id,place_text,latitude,longitude)
  values(test_user,'지도 연동 자동검사 전용 기록입니다.','유성구','신성동','road','자동검사 장소',36.35041,127.38451) returning id into first_report;
  insert into public.reports(user_id,content,district,dong,category_id,latitude,longitude)
  values(test_user,'지도 집계 자동검사 전용 기록입니다.','유성구','신성동','road',36.35042,127.38452);
  after_count := (public.report_map_data(null,'road','open')->>'total')::integer;
  if after_count <> base_count + 2 then raise exception 'Filtered totals failed'; end if;
  if not exists (select 1 from jsonb_array_elements(public.report_map_data(null,'road','open')->'heat') p
    where (p->>0)::numeric=36.350 and (p->>1)::numeric=127.385 and (p->>2)::integer>=2) then
    raise exception 'Weighted bins failed';
  end if;
  begin
    insert into public.reports(user_id,content,district,dong,category_id,latitude)
    values(test_user,'잘못된 좌표 입력 차단 검사입니다.','유성구','신성동','road',36.35);
    raise exception 'Partial coordinate was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.reports(user_id,content,district,dong,category_id,latitude,longitude)
    values(test_user,'지도 범위 밖 입력 차단 검사입니다.','유성구','신성동','road',0,0);
    raise exception 'Out-of-bounds coordinate was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.reports(user_id,content,district,dong,category_id)
    values(gen_random_uuid(),'다른 사용자 명의 입력 차단 검사입니다.','유성구','신성동','road');
    raise exception 'Forged owner was accepted';
  exception when insufficient_privilege then null;
  end;
  perform set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
  update public.reports set status='resolved' where id=first_report;
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'Other user could update'; end if;
  perform set_config('request.jwt.claim.sub', test_user::text, true);
  update public.reports set status='resolved' where id=first_report;
  get diagnostics changed = row_count;
  if changed <> 1 then raise exception 'Owner update failed'; end if;
  execute 'reset role';
  execute 'set local role anon';
  perform public.report_map_data();
  begin
    insert into public.reports(user_id,content,district,dong,category_id)
    values(test_user,'비로그인 사용자 등록 차단 검사입니다.','유성구','신성동','road');
    raise exception 'Anonymous insert was accepted';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';
end;
$$;
rollback;
select 'PASS: real DB coordinate insert, weighted bins, filters, constraints, ownership RLS, anon read/write; fixtures rolled back' as result;
