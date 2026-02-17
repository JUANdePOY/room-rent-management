-- Force update of payment status check constraint
-- Run this in Supabase SQL Editor

-- First, drop the existing check constraint
ALTER TABLE payments DROP CONSTRAINT payments_status_check;

-- Now add the new check constraint
ALTER TABLE payments ADD CONSTRAINT payments_status_check CHECK (status IN ('pending', 'accepted', 'declined'));

-- Verify the changes
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM 
    pg_constraint 
WHERE 
    conrelid = 'payments'::regclass
    AND contype = 'c';

-- Success message
SELECT 'Payment status check constraint updated successfully. Now allowing pending, accepted, and declined statuses.' AS constraint_updated;
