-- 028_expand_service_types.sql
-- Expand service_type CHECK constraint on tasks and client_services tables
-- to include: printing, branding, sm_plan, web_dev

-- ── tasks table ──────────────────────────────────────────────────────────────
ALTER TABLE tasks
  DROP CONSTRAINT IF EXISTS tasks_service_type_check;

ALTER TABLE tasks
  ADD CONSTRAINT tasks_service_type_check
    CHECK (service_type IN (
      'graphic_design',
      'digital_marketing',
      'dev_transformation',
      'content_courses',
      'printing',
      'branding',
      'sm_plan',
      'web_dev'
    ));

-- ── client_services table (same column, same old constraint) ─────────────────
ALTER TABLE client_services
  DROP CONSTRAINT IF EXISTS client_services_service_type_check;

ALTER TABLE client_services
  ADD CONSTRAINT client_services_service_type_check
    CHECK (service_type IN (
      'graphic_design',
      'digital_marketing',
      'dev_transformation',
      'content_courses',
      'printing',
      'branding',
      'sm_plan',
      'web_dev'
    ));
