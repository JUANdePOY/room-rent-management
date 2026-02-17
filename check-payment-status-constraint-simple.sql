-- Check current payment status check constraint (simple version)
-- Run this in Supabase SQL Editor

-- Show all current payment status values and their counts
SELECT status, COUNT(*) as count 
FROM payments 
GROUP BY status;

-- Check if there are any status values that don't match the expected format
SELECT DISTINCT status 
FROM payments 
WHERE status NOT IN ('pending', 'accepted', 'declined');

-- Show the payments table schema
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'payments';
