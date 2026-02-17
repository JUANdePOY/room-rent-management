-- Verify and fix payments RLS policy

-- Step 1: Check current RLS policies on payments table
SELECT 'Current RLS policies on payments table:' AS message;
SELECT * FROM pg_policies WHERE tablename = 'payments';

-- Step 2: Check if payments table has required columns
SELECT 'Checking if payments table has tenant_id column:' AS message;
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'payments' AND column_name IN ('tenant_id', 'id');

-- Step 3: Check if users table has role column
SELECT 'Checking if users table has role column:' AS message;
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'role';

-- Step 4: Create or replace payments table policies
-- First, drop existing policies
DROP POLICY IF EXISTS "Admins can manage all payments" ON payments;
DROP POLICY IF EXISTS "Tenants can view their own payments" ON payments;
DROP POLICY IF EXISTS "Tenants can insert their own payments" ON payments;

-- Create admin policy
CREATE POLICY "Admins can manage all payments" ON payments
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Create tenant policies for viewing and inserting their own payments
CREATE POLICY "Tenants can view their own payments" ON payments
  USING (
    EXISTS (
      SELECT 1 FROM public.tenants 
      WHERE user_id = auth.uid() AND id = tenant_id
    )
  );

CREATE POLICY "Tenants can insert their own payments" ON payments
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tenants 
      WHERE user_id = auth.uid() AND id = tenant_id
    )
  );

-- Step 5: Verify the policies were created
SELECT 'Verifying policies were created:' AS message;
SELECT * FROM pg_policies WHERE tablename = 'payments';

-- Step 6: Check if RLS is enabled on payments table
SELECT 'Checking RLS status on payments table:' AS message;
SELECT relname, relrowsecurity, relforcerowsecurity 
FROM pg_class 
WHERE relname = 'payments';

-- Step 7: Ensure RLS is enabled on payments table
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Success message
SELECT 'Payments RLS policies verified and fixed successfully.' AS success;
