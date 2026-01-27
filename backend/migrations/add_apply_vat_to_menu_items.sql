-- Add apply_vat column to menu_items table
-- This allows individual menu items to be marked for VAT calculation

ALTER TABLE menu_items
ADD COLUMN IF NOT EXISTS apply_vat BOOLEAN DEFAULT false;

-- Update existing items to have apply_vat = false by default
UPDATE menu_items
SET apply_vat = false
WHERE apply_vat IS NULL;
