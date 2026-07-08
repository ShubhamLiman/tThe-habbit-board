-- =====================================================================
-- Phase 1 — Drop legacy tables (fresh-project cutover, no data migration)
--
-- The project is being treated as fresh: all existing rows were test data,
-- so there is no backfill. Run this after 0001_new_schema.sql.
--
-- Keeps `user_stats` (global_shields) and `temporary_directives` (temp-task
-- queue) — those are unchanged. Only the replaced tables are removed.
-- =====================================================================

drop table if exists public.core_protocols   cascade;
drop table if exists public.active_operations cascade;
