-- Fix RLS policies for billing tables to check role directly from database
-- Run this in Supabase SQL Editor

-- Drop existing policies on billing_rates table
DROP POLICY IF EXISTS "Admins can manage billing rates" ON billing_rates;

-- Create new policy that checks role directly from users table
CREATE POLICY "Admins can manage billing rates" ON billing_rates
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

-- Drop and recreate policy for electric_readings
DROP POLICY IF EXISTS "Admins can manage electric readings" ON electric_readings;

CREATE POLICY "Admins can manage electric readings" ON electric_readings
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

-- Drop and recreate policy for bill_items
DROP POLICY IF EXISTS "Admins can manage bill items" ON bill_items;

CREATE POLICY "Admins can manage bill items" ON bill_items
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

-- Verify the policies were created
SELECT * FROM pg_policies WHERE tablename IN ('billing_rates', 'electric_readings', 'bill_items');

-- Success message
SELECT 'Billing RLS policies fixed successfully. Policies now check role directly from database.' AS policies_updated;
