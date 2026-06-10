-- migrations/035_user_presence_status.sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS custom_status VARCHAR(50) DEFAULT 'auto';
ALTER TABLE users ADD COLUMN IF NOT EXISTS presence_status VARCHAR(255) DEFAULT 'Available';
