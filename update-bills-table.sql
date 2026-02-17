-- Update bills table to include partial status
-- Run this in Supabase SQL Editor

-- First, check if we need to drop the existing check constraint
-- This will vary depending on how the constraint was named
-- To find the constraint name, run: SELECT conname FROM pg_constraint WHERE conrelid = 'bills'::regclass;

-- For most cases, the constraint name will be similar to "bills_status_check"
-- Drop the existing constraint (you may need to adjust the name if it's different)
ALTER TABLE bills DROP CONSTRAINT IF EXISTS bills_status_check;

-- Add the new check constraint with partial status
ALTER TABLE bills 
ADD CONSTRAINT bills_status_check 
CHECK (status IN ('pending', 'paid', 'overdue', 'partial'));

-- Optional: Add a column for bill period (month/year) to make it easier to track billing cycles
ALTER TABLE bills 
ADD COLUMN IF NOT EXISTS bill_period TEXT;

-- Update updated_at trigger for bills table if not exists
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

-- Verify the changes
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'bills';
