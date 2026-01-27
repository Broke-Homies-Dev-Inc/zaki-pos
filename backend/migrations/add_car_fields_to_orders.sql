-- Migration: Add car_make and car_license_plate fields to orders table
-- Date: 2026-01-13
-- Purpose: Replace car_details with structured fields for carhop takeaway orders

-- Add new columns for structured car information
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS car_make VARCHAR(100),
ADD COLUMN IF NOT EXISTS car_license_plate VARCHAR(50);

-- Drop the dependent view (no longer needed)
DROP VIEW IF EXISTS table_status_overview;

-- Remove old unstructured car_details column
ALTER TABLE orders DROP COLUMN IF EXISTS car_details;
