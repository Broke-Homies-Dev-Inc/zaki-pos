-- Add quick_notes column to menu_items table
-- This column stores an array of quick note strings specific to each menu item

ALTER TABLE menu_items 
ADD COLUMN IF NOT EXISTS quick_notes JSONB DEFAULT NULL;

-- Add a comment explaining the column
COMMENT ON COLUMN menu_items.quick_notes IS 'Array of quick note options for this menu item (e.g., ["Less Spicy", "No Onion"])';
