-- Check payment status check constraint from system catalog
-- Run this in Supabase SQL Editor

SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM 
    pg_constraint 
WHERE 
    conrelid = 'payments'::regclass
    AND contype = 'c';
