-- Fix tables stuck in 'paid' status
-- This script resets all tables with 'paid' status to 'available'
-- Run this once to fix existing data after the code update

-- First, let's see which tables are affected
SELECT id, name, status 
FROM restaurant_tables 
WHERE status = 'paid';

-- Reset paid tables to available
UPDATE restaurant_tables 
SET status = 'available', updated_at = NOW() 
WHERE status = 'paid';

-- Verify the fix
SELECT id, name, status 
FROM restaurant_tables 
WHERE status = 'available';
