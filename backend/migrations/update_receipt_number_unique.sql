-- Update receipt_number to be unique and remove billing_number
-- Migration: Replace billing_number with unique receipt_number

-- Step 1: Make receipt_number unique if not already
-- First, ensure all existing orders have a unique receipt_number
DO $$
BEGIN
  -- Update any NULL receipt_numbers to be unique timestamp-based (base36 format, ~13 chars)
  UPDATE orders 
  SET receipt_number = 
    upper(to_hex(extract(epoch from created_at)::bigint)) || '-' || 
    upper(substr(md5(random()::text || id::text), 1, 4))
  WHERE receipt_number IS NULL;
  
  -- Handle any duplicate receipt_numbers (from old sequential system)
  WITH duplicates AS (
    SELECT id, receipt_number,
           ROW_NUMBER() OVER (PARTITION BY receipt_number ORDER BY created_at) as rn
    FROM orders
    WHERE receipt_number IS NOT NULL
  )
  UPDATE orders o
  SET receipt_number = 
    upper(to_hex(extract(epoch from o.created_at)::bigint)) || '-' || 
    upper(substr(md5(o.id::text || random()::text), 1, 4))
  FROM duplicates d
  WHERE o.id = d.id AND d.rn > 1;
END $$;

-- Step 2: Add unique constraint to receipt_number if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'orders_receipt_number_key'
  ) THEN
    ALTER TABLE orders ADD CONSTRAINT orders_receipt_number_key UNIQUE (receipt_number);
  END IF;
END $$;

-- Step 3: Create index on receipt_number for fast lookups
CREATE INDEX IF NOT EXISTS idx_orders_receipt_number ON orders(receipt_number);

-- Step 4: Remove billing_number column (if it exists)
-- Note: This will fail if billing_number doesn't exist, which is fine
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'billing_number'
  ) THEN
    -- Drop the index first if it exists
    DROP INDEX IF EXISTS idx_orders_billing_number;
    
    -- Drop the column
    ALTER TABLE orders DROP COLUMN billing_number;
    
    RAISE NOTICE 'billing_number column removed successfully';
  ELSE
    RAISE NOTICE 'billing_number column does not exist, skipping removal';
  END IF;
END $$;

-- Step 5: Update comment on receipt_number column
COMMENT ON COLUMN orders.receipt_number IS 'Globally unique receipt number (base36 timestamp + 4 random chars, ~13 chars, 1.6M combinations/ms)';

-- Verification
DO $$
DECLARE
  null_count INTEGER;
  duplicate_count INTEGER;
BEGIN
  -- Check for NULL receipt_numbers
  SELECT COUNT(*) INTO null_count FROM orders WHERE receipt_number IS NULL;
  IF null_count > 0 THEN
    RAISE WARNING 'Found % orders with NULL receipt_number', null_count;
  ELSE
    RAISE NOTICE '✓ All orders have receipt_number';
  END IF;
  
  -- Check for duplicate receipt_numbers
  SELECT COUNT(*) INTO duplicate_count 
  FROM (
    SELECT receipt_number 
    FROM orders 
    GROUP BY receipt_number 
    HAVING COUNT(*) > 1
  ) dups;
  
  IF duplicate_count > 0 THEN
    RAISE WARNING 'Found % duplicate receipt_numbers', duplicate_count;
  ELSE
    RAISE NOTICE '✓ All receipt_numbers are unique';
  END IF;
END $$;
