-- Run as postgres in the SQL editor of a DISPOSABLE project after the migration.
-- Creates synthetic auth records only inside a transaction; rolls everything back.
begin;
insert into auth.users(id,email) values
 ('a1111111-1111-4111-8111-111111111111','rls-a@example.invalid'),
 ('b2222222-2222-4222-8222-222222222222','rls-b@example.invalid');
insert into public.speech_history(id,user_id,text,language,voice) values
 ('c3333333-3333-4333-8333-333333333333','a1111111-1111-4111-8111-111111111111','Owned by A','en-US','test-voice');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"b2222222-2222-4222-8222-222222222222","role":"authenticated"}',true);
do $$
begin
 if exists(select 1 from public.speech_history where id='c3333333-3333-4333-8333-333333333333') then raise exception 'FAIL: cross-user history read';end if;
 delete from public.speech_history where id='c3333333-3333-4333-8333-333333333333';
 if found then raise exception 'FAIL: cross-user delete';end if;
 begin
  insert into public.favorites(user_id,speech_id) values('b2222222-2222-4222-8222-222222222222','c3333333-3333-4333-8333-333333333333');
  raise exception 'FAIL: cross-user favorite';
 exception when foreign_key_violation then null;end;
 begin
  update public.profiles set role='admin' where id='b2222222-2222-4222-8222-222222222222';
  raise exception 'FAIL: role promotion';
 exception when insufficient_privilege then null;end;
 begin
  perform public.reserve_generation('b2222222-2222-4222-8222-222222222222',999999);
  raise exception 'FAIL: client quota access';
 exception when insufficient_privilege then null;end;
 begin
  perform public.usage_analytics();
  raise exception 'FAIL: client aggregate access';
 exception when insufficient_privilege then null;end;
end $$;

select set_config('request.jwt.claims','{"sub":"a1111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
do $$begin
 if not exists(select 1 from public.speech_history where id='c3333333-3333-4333-8333-333333333333') then raise exception 'FAIL: own read';end if;
 insert into public.favorites(user_id,speech_id) values('a1111111-1111-4111-8111-111111111111','c3333333-3333-4333-8333-333333333333');
end $$;
reset role;
do $$begin
 if not public.reserve_generation('a1111111-1111-4111-8111-111111111111',1) then raise exception 'FAIL: first quota';end if;
 if public.reserve_generation('a1111111-1111-4111-8111-111111111111',1) then raise exception 'FAIL: quota exceeded';end if;
end $$;
rollback;
-- Successful completion without an exception means these RLS checks passed.
