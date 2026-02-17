-- Disable the check constraint temporarily, update, then re-enable
-- Run this in Supabase SQL Editor

-- First, drop the check constraint completely
ALTER TABLE payments DROP CONSTRAINT payments_status_check;

-- Verify all rows have valid statuses
UPDATE payments 
SET status = 'accepted' 
WHERE status = 'successful';

UPDATE payments 
SET status = 'declined' 
WHERE status = 'failed';

-- Show all status values to confirm
SELECT status, COUNT(*) as count 
FROM payments 
GROUP BY status;

-- Now add the new check constraint
ALTER TABLE payments ADD CONSTRAINT payments_status_check CHECK (status IN ('pending', 'accepted', 'declined'));

-- Verify the constraint is working
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM 
    pg_constraint 
WHERE 
    conrelid = 'payments'::regclass
    AND contype = 'c';

-- Success message
SELECT 'Constraint disabled, all statuses updated, and new constraint added successfully.' AS task_completed;
