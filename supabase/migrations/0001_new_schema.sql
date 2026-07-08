-- =====================================================================
-- Phase 1 — New relational schema (Goal -> Habit -> Schedule -> Log)
-- The Habit Board: passive tracker -> active execution engine
--
-- Run order: 0001_new_schema.sql -> 0002_backfill.sql -> (verify app) -> 0003_drop_old_tables.sql
--
-- If using the Supabase CLI, rename files to `<timestamp>_name.sql`.
-- Otherwise paste into the Supabase SQL editor in order.
-- =====================================================================

-- Extensions ----------------------------------------------------------
-- gen_random_uuid() ships with pgcrypto (enabled by default on Supabase).
create extension if not exists pgcrypto;
-- pgvector: enabled now (cheap) so the Phase 4 RAG pipeline needs no schema churn.
create extension if not exists vector;

-- Shared helper: keep updated_at fresh on every UPDATE ------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =====================================================================
-- goals  (replaces active_operations; richer macro-objective)
-- =====================================================================
create table if not exists public.goals (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  title           text not null,
  description     text,
  category        text,                         -- e.g. 'fitness' | 'learning' (RAG routing later)
  status          text not null default 'active'
                    check (status in ('active','paused','completed','archived')),
  target_date     date,
  target_streak   int,                          -- milestone (was active_operations.target_days)
  ai_generated    boolean not null default false,
  source_metadata jsonb not null default '{}'::jsonb,  -- AI interview inputs (Phase 3)
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists goals_user_id_idx on public.goals(user_id);

create trigger goals_set_updated_at
  before update on public.goals
  for each row execute function public.set_updated_at();

-- =====================================================================
-- habits  (replaces core_protocols)
-- habit_logs is the source of truth; streak fields are a render cache.
-- =====================================================================
create table if not exists public.habits (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  goal_id           uuid references public.goals(id) on delete set null,  -- nullable: standalone habits ok
  name              text not null,
  is_routine        boolean not null default false,
  is_hard_mode      boolean not null default false,
  target            int not null default 21,
  current_streak    int not null default 0,
  current_day_index int not null default 0,
  longest_streak    int not null default 0,
  achievements      jsonb not null default '[]'::jsonb,
  start_date        date,
  status            text not null default 'active'
                      check (status in ('active','paused','archived')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists habits_user_id_idx on public.habits(user_id);
create index if not exists habits_goal_id_idx on public.habits(goal_id);

create trigger habits_set_updated_at
  before update on public.habits
  for each row execute function public.set_updated_at();

-- =====================================================================
-- habit_schedules  (the dynamic day-of-week definition)
-- One row per (habit, weekday). day_of_week: 0=Sun .. 6=Sat.
-- =====================================================================
create table if not exists public.habit_schedules (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  habit_id      uuid not null references public.habits(id) on delete cascade,
  day_of_week   smallint not null check (day_of_week between 0 and 6),
  variant_label text,                                   -- e.g. 'Upper Body', 'Rest Day'
  is_rest_day   boolean not null default false,         -- rest days auto-satisfy; never break streak
  sub_tasks     jsonb not null default '[]'::jsonb,     -- per-variant checklist (routine support)
  target_metric jsonb,                                  -- e.g. {"type":"reps","value":100}
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (habit_id, day_of_week)                        -- one variant per weekday per habit
);

create index if not exists habit_schedules_habit_id_idx on public.habit_schedules(habit_id);
create index if not exists habit_schedules_user_id_idx on public.habit_schedules(user_id);

create trigger habit_schedules_set_updated_at
  before update on public.habit_schedules
  for each row execute function public.set_updated_at();

-- =====================================================================
-- habit_logs  (per-date execution — new source of truth)
-- unique(habit_id, log_date) enforces one-execution-per-day at the DB,
-- replacing the bypassable client-side date check.
-- =====================================================================
create table if not exists public.habit_logs (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  habit_id            uuid not null references public.habits(id) on delete cascade,
  schedule_id         uuid references public.habit_schedules(id) on delete set null,
  log_date            date not null,
  status              text not null
                        check (status in ('completed','missed','rest','shield_saved','skipped')),
  completed_sub_tasks jsonb not null default '[]'::jsonb,
  executed_at         timestamptz,
  created_at          timestamptz not null default now(),
  unique (habit_id, log_date)
);

create index if not exists habit_logs_habit_id_idx on public.habit_logs(habit_id);
create index if not exists habit_logs_user_id_idx on public.habit_logs(user_id);
create index if not exists habit_logs_habit_date_idx on public.habit_logs(habit_id, log_date desc);

-- =====================================================================
-- Row Level Security — every table scoped to auth.uid() = user_id
-- `for all` + using + with check covers select/insert/update/delete.
-- =====================================================================
alter table public.goals           enable row level security;
alter table public.habits          enable row level security;
alter table public.habit_schedules enable row level security;
alter table public.habit_logs      enable row level security;

create policy "own_goals" on public.goals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own_habits" on public.habits
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own_habit_schedules" on public.habit_schedules
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own_habit_logs" on public.habit_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =====================================================================
-- Kept tables — ensure they exist with RLS (idempotent; won't touch data).
-- These were previously created only via the dashboard with no committed
-- schema. Declaring them here makes the schema reproducible and guarantees
-- per-user isolation (the temporary_directives table was not user-scoped).
-- =====================================================================

-- user_stats: one row per user, id == auth.users.id (the shield pool).
create table if not exists public.user_stats (
  id            uuid primary key references auth.users(id) on delete cascade,
  global_shields int not null default 0
);

-- temporary_directives: the short-lived task queue with a countdown.
create table if not exists public.temporary_directives (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  name         text not null,
  valid_until  timestamptz,
  completed    boolean not null default false,
  terminated_at timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists temporary_directives_user_id_idx
  on public.temporary_directives(user_id);

alter table public.user_stats           enable row level security;
alter table public.temporary_directives enable row level security;

-- Guarded so re-running is safe even if policies already exist.
drop policy if exists "own_user_stats" on public.user_stats;
create policy "own_user_stats" on public.user_stats
  for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "own_temporary_directives" on public.temporary_directives;
create policy "own_temporary_directives" on public.temporary_directives
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
