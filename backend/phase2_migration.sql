
-- Add current_order_count to pos_sessions
ALTER TABLE pos_sessions ADD COLUMN IF NOT EXISTS current_order_count INTEGER DEFAULT 0;

-- Drop unique constraint on order_number
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_order_number_key;

-- Verify columns
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'pos_sessions' AND column_name = 'current_order_count';
