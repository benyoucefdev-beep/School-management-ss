-- ============================================================
-- Axialogy Migration 004 — Suppliers Module & PWA
-- ============================================================

CREATE TABLE IF NOT EXISTS supplier_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL UNIQUE,
  description TEXT
);

INSERT INTO supplier_types (name, description) VALUES
  ('software_tool', 'Software subscriptions and digital tools'),
  ('printing_house', 'Printing and production vendors'),
  ('euro_supplier', 'European suppliers billed in EUR')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  supplier_type_id UUID NOT NULL REFERENCES supplier_types(id),
  contact_name VARCHAR(255),
  contact_email VARCHAR(255),
  contact_phone VARCHAR(50),
  country VARCHAR(100),
  address TEXT,
  website TEXT,
  tax_number VARCHAR(100),
  currency VARCHAR(3) DEFAULT 'EUR' CHECK (currency IN ('EUR', 'USD')),
  payment_terms TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS supplier_client_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  project_description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(supplier_id, client_id)
);

CREATE TABLE IF NOT EXISTS supplier_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  tool_name VARCHAR(255) NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD' CHECK (currency IN ('EUR', 'USD')),
  frequency VARCHAR(20) NOT NULL CHECK (frequency IN ('monthly', 'quarterly', 'annual')),
  next_billing_date DATE,
  is_active BOOLEAN DEFAULT TRUE,
  linked_to_client BOOLEAN DEFAULT FALSE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS supplier_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  order_reference VARCHAR(100),
  description TEXT NOT NULL,
  quantity INTEGER,
  unit VARCHAR(50),
  total_amount NUMERIC(12,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'EUR' CHECK (currency IN ('EUR', 'USD')),
  order_date DATE DEFAULT CURRENT_DATE,
  expected_delivery DATE,
  actual_delivery DATE,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
    'pending', 'confirmed', 'in_production',
    'delivered', 'cancelled'
  )),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS exchange_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_currency VARCHAR(3) NOT NULL,
  to_currency VARCHAR(3) NOT NULL,
  rate NUMERIC(10,6) NOT NULL,
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  set_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS supplier_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  transaction_type VARCHAR(30) NOT NULL CHECK (transaction_type IN (
    'invoice_payment',
    'subscription_payment',
    'order_payment',
    'advance',
    'refund'
  )),
  reference_id UUID,
  total_amount NUMERIC(12,2) NOT NULL,
  currency VARCHAR(3) NOT NULL CHECK (currency IN ('EUR', 'USD')),
  amount_in_usd NUMERIC(12,2),
  exchange_rate_used NUMERIC(10,6),
  payment_method VARCHAR(30) CHECK (payment_method IN (
    'bank_transfer', 'cash', 'cheque', 'card', 'other'
  )),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
    'pending', 'partial', 'paid', 'overdue', 'cancelled'
  )),
  due_date DATE,
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS supplier_versements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES supplier_transactions(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  currency VARCHAR(3) NOT NULL CHECK (currency IN ('EUR', 'USD')),
  amount_in_usd NUMERIC(12,2),
  exchange_rate_used NUMERIC(10,6),
  payment_method VARCHAR(30) CHECK (payment_method IN (
    'bank_transfer', 'cash', 'cheque', 'card', 'other'
  )),
  payment_date DATE DEFAULT CURRENT_DATE,
  scheduled_date DATE,
  status VARCHAR(20) DEFAULT 'paid' CHECK (status IN (
    'scheduled', 'paid', 'missed'
  )),
  receipt_url TEXT,
  notes TEXT,
  logged_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS supplier_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES supplier_transactions(id) ON DELETE SET NULL,
  order_id UUID REFERENCES supplier_orders(id) ON DELETE SET NULL,
  folder VARCHAR(30) NOT NULL CHECK (folder IN (
    'invoices', 'contracts', 'deliverables', 'other'
  )),
  file_name VARCHAR(255) NOT NULL,
  file_url TEXT NOT NULL,
  uploaded_by VARCHAR(10) CHECK (uploaded_by IN ('staff', 'supplier')),
  uploaded_by_type VARCHAR(10) DEFAULT 'staff',
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS supplier_access_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  token VARCHAR(128) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS supplier_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id UUID NOT NULL REFERENCES supplier_access_tokens(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  device_info TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '90 days'
);

CREATE TABLE IF NOT EXISTS supplier_push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  language VARCHAR(5) DEFAULT 'en' CHECK (language IN ('en', 'ar', 'fr')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(supplier_id, endpoint)
);

CREATE TABLE IF NOT EXISTS supplier_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL CHECK (type IN (
    'payment_sent',
    'versement_scheduled',
    'versement_paid',
    'order_confirmed',
    'order_status_changed',
    'document_uploaded',
    'subscription_renewal_reminder'
  )),
  title_en TEXT NOT NULL,
  title_ar TEXT NOT NULL,
  title_fr TEXT NOT NULL,
  body_en TEXT NOT NULL,
  body_ar TEXT NOT NULL,
  body_fr TEXT NOT NULL,
  related_id UUID,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
