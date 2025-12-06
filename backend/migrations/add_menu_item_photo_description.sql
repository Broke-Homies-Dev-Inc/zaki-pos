-- Migration: Add Photo and Description to Menu Items
-- Description: Add image_url and description columns to menu_items table
--              to support menu item photos and detailed descriptions
-- Date: 2025-12-06
-- Author: Zaki POS System

-- =====================================================
-- 1. ADD COLUMNS TO MENU_ITEMS TABLE
-- =====================================================

-- Add description column for menu item details
ALTER TABLE menu_items 
ADD COLUMN IF NOT EXISTS description TEXT;

-- Add image_url column to store photo path/URL
ALTER TABLE menu_items 
ADD COLUMN IF NOT EXISTS image_url VARCHAR(500);

-- =====================================================
-- 2. CREATE INDEX FOR PERFORMANCE (OPTIONAL)
-- =====================================================

-- Index for searching menu items by description (if full-text search needed later)
-- CREATE INDEX IF NOT EXISTS idx_menu_items_description ON menu_items USING gin(to_tsvector('english', description));

-- =====================================================
-- ROLLBACK SCRIPT (if needed)
-- =====================================================
-- ALTER TABLE menu_items DROP COLUMN IF EXISTS description;
-- ALTER TABLE menu_items DROP COLUMN IF EXISTS image_url;
