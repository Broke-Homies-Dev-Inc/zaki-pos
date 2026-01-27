-- Add complimentary_quantity column to order_items table
-- This allows tracking partial quantities of an item that are complimentary
-- e.g., if quantity=3 and complimentary_quantity=1, customer pays for 2 items

ALTER TABLE order_items 
ADD COLUMN IF NOT EXISTS complimentary_quantity INTEGER DEFAULT 0;

-- Add constraint to ensure complimentary_quantity doesn't exceed quantity
ALTER TABLE order_items 
ADD CONSTRAINT check_complimentary_qty 
CHECK (complimentary_quantity >= 0 AND complimentary_quantity <= quantity);
