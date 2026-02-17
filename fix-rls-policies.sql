-- Fix RLS Policies for Tenant Management
-- Run this in Supabase SQL Editor to fix the policy violation issue

-- Drop existing policies first
DROP POLICY IF EXISTS "Tenants can read their own tenant profile" ON tenants;
DROP POLICY IF EXISTS "Admins can manage all tenants" ON tenants;
DROP POLICY IF EXISTS "Users can read their own profile" ON users;
DROP POLICY IF EXISTS "Admins can manage all users" ON users;
DROP POLICY IF EXISTS "All authenticated users can read rooms" ON rooms;
DROP POLICY IF EXISTS "Admins can manage all rooms" ON rooms;

-- Create new policies that check role directly from database
CREATE POLICY "Admins can manage all users" ON users
  USING ( EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin') )
  WITH CHECK ( EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin') );

CREATE POLICY "Users can read their own profile" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admins can manage all rooms" ON rooms
  USING ( EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin') )
  WITH CHECK ( EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin') );

CREATE POLICY "All authenticated users can read rooms" ON rooms
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage all tenants" ON tenants
  USING ( EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin') )
  WITH CHECK ( EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin') );

CREATE POLICY "Tenants can read their own tenant profile" ON tenants
  FOR SELECT USING (auth.uid() = user_id);

-- Success message
SELECT 'RLS policies fixed. Now checking roles directly from database instead of JWT claims.' AS policies_fixed;
