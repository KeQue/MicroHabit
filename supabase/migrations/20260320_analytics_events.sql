create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  event_name text not null,
  event_data jsonb not null default '{}'::jsonb,
  platform text not null,
  created_at timestamp with time zone not null default now()
);

alter table public.analytics_events enable row level security;

revoke all on table public.analytics_events from public;
grant insert on table public.analytics_events to anon, authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'analytics_events'
      and policyname = 'analytics_events_insert_client'
  ) then
    create policy analytics_events_insert_client
      on public.analytics_events
      for insert
      to anon, authenticated
      with check (
        user_id is null or user_id = auth.uid()
      );
  end if;
end
$$;

create index if not exists analytics_events_created_at_idx
  on public.analytics_events (created_at desc);

create index if not exists analytics_events_event_name_created_at_idx
  on public.analytics_events (event_name, created_at desc);

create index if not exists analytics_events_user_id_created_at_idx
  on public.analytics_events (user_id, created_at desc);
