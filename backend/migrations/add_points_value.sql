-- Add points_value column to restaurant_settings
-- This defines how much 1 loyalty point is worth in currency (OMR)
-- Default: 0.1 (meaning 10 points = OMR1)

ALTER TABLE restaurant_settings 
ADD COLUMN IF NOT EXISTS points_value DECIMAL(10, 2) DEFAULT 0.1;

-- Update existing rows to have the default value
UPDATE restaurant_settings 
SET points_value = 0.1 
WHERE points_value IS NULL;

-- Add comment explaining the field
COMMENT ON COLUMN restaurant_settings.points_value IS 'Value of 1 loyalty point in currency. Example: 0.1 means 10 points = OMR1';
