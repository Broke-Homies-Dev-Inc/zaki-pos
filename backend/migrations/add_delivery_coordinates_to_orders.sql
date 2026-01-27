-- Migration: Add delivery coordinates to orders table
-- Date: 2025-12-29
-- Description: Adds latitude and longitude fields to store customer delivery location

-- Add delivery coordinate columns
ALTER TABLE orders 
ADD COLUMN delivery_latitude NUMERIC(10, 8),
ADD COLUMN delivery_longitude NUMERIC(11, 8);

-- Add index for location queries (useful for delivery driver assignment)
CREATE INDEX idx_orders_delivery_coordinates ON orders(delivery_latitude, delivery_longitude) 
WHERE delivery_latitude IS NOT NULL AND delivery_longitude IS NOT NULL;

-- Add comment to document the fields
COMMENT ON COLUMN orders.delivery_latitude IS 'Customer delivery location latitude (for delivery orders)';
COMMENT ON COLUMN orders.delivery_longitude IS 'Customer delivery location longitude (for delivery orders)';
