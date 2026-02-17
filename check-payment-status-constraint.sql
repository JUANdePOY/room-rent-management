-- Check current payment status check constraint
-- Run this in Supabase SQL Editor

-- Show the current status values in the payments table
SELECT status, COUNT(*) as count 
FROM payments 
GROUP BY status;

-- Check the current check constraint on payments table
SELECT 
    conname AS constraint_name,
    consrc AS constraint_source
FROM 
    pg_constraint 
WHERE 
    conrelid = 'payments'::regclass
    AND contype = 'c';

-- Show the failing row (if any)
SELECT * 
FROM payments 
WHERE status NOT IN ('pending', 'accepted', 'declined');
