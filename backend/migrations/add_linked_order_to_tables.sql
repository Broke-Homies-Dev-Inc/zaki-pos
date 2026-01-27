-- Migration: Add linked_order_id to restaurant_tables for table combination tracking
-- This allows multiple tables to be linked to a single order
-- Tables can ONLY be combined when there's an order - empty tables cannot be combined together

-- Add the linked_order_id column
ALTER TABLE restaurant_tables 
ADD COLUMN IF NOT EXISTS linked_order_id UUID REFERENCES orders(id) ON DELETE SET NULL;

-- Add index for performance when querying linked tables
CREATE INDEX IF NOT EXISTS idx_restaurant_tables_linked_order 
ON restaurant_tables(linked_order_id);

-- Add comment explaining the column's purpose
COMMENT ON COLUMN restaurant_tables.linked_order_id IS 
'Tracks which order this table is linked to (for table combinations). When multiple tables are combined, they all share the same linked_order_id. This is different from orders.restaurant_table_id which identifies the primary table that owns the order.';

-- Example: If tables A1, A2, A3 are combined with an order:
-- - Order in orders table has restaurant_table_id = A1 (primary table that initiated the order)
-- - restaurant_tables records:
--   * A1: linked_order_id = order_id (self-reference)
--   * A2: linked_order_id = order_id (linked to same order)
--   * A3: linked_order_id = order_id (linked to same order)
-- 
-- When bill is printed/paid, all linked_order_id values are cleared and tables separate.
