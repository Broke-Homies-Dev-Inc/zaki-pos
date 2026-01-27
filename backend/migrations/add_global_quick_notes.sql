-- Add global_quick_notes column to restaurant_settings table
-- This column stores an array of quick note strings that apply to ALL menu items

ALTER TABLE restaurant_settings 
ADD COLUMN IF NOT EXISTS global_quick_notes JSONB DEFAULT '["Less Spicy", "More Spicy", "Extra Spicy", "No Spice", "More Gravy", "Less Gravy", "Well Done", "Medium Done", "Extra Salt", "Less Salt", "No Onion", "No Garlic", "Extra Cheese", "No Oil"]'::jsonb;

-- Add a comment explaining the column
COMMENT ON COLUMN restaurant_settings.global_quick_notes IS 'Array of quick note options that apply to all menu items by default';
