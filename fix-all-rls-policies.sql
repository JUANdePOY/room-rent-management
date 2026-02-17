-- Fix all RLS policies to check role directly from database
-- Run this in Supabase SQL Editor to fix all policies

-- Fix Users table policies
DROP POLICY IF EXISTS "Admins can manage all users" ON users;

CREATE POLICY "Admins can manage all users" ON users
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

-- Fix Rooms table policies
DROP POLICY IF EXISTS "Admins can manage all rooms" ON rooms;

CREATE POLICY "Admins can manage all rooms" ON rooms
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

-- Fix Tenants table policies
DROP POLICY IF EXISTS "Admins can manage all tenants" ON tenants;

CREATE POLICY "Admins can manage all tenants" ON tenants
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

-- Fix Bills table policies
DROP POLICY IF EXISTS "Admins can manage all bills" ON bills;

CREATE POLICY "Admins can manage all bills" ON bills
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

-- Fix Payments table policies
DROP POLICY IF EXISTS "Admins can manage all payments" ON payments;

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

-- Verify all policies
SELECT * FROM pg_policies;

-- Success message
SELECT 'All RLS policies fixed successfully. Policies now check role directly from database.' AS policies_updated;
