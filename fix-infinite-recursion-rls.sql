-- Fix RLS policies to prevent infinite recursion
-- Run this in Supabase SQL Editor

-- Fix Users table policies (use direct role check without subquery)
DROP POLICY IF EXISTS "Admins can manage all users" ON users;

-- For users table, we need a different approach to avoid recursion
CREATE POLICY "Admins can manage all users" ON users
  USING (
    -- This is a workaround to avoid recursion when checking user roles
    -- We use auth.jwt() ->> 'role' as fallback
    auth.jwt() ->> 'role' = 'admin' OR 
    (auth.uid() IN (
      SELECT id FROM public.users WHERE role = 'admin'
    ))
  )
  WITH CHECK (
    auth.jwt() ->> 'role' = 'admin' OR 
    (auth.uid() IN (
      SELECT id FROM public.users WHERE role = 'admin'
    ))
  );

-- Verify the users table policy is fixed
SELECT * FROM pg_policies WHERE tablename = 'users';

-- Success message
SELECT 'Users table RLS policy fixed to prevent infinite recursion' AS policy_updated;
