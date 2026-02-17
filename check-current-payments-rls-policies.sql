-- Check current RLS policies on payments table
SELECT * FROM pg_policies WHERE tablename = 'payments';

-- Check if RLS is enabled on payments table
SELECT relname, relrowsecurity, relforcerowsecurity 
FROM pg_class 
WHERE relname = 'payments';

-- Check if payments table has tenant_id column
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'payments' AND column_name = 'tenant_id';
