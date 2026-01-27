-- Add notes column to order_items table
-- This allows storing custom notes for individual order items

ALTER TABLE order_items 
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add comment to describe the column
COMMENT ON COLUMN order_items.notes IS 'Custom notes or special instructions for this order item';
