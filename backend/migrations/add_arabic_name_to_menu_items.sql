-- Add Arabic name column to menu_items table
ALTER TABLE menu_items 
ADD COLUMN IF NOT EXISTS name_ar TEXT;

-- Add comment to the column
COMMENT ON COLUMN menu_items.name_ar IS 'Arabic name of the menu item';
