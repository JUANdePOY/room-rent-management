-- Update all payment statuses first then update the constraint
-- Run this in Supabase SQL Editor

-- First, update all existing statuses
UPDATE payments 
SET status = 'accepted' 
WHERE status = 'successful';

UPDATE payments 
SET status = 'declined' 
WHERE status = 'failed';

-- Verify all statuses are valid
SELECT status, COUNT(*) as count 
FROM payments 
GROUP BY status;

-- Now update the check constraint
ALTER TABLE payments DROP CONSTRAINT payments_status_check;
ALTER TABLE payments ADD CONSTRAINT payments_status_check CHECK (status IN ('pending', 'accepted', 'declined'));

-- Verify the constraint
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM 
    pg_constraint 
WHERE 
    conrelid = 'payments'::regclass
    AND contype = 'c';

-- Success message
SELECT 'All payment statuses updated and check constraint added successfully.' AS task_completed;
