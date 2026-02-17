-- Temporary RLS Policies for testing purposes
-- Run this in Supabase SQL Editor to temporarily disable strict RLS

-- Drop existing policies first
DROP POLICY IF EXISTS "Tenants can read their own tenant profile" ON tenants;
DROP POLICY IF EXISTS "Admins can manage all tenants" ON tenants;
DROP POLICY IF EXISTS "Users can read their own profile" ON users;
DROP POLICY IF EXISTS "Admins can manage all users" ON users;
DROP POLICY IF EXISTS "All authenticated users can read rooms" ON rooms;
DROP POLICY IF EXISTS "Admins can manage all rooms" ON rooms;

-- Create temporary permissive policies
CREATE POLICY "Allow all authenticated users to read users" ON users
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all authenticated users to insert users" ON users
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow all authenticated users to update users" ON users
  FOR UPDATE USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow all authenticated users to delete users" ON users
  FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all authenticated users to read rooms" ON rooms
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all authenticated users to insert rooms" ON rooms
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow all authenticated users to update rooms" ON rooms
  FOR UPDATE USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow all authenticated users to delete rooms" ON rooms
  FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all authenticated users to read tenants" ON tenants
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all authenticated users to insert tenants" ON tenants
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow all authenticated users to update tenants" ON tenants
  FOR UPDATE USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow all authenticated users to delete tenants" ON tenants
  FOR DELETE USING (auth.role() = 'authenticated');

-- Success message
SELECT 'Temporary permissive RLS policies created. All authenticated users can manage all data. REMEMBER TO REVERT THESE POLICIES IN PRODUCTION!' AS policies_created;
