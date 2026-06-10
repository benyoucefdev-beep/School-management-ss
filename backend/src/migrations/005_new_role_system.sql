-- ============================================================
-- Axialogy Migration 005 — New 5-Role RBAC System
-- ============================================================
-- Run this on production Neon DB via the Neon SQL editor.

-- Step 1: Drop old role constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- Step 2: Update existing users to new roles (safe mapping)
-- owner / admin → admin
-- manager       → ads_manager
-- member        → graphic_designer
UPDATE users SET role = 'admin'           WHERE role IN ('admin', 'owner');
UPDATE users SET role = 'ads_manager'     WHERE role = 'manager';
UPDATE users SET role = 'graphic_designer' WHERE role = 'member';

-- Step 3: Apply new constraint
ALTER TABLE users
  ADD CONSTRAINT users_role_check
  CHECK (role IN (
    'admin',
    'graphic_designer',
    'software_developer',
    'printer',
    'ads_manager'
  ));

-- Step 4: Create role_permissions reference table
CREATE TABLE IF NOT EXISTS role_permissions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role       VARCHAR(30)  NOT NULL,
  module     VARCHAR(50)  NOT NULL,
  can_view   BOOLEAN DEFAULT FALSE,
  can_create BOOLEAN DEFAULT FALSE,
  can_edit   BOOLEAN DEFAULT FALSE,
  can_delete BOOLEAN DEFAULT FALSE
);

-- Step 5: Seed role_permissions
INSERT INTO role_permissions (role, module, can_view, can_create, can_edit, can_delete) VALUES
-- ADMIN: full access
('admin', 'clients',   TRUE, TRUE, TRUE, TRUE),
('admin', 'tasks',     TRUE, TRUE, TRUE, TRUE),
('admin', 'finance',   TRUE, TRUE, TRUE, TRUE),
('admin', 'ads',       TRUE, TRUE, TRUE, TRUE),
('admin', 'suppliers', TRUE, TRUE, TRUE, TRUE),
('admin', 'team',      TRUE, TRUE, TRUE, TRUE),
('admin', 'reports',   TRUE, TRUE, TRUE, TRUE),
('admin', 'pipeline',  TRUE, TRUE, TRUE, TRUE),
('admin', 'settings',  TRUE, TRUE, TRUE, TRUE),
('admin', 'orders',    TRUE, TRUE, TRUE, TRUE),
-- GRAPHIC DESIGNER
('graphic_designer', 'tasks',   TRUE, FALSE, TRUE,  FALSE),
('graphic_designer', 'clients', TRUE, FALSE, FALSE, FALSE),
-- SOFTWARE DEVELOPER
('software_developer', 'tasks',   TRUE, FALSE, TRUE,  FALSE),
('software_developer', 'clients', TRUE, FALSE, FALSE, FALSE),
-- PRINTER
('printer', 'tasks',   TRUE, FALSE, TRUE,  FALSE),
('printer', 'clients', TRUE, FALSE, FALSE, FALSE),
('printer', 'orders',  TRUE, FALSE, FALSE, FALSE),
-- ADS MANAGER
('ads_manager', 'tasks',   TRUE, FALSE, TRUE,  FALSE),
('ads_manager', 'clients', TRUE, FALSE, FALSE, FALSE),
('ads_manager', 'ads',     TRUE, TRUE,  TRUE,  FALSE)
ON CONFLICT DO NOTHING;
