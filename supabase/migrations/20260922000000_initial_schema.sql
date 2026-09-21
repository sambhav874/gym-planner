-- Formwork initial Supabase schema.
-- Run this once in Supabase SQL Editor. The app currently keeps a local demo
-- fallback; this schema is the persistence foundation for the next integration.

create extension if not exists pgcrypto;

do $$ begin
  create type public.app_role as enum ('trainer', 'member');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.plan_version_status as enum ('draft', 'published', 'archived');
exception when duplicate_object then null;
end $$;

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  timezone text not null default 'Asia/Kolkata',
  trainer_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text,
  role public.app_role not null default 'member',
  group_id uuid references public.groups(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.plan_templates (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  name text not null,
  source_file_name text,
  source_file_path text,
  created_by uuid references auth.users(id) on delete set null,
  imported_plan jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.plan_assignments (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  template_id uuid references public.plan_templates(id) on delete set null,
  member_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  start_date date not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.plan_versions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.plan_assignments(id) on delete cascade,
  version_number integer not null,
  status public.plan_version_status not null default 'draft',
  source_file_name text,
  source_file_path text,
  change_summary text,
  imported_plan jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  published_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (assignment_id, version_number)
);

create table if not exists public.schedule_days (
  id uuid primary key default gen_random_uuid(),
  plan_version_id uuid not null references public.plan_versions(id) on delete cascade,
  plan_day integer not null,
  week integer not null,
  calendar_date date not null,
  weekday text,
  focus text not null,
  cardio text,
  daily_movement text,
  coach_notes text,
  is_recovery boolean not null default false,
  unique (plan_version_id, plan_day)
);

create table if not exists public.exercise_prescriptions (
  id uuid primary key default gen_random_uuid(),
  schedule_day_id uuid not null references public.schedule_days(id) on delete cascade,
  sort_order integer not null default 0,
  exercise text not null,
  muscle_group text,
  sets text,
  reps text,
  duration text,
  rir text,
  notes text
);

create table if not exists public.meal_plan_days (
  id uuid primary key default gen_random_uuid(),
  plan_version_id uuid not null references public.plan_versions(id) on delete cascade,
  plan_day integer not null,
  calendar_date date not null,
  breakfast text,
  lunch text,
  snack text,
  dinner text,
  before_bed text,
  target text,
  unique (plan_version_id, plan_day)
);

create table if not exists public.guidance_sections (
  id uuid primary key default gen_random_uuid(),
  plan_version_id uuid not null references public.plan_versions(id) on delete cascade,
  title text not null,
  section_type text not null default 'general',
  items jsonb not null default '[]'::jsonb
);

create table if not exists public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.plan_assignments(id) on delete cascade,
  plan_version_id uuid not null references public.plan_versions(id) on delete restrict,
  schedule_day_id uuid not null references public.schedule_days(id) on delete restrict,
  member_id uuid not null references public.profiles(id) on delete cascade,
  session_date date not null,
  started_at timestamptz,
  completed_at timestamptz,
  skipped_at timestamptz,
  skip_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assignment_id, session_date)
);

create table if not exists public.set_logs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.workout_sessions(id) on delete cascade,
  exercise_id uuid not null references public.exercise_prescriptions(id) on delete cascade,
  set_number integer not null,
  load numeric,
  reps numeric,
  rir numeric,
  notes text,
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  unique (session_id, exercise_id, set_number)
);

create table if not exists public.body_metrics (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  member_id uuid not null references public.profiles(id) on delete cascade,
  measured_on date not null,
  weight_kg numeric,
  waist_cm numeric,
  chest_cm numeric,
  steps integer,
  cardio_sessions integer,
  notes text,
  created_at timestamptz not null default now(),
  unique (member_id, measured_on)
);

