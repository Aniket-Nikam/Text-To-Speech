-- Run once in a new Supabase project. Private audio is retained for 30 days
-- by `npm run cleanup -w server`; schedule this command daily after deployment.
begin;
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 email text, role text not null default 'user' check(role in ('user','admin')),
 created_at timestamptz not null default now()
);
create function public.handle_new_user() returns trigger language plpgsql security definer set search_path='' as $$
begin insert into public.profiles(id,email) values(new.id,new.email); return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
insert into public.profiles(id,email) select id,email from auth.users on conflict do nothing;

create table public.speech_history (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
 text text not null check(char_length(text) between 1 and 5000), language text not null, voice text not null,
 audio_path text, speed real not null default 1 check(speed between .5 and 2),
 pitch real not null default 0 check(pitch between -50 and 50), volume real not null default 1 check(volume between 0 and 1),
 style text not null default '',created_at timestamptz not null default now(),
 unique(user_id,id), check(audio_path is null or audio_path like user_id::text || '/%')
);
create index history_user_created on public.speech_history(user_id,created_at desc,id desc);
create table public.favorites (
 user_id uuid not null references public.profiles(id) on delete cascade,
 speech_id uuid not null,created_at timestamptz not null default now(),primary key(user_id,speech_id),
 foreign key(user_id,speech_id) references public.speech_history(user_id,id) on delete cascade
);
create table public.usage_logs (
 id bigint generated always as identity primary key,user_id uuid not null references public.profiles(id) on delete cascade,
 character_count integer not null check(character_count between 1 and 5000),language text not null,voice text not null,created_at timestamptz not null default now()
);
create index usage_created on public.usage_logs(created_at desc);
create index usage_user_created on public.usage_logs(user_id,created_at desc);
create table public.daily_usage (
 user_id uuid not null references public.profiles(id) on delete cascade,day date not null,count integer not null default 0,primary key(user_id,day)
);
alter table public.profiles enable row level security;
alter table public.speech_history enable row level security;
alter table public.favorites enable row level security;
alter table public.usage_logs enable row level security;
alter table public.daily_usage enable row level security;
create policy profile_read on public.profiles for select to authenticated using ((select auth.uid())=id);
create policy history_read on public.speech_history for select to authenticated using ((select auth.uid())=user_id);
create policy history_delete on public.speech_history for delete to authenticated using ((select auth.uid())=user_id);
create policy favorites_read on public.favorites for select to authenticated using ((select auth.uid())=user_id);
create policy favorites_insert on public.favorites for insert to authenticated with check ((select auth.uid())=user_id);
create policy favorites_update on public.favorites for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy favorites_delete on public.favorites for delete to authenticated using ((select auth.uid())=user_id);
-- No client role promotion, history insertion, quota mutation, or usage insertion.
revoke all on public.profiles,public.speech_history,public.favorites,public.usage_logs,public.daily_usage from anon,authenticated;
grant select on public.profiles to authenticated;
grant select,delete on public.speech_history to authenticated;
grant select,insert,update,delete on public.favorites to authenticated;
grant all on public.profiles,public.speech_history,public.favorites,public.usage_logs,public.daily_usage to service_role;
grant usage,select on sequence public.usage_logs_id_seq to service_role;

create function public.reserve_generation(p_user_id uuid,p_limit integer) returns boolean language plpgsql security definer set search_path='' as $$
declare reserved integer;
begin
 insert into public.daily_usage(user_id,day,count) values(p_user_id,(now() at time zone 'UTC')::date,1)
 on conflict(user_id,day) do update set count=public.daily_usage.count+1 where public.daily_usage.count<p_limit
 returning count into reserved;
 return reserved is not null;
end $$;
revoke all on function public.reserve_generation(uuid,integer) from public,anon,authenticated;
grant execute on function public.reserve_generation(uuid,integer) to service_role;

create function public.usage_analytics() returns jsonb language sql security definer set search_path='' as $$
select jsonb_build_object(
 'totalUsers',(select count(*) from public.profiles),
 'totalGenerations',(select count(*) from public.usage_logs),
 'totalCharacters',(select coalesce(sum(character_count),0) from public.usage_logs),
 'generationsToday',(select count(*) from public.usage_logs where created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC'),
 'languages',(select coalesce(jsonb_agg(x),'[]'::jsonb) from (select language as name,count(*) as count from public.usage_logs group by language order by count(*) desc limit 10)x),
 'voices',(select coalesce(jsonb_agg(x),'[]'::jsonb) from (select voice as name,count(*) as count from public.usage_logs group by voice order by count(*) desc limit 10)x),
 'daily',(select coalesce(jsonb_agg(x),'[]'::jsonb) from (select (created_at at time zone 'UTC')::date as day,count(*) as count from public.usage_logs where created_at>now()-interval '30 days' group by 1 order by 1)x),
 'recent',(select coalesce(jsonb_agg(x),'[]'::jsonb) from (select language,voice,character_count,created_at from public.usage_logs order by created_at desc limit 10)x)
); $$;
revoke all on function public.usage_analytics() from public,anon,authenticated;
grant execute on function public.usage_analytics() to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('speech-audio','speech-audio',false,10485760,array['audio/mpeg']) on conflict(id) do nothing;
create policy audio_read on storage.objects for select to authenticated using (
 bucket_id='speech-audio' and (storage.foldername(name))[1]=(select auth.uid())::text
);
-- Only the backend service role uploads/deletes. No public bucket or public URLs.
commit;
