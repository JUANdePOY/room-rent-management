-- Full RLS Policies for Room Rent Management System
-- Run this in Supabase SQL Editor after quick-setup.sql

-- Drop existing policies first
DROP POLICY IF EXISTS "Allow all users to read users" ON users;
DROP POLICY IF EXISTS "Allow all users to read rooms" ON rooms;
DROP POLICY IF EXISTS "Allow all users to read tenants" ON tenants;
DROP POLICY IF EXISTS "Allow all users to read bills" ON bills;
DROP POLICY IF EXISTS "Allow all users to read payments" ON payments;
DROP POLICY IF EXISTS "Allow all users to read billing rates" ON billing_rates;
DROP POLICY IF EXISTS "Admins can manage billing rates" ON billing_rates;
DROP POLICY IF EXISTS "Allow all users to read electric readings" ON electric_readings;
DROP POLICY IF EXISTS "Admins can manage electric readings" ON electric_readings;
DROP POLICY IF EXISTS "Allow all users to read bill items" ON bill_items;
DROP POLICY IF EXISTS "Admins can manage bill items" ON bill_items;

-- Create secure RLS policies

-- Users table policies
CREATE POLICY "Users can read their own profile" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admins can manage all users" ON users
  USING (auth.jwt() ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

-- Rooms table policies
CREATE POLICY "All authenticated users can read rooms" ON rooms
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage all rooms" ON rooms
  USING (auth.jwt() ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

-- Tenants table policies
CREATE POLICY "Tenants can read their own tenant profile" ON tenants
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all tenants" ON tenants
  USING (auth.jwt() ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

-- Bills table policies
CREATE POLICY "Tenants can read their own bills" ON bills
  FOR SELECT USING (
    auth.jwt() ->> 'role' = 'tenant' AND
    tenant_id IN (
      SELECT id FROM tenants WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all bills" ON bills
  USING (auth.jwt() ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

-- Bill items table policies
CREATE POLICY "Tenants can read their own bill items" ON bill_items
  FOR SELECT USING (
    auth.jwt() ->> 'role' = 'tenant' AND
    bill_id IN (
      SELECT id FROM bills WHERE tenant_id IN (
        SELECT id FROM tenants WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Admins can manage all bill items" ON bill_items
  USING (auth.jwt() ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

-- Payments table policies
CREATE POLICY "Tenants can read their own payments" ON payments
  FOR SELECT USING (
    auth.jwt() ->> 'role' = 'tenant' AND
    tenant_id IN (
      SELECT id FROM tenants WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Tenants can create their own payments" ON payments
  FOR INSERT WITH CHECK (
    auth.jwt() ->> 'role' = 'tenant' AND
    tenant_id IN (
      SELECT id FROM tenants WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all payments" ON payments
  USING (auth.jwt() ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

-- Billing rates table policies
CREATE POLICY "All authenticated users can read billing rates" ON billing_rates
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage billing rates" ON billing_rates
  USING (auth.jwt() ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

-- Electric readings table policies
CREATE POLICY "All authenticated users can read electric readings" ON electric_readings
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage electric readings" ON electric_readings
  USING (auth.jwt() ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

-- Enable row level security if not already enabled
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE electric_readings ENABLE ROW LEVEL SECURITY;

-- Success message
SELECT 'RLS policies fixed successfully. Users can now only access their own data.' AS policies_fixed;
