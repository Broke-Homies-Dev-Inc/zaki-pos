-- Create a function to get next daily order number (thread-safe, auto-resets daily)
-- This ensures order numbers are unified across all UIs (POS, waiter tablets, etc.)

-- Table to track daily order counter
CREATE TABLE IF NOT EXISTS daily_order_counter (
  date DATE PRIMARY KEY,
  counter INTEGER NOT NULL DEFAULT 0
);

-- Function to get next order number for today (atomic operation)
CREATE OR REPLACE FUNCTION get_next_daily_order_number()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  today_date DATE;
  next_number INTEGER;
BEGIN
  today_date := CURRENT_DATE;
  
  -- Insert or update today's counter atomically
  INSERT INTO daily_order_counter (date, counter)
  VALUES (today_date, 1)
  ON CONFLICT (date) 
  DO UPDATE SET counter = daily_order_counter.counter + 1
  RETURNING counter INTO next_number;
  
  RETURN next_number;
END;
$$;

-- Clean up old counter records (optional, keeps table small)
-- Delete records older than 30 days
DELETE FROM daily_order_counter WHERE date < CURRENT_DATE - INTERVAL '30 days';

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_daily_order_counter_date ON daily_order_counter(date);

COMMENT ON TABLE daily_order_counter IS 'Tracks daily order numbers - resets automatically each day';
COMMENT ON FUNCTION get_next_daily_order_number IS 'Returns next order number for today (atomic, thread-safe)';
