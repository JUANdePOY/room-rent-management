-- Check current payment status values
-- Run this in Supabase SQL Editor

-- Show all current payment status values and their counts
SELECT status, COUNT(*) as count 
FROM payments 
GROUP BY status;

-- Show the failing row
SELECT * 
FROM payments 
WHERE id = 'ba4aa96d-35b8-449f-aff6-df4383740a0f';
