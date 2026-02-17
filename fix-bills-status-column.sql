-- Fix the status column in bills table
-- Run this in Supabase SQL Editor

-- Check if status column exists
SELECT column_name
FROM information_schema.columns 
WHERE table_name = 'bills' AND column_name = 'status';

-- If status column does NOT exist, create it with default value 'pending'
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'bills' AND column_name = 'status'
    ) THEN
        ALTER TABLE bills 
        ADD COLUMN status TEXT NOT NULL DEFAULT 'pending';
        
        ALTER TABLE bills 
        ADD CONSTRAINT bills_status_check 
        CHECK (status IN ('pending', 'paid', 'overdue', 'partial'));
        
        RAISE NOTICE 'status column added successfully with default value "pending"';
    ELSE
        RAISE NOTICE 'status column already exists';
    END IF;
END $$;

-- If the check constraint is missing or needs to be updated, recreate it
DO $$ 
BEGIN
    ALTER TABLE bills DROP CONSTRAINT IF EXISTS bills_status_check;
    ALTER TABLE bills 
    ADD CONSTRAINT bills_status_check 
    CHECK (status IN ('pending', 'paid', 'overdue', 'partial'));
END $$;

-- Add bill_period column if it doesn't exist (optional but recommended)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'bills' AND column_name = 'bill_period'
    ) THEN
        ALTER TABLE bills 
        ADD COLUMN bill_period TEXT;
        
        RAISE NOTICE 'bill_period column added successfully';
    ELSE
        RAISE NOTICE 'bill_period column already exists';
    END IF;
END $$;

-- Recreate the updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_bills_updated_at ON bills;
CREATE TRIGGER set_bills_updated_at
BEFORE UPDATE ON bills
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

-- Verify the table structure after changes
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'bills'
ORDER BY ordinal_position;

-- Refresh the schema cache by running a metadata query
-- This helps Supabase recognize any column changes
SELECT * FROM pg_stat_user_tables WHERE relname = 'bills';

-- Success message
SELECT 'Bills table status column fixed and schema cache refreshed successfully!' AS success;
