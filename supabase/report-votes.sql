begin;
alter table public.reports add column upvotes integer not null default 0 check (upvotes >= 0), add column downvotes integer not null default 0 check (downvotes >= 0);
create index reports_upvotes_idx on public.reports(upvotes desc, created_at desc, id);
create table public.report_votes (
  report_id uuid not null references public.reports(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  value smallint not null check (value in (-1,1)),
  primary key (report_id,user_id)
);
create index report_votes_user_idx on public.report_votes(user_id);
alter table public.report_votes enable row level security;
revoke all on public.report_votes from anon, authenticated;
grant select, delete on public.report_votes to authenticated;
grant insert (report_id,user_id,value), update (value) on public.report_votes to authenticated;
-- SELECT is restricted by RLS to the caller's own rows, never all voters.
create policy "Read own votes only" on public.report_votes for select to authenticated using ((select auth.uid()) = user_id);
create policy "Insert own votes only" on public.report_votes for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Update own votes only" on public.report_votes for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Delete own votes only" on public.report_votes for delete to authenticated using ((select auth.uid()) = user_id);
create schema if not exists private;
-- Only this internal trigger can change public counters; individual votes stay private.
create function private.update_vote_counts() returns trigger language plpgsql security definer set search_path='' as $$
declare old_value integer := 0; new_value integer := 0;
begin
  if TG_OP <> 'INSERT' then old_value := OLD.value; end if;
  if TG_OP <> 'DELETE' then new_value := NEW.value; end if;
  update public.reports set
    upvotes = upvotes + (new_value=1)::integer - (old_value=1)::integer,
    downvotes = downvotes + (new_value=-1)::integer - (old_value=-1)::integer
  where id = case when TG_OP='DELETE' then OLD.report_id else NEW.report_id end;
  return null;
end;
$$;
revoke all on function private.update_vote_counts() from public, anon, authenticated;
create trigger update_vote_counts after insert or update or delete on public.report_votes for each row execute function private.update_vote_counts();
create function public.set_report_vote(p_report uuid, p_value integer) returns void language plpgsql security invoker set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Login required' using errcode='42501'; end if;
  if p_value is null or p_value not in (-1,0,1) then raise exception 'Invalid vote' using errcode='22023'; end if;
  if p_value=0 then
    delete from public.report_votes where report_id=p_report and user_id=auth.uid();
  else
    insert into public.report_votes(report_id,user_id,value) values(p_report,auth.uid(),p_value)
    on conflict(report_id,user_id) do update set value=excluded.value;
  end if;
end;
$$;
revoke all on function public.set_report_vote(uuid,integer) from public, anon;
grant execute on function public.set_report_vote(uuid,integer) to authenticated;
commit;
