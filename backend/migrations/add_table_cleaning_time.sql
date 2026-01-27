-- Add table_cleaning_time column to restaurant_settings
-- This controls how long (in minutes) tables stay in "cleaning" status before auto-transitioning to "available"
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS table_cleaning_time INTEGER DEFAULT 2;

-- Update existing row if it exists
UPDATE restaurant_settings SET table_cleaning_time = 2 WHERE table_cleaning_time IS NULL;
