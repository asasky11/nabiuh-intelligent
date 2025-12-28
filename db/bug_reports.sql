-- Table: bug_reports
-- Collects user-submitted error/problem reports from the app UI.

create table if not exists public.bug_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  email text, -- optional contact email
  title text not null, -- short summary
  description text not null, -- detailed problem description
  steps text, -- reproduction steps
  severity text check (severity in ('low','medium','high','critical')) default 'medium',
  status text check (status in ('open','in_progress','resolved','closed')) default 'open',
  app_version text, -- optional client version/hash
  platform text, -- device/os/browser info
  attachment_url text, -- optional screenshot/log link
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bug_reports_user_id_idx on public.bug_reports (user_id);
create index if not exists bug_reports_status_idx on public.bug_reports (status);
create index if not exists bug_reports_severity_idx on public.bug_reports (severity);

-- Basic row-level security: authenticated users can insert their own reports and view what they submitted.
alter table public.bug_reports enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'bug_reports' and policyname = 'bug_reports_insert_own') then
    create policy bug_reports_insert_own on public.bug_reports
      for insert to authenticated
      with check (auth.uid() is null or user_id = auth.uid());
  end if;

  if not exists (select 1 from pg_policies where tablename = 'bug_reports' and policyname = 'bug_reports_select_own') then
    create policy bug_reports_select_own on public.bug_reports
      for select to authenticated
      using (auth.uid() is null or user_id = auth.uid());
  end if;
end
$$;

-- Trigger to keep updated_at fresh.
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_timestamp on public.bug_reports;
create trigger set_timestamp
before update on public.bug_reports
for each row
execute function public.set_updated_at();
