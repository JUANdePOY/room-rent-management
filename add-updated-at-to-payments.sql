-- Add updated_at column to payments table
-- Run this in Supabase SQL Editor

-- 1. Add the updated_at column to payments table
ALTER TABLE payments 
ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Create a trigger to automatically update the updated_at column
CREATE TRIGGER trigger_payments_updated_at
BEFORE UPDATE ON payments
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

-- 3. Verify the changes
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'payments';

-- Success message
SELECT 'updated_at column added to payments table successfully' AS column_added;
