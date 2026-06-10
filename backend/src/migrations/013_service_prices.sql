-- Migration: Create service_prices table
-- Run this in your Neon DB SQL Editor

CREATE TABLE IF NOT EXISTS service_prices (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name  TEXT NOT NULL,
  service_key   TEXT NOT NULL UNIQUE,
  price_dzd     NUMERIC(12,2) NOT NULL DEFAULT 0,
  description   TEXT,
  updated_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed with default service types
INSERT INTO service_prices (service_name, service_key, price_dzd, description) VALUES
  ('Graphic Design',     'graphic_design',     0, 'Logo, branding, visuals'),
  ('Digital Marketing',  'digital_marketing',  0, 'Social media, campaigns'),
  ('Dev Transformation', 'dev_transformation', 0, 'Website / app development'),
  ('Content & Courses',  'content_courses',    0, 'Video production, e-learning'),
  ('Ads Management',     'ads_management',     0, 'PPC, paid ads management'),
  ('Printing',           'printing',           0, 'Flyers, banners, print materials')
ON CONFLICT (service_key) DO NOTHING;
