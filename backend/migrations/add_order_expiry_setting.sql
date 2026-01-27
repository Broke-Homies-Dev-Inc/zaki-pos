-- Add order_expiry_time column to restaurant_settings table
-- This column stores the time (in minutes) after which an order automatically expires
-- Default is 60 minutes (1 hour) - for testing purposes

ALTER TABLE restaurant_settings 
ADD COLUMN IF NOT EXISTS order_expiry_time INTEGER DEFAULT 120;

-- Add a comment explaining the column
COMMENT ON COLUMN restaurant_settings.order_expiry_time IS 'Time in minutes after which an order automatically expires (for testing purposes). Default is 60 minutes.';
