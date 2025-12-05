-- =============================================================================
-- Rollback Waiters System Migration
-- =============================================================================
-- This script rolls back all changes made by add_waiters_system.sql
-- USE WITH CAUTION: This will remove all waiter-related data
-- =============================================================================

-- Start transaction
BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Drop Views
-- -----------------------------------------------------------------------------
DROP VIEW IF EXISTS waiter_billing_stats CASCADE;
DROP VIEW IF EXISTS waiter_order_stats CASCADE;

RAISE NOTICE 'Dropped waiter statistics views';

-- -----------------------------------------------------------------------------
-- 2. Drop Triggers
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trigger_update_waiter_timestamp ON waiters;
DROP TRIGGER IF EXISTS trigger_update_order_modified ON orders;

RAISE NOTICE 'Dropped triggers';

-- -----------------------------------------------------------------------------
-- 3. Drop Functions
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS update_waiter_timestamp() CASCADE;
DROP FUNCTION IF EXISTS update_order_modified_timestamp() CASCADE;

RAISE NOTICE 'Dropped trigger functions';

-- -----------------------------------------------------------------------------
-- 4. Remove Columns from Bills Table
-- -----------------------------------------------------------------------------
ALTER TABLE bills 
DROP COLUMN IF EXISTS processed_by_waiter_id CASCADE;

RAISE NOTICE 'Removed waiter column from bills table';

-- -----------------------------------------------------------------------------
-- 5. Remove Columns from Orders Table
-- -----------------------------------------------------------------------------
ALTER TABLE orders 
DROP COLUMN IF EXISTS created_by_waiter_id CASCADE;

ALTER TABLE orders 
DROP COLUMN IF EXISTS modified_by_waiter_id CASCADE;

ALTER TABLE orders 
DROP COLUMN IF EXISTS billed_by_waiter_id CASCADE;

RAISE NOTICE 'Removed waiter columns from orders table';

-- -----------------------------------------------------------------------------
-- 6. Drop Order Modifications Table
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS order_modifications CASCADE;

RAISE NOTICE 'Dropped order_modifications table';

-- -----------------------------------------------------------------------------
-- 7. Drop Waiters Table
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS waiters CASCADE;

RAISE NOTICE 'Dropped waiters table';

-- -----------------------------------------------------------------------------
-- Rollback Complete
-- -----------------------------------------------------------------------------
RAISE NOTICE 'Waiters system rollback completed successfully!';
RAISE NOTICE 'All waiter-related tables, columns, views, and triggers have been removed.';

-- Commit transaction
COMMIT;

-- If you want to rollback instead, uncomment this:
-- ROLLBACK;
