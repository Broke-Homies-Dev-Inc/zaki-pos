-- Rollback Migration: Remove Waiters System
-- Description: Removes the waiter management system and reverts all changes
-- Date: 2025-11-26
-- WARNING: This will permanently delete all waiter data!

-- =====================================================
-- 1. DROP VIEWS
-- =====================================================
DROP VIEW IF EXISTS active_waiter_orders;
DROP VIEW IF EXISTS waiter_performance;

-- =====================================================
-- 2. REMOVE WAITER COLUMN FROM ORDERS
-- =====================================================
ALTER TABLE orders DROP COLUMN IF EXISTS waiter_id;

-- =====================================================
-- 3. DROP TRIGGER AND FUNCTION
-- =====================================================
DROP TRIGGER IF EXISTS trigger_update_waiters_timestamp ON waiters;
DROP FUNCTION IF EXISTS update_waiters_updated_at();

-- =====================================================
-- 4. DROP INDEXES
-- =====================================================
DROP INDEX IF EXISTS idx_orders_waiter_id;
DROP INDEX IF EXISTS idx_waiters_employee_id;
DROP INDEX IF EXISTS idx_waiters_status;

-- =====================================================
-- 5. DROP WAITERS TABLE
-- =====================================================
DROP TABLE IF EXISTS waiters CASCADE;

-- =====================================================
-- ROLLBACK COMPLETE
-- =====================================================
-- All waiter-related tables, views, and columns have been removed.
