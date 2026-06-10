-- Migration to add push notification support
-- Drop old broken table if it exists and re-create with a proper unique key
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscription JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create a unique index on the endpoint string (JSONB UNIQUE on whole column doesn't work reliably)
CREATE UNIQUE INDEX IF NOT EXISTS idx_push_sub_endpoint
  ON push_subscriptions ((subscription->>'endpoint'));