create table if not exists public.publish_events (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  plan_version_id uuid not null references public.plan_versions(id) on delete cascade,
  summary text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists plan_assignments_member_idx on public.plan_assignments(member_id, active);
create index if not exists schedule_days_date_idx on public.schedule_days(calendar_date);
create index if not exists workout_sessions_member_date_idx on public.workout_sessions(member_id, session_date);
create index if not exists body_metrics_member_date_idx on public.body_metrics(member_id, measured_on);

create or replace function public.current_user_group_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select group_id from public.profiles where id = auth.uid();
$$;

create or replace function public.is_group_member(target_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and group_id = target_group_id
  );
$$;

create or replace function public.is_group_trainer(target_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and group_id = target_group_id and role = 'trainer'
  );
$$;

alter table public.groups enable row level security;
alter table public.profiles enable row level security;
alter table public.plan_templates enable row level security;
alter table public.plan_assignments enable row level security;
alter table public.plan_versions enable row level security;
alter table public.schedule_days enable row level security;
alter table public.exercise_prescriptions enable row level security;
alter table public.meal_plan_days enable row level security;
alter table public.guidance_sections enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.set_logs enable row level security;
alter table public.body_metrics enable row level security;
alter table public.publish_events enable row level security;

drop policy if exists groups_member_read on public.groups;
create policy groups_member_read on public.groups for select to authenticated
  using (public.is_group_member(id));

drop policy if exists profiles_group_read on public.profiles;
create policy profiles_group_read on public.profiles for select to authenticated
  using (group_id = public.current_user_group_id() or id = auth.uid());

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists templates_group_read on public.plan_templates;
create policy templates_group_read on public.plan_templates for select to authenticated
  using (public.is_group_member(group_id));
drop policy if exists templates_trainer_write on public.plan_templates;
create policy templates_trainer_write on public.plan_templates for all to authenticated
  using (public.is_group_trainer(group_id)) with check (public.is_group_trainer(group_id));

drop policy if exists assignments_group_read on public.plan_assignments;
create policy assignments_group_read on public.plan_assignments for select to authenticated
  using (public.is_group_member(group_id));
drop policy if exists assignments_trainer_write on public.plan_assignments;
create policy assignments_trainer_write on public.plan_assignments for all to authenticated
  using (public.is_group_trainer(group_id)) with check (public.is_group_trainer(group_id));

drop policy if exists versions_group_read on public.plan_versions;
create policy versions_group_read on public.plan_versions for select to authenticated
  using (exists (select 1 from public.plan_assignments a where a.id = assignment_id and public.is_group_member(a.group_id)));
drop policy if exists versions_trainer_write on public.plan_versions;
create policy versions_trainer_write on public.plan_versions for all to authenticated
  using (exists (select 1 from public.plan_assignments a where a.id = assignment_id and public.is_group_trainer(a.group_id)))
  with check (exists (select 1 from public.plan_assignments a where a.id = assignment_id and public.is_group_trainer(a.group_id)));

drop policy if exists schedule_group_read on public.schedule_days;
create policy schedule_group_read on public.schedule_days for select to authenticated
  using (exists (
    select 1 from public.plan_versions v
    join public.plan_assignments a on a.id = v.assignment_id
    where v.id = plan_version_id and public.is_group_member(a.group_id)
  ));
drop policy if exists schedule_trainer_write on public.schedule_days;
create policy schedule_trainer_write on public.schedule_days for all to authenticated
  using (exists (
    select 1 from public.plan_versions v
    join public.plan_assignments a on a.id = v.assignment_id
    where v.id = plan_version_id and public.is_group_trainer(a.group_id)
  ))
  with check (exists (
    select 1 from public.plan_versions v
    join public.plan_assignments a on a.id = v.assignment_id
    where v.id = plan_version_id and public.is_group_trainer(a.group_id)
  ));

drop policy if exists exercises_group_read on public.exercise_prescriptions;
create policy exercises_group_read on public.exercise_prescriptions for select to authenticated
  using (exists (
    select 1 from public.schedule_days d
    join public.plan_versions v on v.id = d.plan_version_id
    join public.plan_assignments a on a.id = v.assignment_id
    where d.id = schedule_day_id and public.is_group_member(a.group_id)
  ));
drop policy if exists exercises_trainer_write on public.exercise_prescriptions;
create policy exercises_trainer_write on public.exercise_prescriptions for all to authenticated
  using (exists (
    select 1 from public.schedule_days d
    join public.plan_versions v on v.id = d.plan_version_id
    join public.plan_assignments a on a.id = v.assignment_id
    where d.id = schedule_day_id and public.is_group_trainer(a.group_id)
  ))
  with check (exists (
    select 1 from public.schedule_days d
    join public.plan_versions v on v.id = d.plan_version_id
    join public.plan_assignments a on a.id = v.assignment_id
    where d.id = schedule_day_id and public.is_group_trainer(a.group_id)
  ));

drop policy if exists meals_group_read on public.meal_plan_days;
create policy meals_group_read on public.meal_plan_days for select to authenticated
  using (exists (
    select 1 from public.plan_versions v
    join public.plan_assignments a on a.id = v.assignment_id
    where v.id = plan_version_id and public.is_group_member(a.group_id)
  ));
drop policy if exists meals_trainer_write on public.meal_plan_days;
create policy meals_trainer_write on public.meal_plan_days for all to authenticated
  using (exists (
    select 1 from public.plan_versions v
    join public.plan_assignments a on a.id = v.assignment_id
    where v.id = plan_version_id and public.is_group_trainer(a.group_id)
  ))
  with check (exists (
    select 1 from public.plan_versions v
    join public.plan_assignments a on a.id = v.assignment_id
    where v.id = plan_version_id and public.is_group_trainer(a.group_id)
  ));

drop policy if exists guidance_group_read on public.guidance_sections;
create policy guidance_group_read on public.guidance_sections for select to authenticated
  using (exists (
    select 1 from public.plan_versions v
    join public.plan_assignments a on a.id = v.assignment_id
    where v.id = plan_version_id and public.is_group_member(a.group_id)
  ));
drop policy if exists guidance_trainer_write on public.guidance_sections;
create policy guidance_trainer_write on public.guidance_sections for all to authenticated
  using (exists (
    select 1 from public.plan_versions v
    join public.plan_assignments a on a.id = v.assignment_id
    where v.id = plan_version_id and public.is_group_trainer(a.group_id)
  ))
  with check (exists (
    select 1 from public.plan_versions v
    join public.plan_assignments a on a.id = v.assignment_id
    where v.id = plan_version_id and public.is_group_trainer(a.group_id)
  ));

drop policy if exists sessions_group_read on public.workout_sessions;
create policy sessions_group_read on public.workout_sessions for select to authenticated
  using (public.is_group_member((select group_id from public.plan_assignments where id = assignment_id)));
drop policy if exists sessions_self_write on public.workout_sessions;
create policy sessions_self_write on public.workout_sessions for insert to authenticated
  with check (member_id = auth.uid() and public.is_group_member((select group_id from public.plan_assignments where id = assignment_id)));
drop policy if exists sessions_self_update on public.workout_sessions;
create policy sessions_self_update on public.workout_sessions for update to authenticated
  using (member_id = auth.uid()) with check (member_id = auth.uid());

drop policy if exists set_logs_group_read on public.set_logs;
create policy set_logs_group_read on public.set_logs for select to authenticated
  using (exists (select 1 from public.workout_sessions s where s.id = session_id and public.is_group_member((select group_id from public.plan_assignments where id = s.assignment_id))));
drop policy if exists set_logs_self_write on public.set_logs;
create policy set_logs_self_write on public.set_logs for all to authenticated
  using (exists (select 1 from public.workout_sessions s where s.id = session_id and s.member_id = auth.uid()))
  with check (exists (select 1 from public.workout_sessions s where s.id = session_id and s.member_id = auth.uid()));

drop policy if exists metrics_group_read on public.body_metrics;
create policy metrics_group_read on public.body_metrics for select to authenticated
  using (public.is_group_member(group_id));
drop policy if exists metrics_self_write on public.body_metrics;
create policy metrics_self_write on public.body_metrics for all to authenticated
  using (member_id = auth.uid() and public.is_group_member(group_id))
  with check (member_id = auth.uid() and public.is_group_member(group_id));

drop policy if exists publish_events_group_read on public.publish_events;
create policy publish_events_group_read on public.publish_events for select to authenticated
  using (public.is_group_member(group_id));
drop policy if exists publish_events_trainer_write on public.publish_events;
create policy publish_events_trainer_write on public.publish_events for insert to authenticated
  with check (created_by = auth.uid() and public.is_group_trainer(group_id));

insert into storage.buckets (id, name, public)
values ('plan-uploads', 'plan-uploads', false)
on conflict (id) do nothing;

drop policy if exists plan_uploads_read on storage.objects;
create policy plan_uploads_read on storage.objects for select to authenticated
  using (bucket_id = 'plan-uploads' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists plan_uploads_write on storage.objects;
create policy plan_uploads_write on storage.objects for insert to authenticated
  with check (bucket_id = 'plan-uploads' and (storage.foldername(name))[1] = auth.uid()::text);
