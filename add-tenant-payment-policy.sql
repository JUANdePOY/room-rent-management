-- Add RLS policy for tenants to manage their own payments
-- Run this in Supabase SQL Editor

-- Allow tenants to view their own payments
CREATE POLICY "Tenants can view their own payments" ON payments
  USING (
    EXISTS (
      SELECT 1 FROM public.tenants 
      WHERE user_id = auth.uid() AND id = tenant_id
    )
  );

-- Allow tenants to insert their own payments
CREATE POLICY "Tenants can insert their own payments" ON payments
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tenants 
      WHERE user_id = auth.uid() AND id = tenant_id
    )
  );

-- Verify the policies
SELECT * FROM pg_policies WHERE tablename = 'payments';

-- Success message
SELECT 'Tenant payment RLS policies created successfully. Tenants can now view and submit their own payments.' AS policies_created;
