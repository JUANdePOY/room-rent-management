-- Fix users table RLS policy to prevent infinite recursion
-- Run this in Supabase SQL Editor

-- Drop existing policy
DROP POLICY IF EXISTS "Admins can manage all users" ON users;

-- Create simple policy that only uses JWT token claim
CREATE POLICY "Admins can manage all users" ON users
  USING (auth.jwt() ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

-- Also ensure the select policy is working
DROP POLICY IF EXISTS "Users can read their own profile" ON users;

CREATE POLICY "Users can read their own profile" ON users
  FOR SELECT USING (auth.uid() = id);

-- Verify the policies
SELECT * FROM pg_policies WHERE tablename = 'users';

-- Success message
SELECT 'Users table RLS policies fixed to prevent infinite recursion' AS policy_updated;
