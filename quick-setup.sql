-- Quick Setup Script for Room Rent Management System
-- Run this in Supabase SQL Editor

-- 1. Enable UUID generation extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create Users Table
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'tenant')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 3. Create Rooms Table
CREATE TABLE IF NOT EXISTS rooms (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  room_number TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  rent_amount NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('available', 'occupied', 'maintenance')),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

-- 4. Create Tenants Table
CREATE TABLE IF NOT EXISTS tenants (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  contact TEXT NOT NULL,
  lease_start TIMESTAMPTZ NOT NULL,
  lease_end TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

-- 5. Create Bills Table
CREATE TABLE IF NOT EXISTS bills (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  due_date TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'overdue')),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE bills ENABLE ROW LEVEL SECURITY;

-- 6. Create Billing Rates Table
CREATE TABLE IF NOT EXISTS billing_rates (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  month_year TEXT NOT NULL UNIQUE,
  electricity_rate NUMERIC(10,4) NOT NULL,
  water_rate NUMERIC(10,2) NOT NULL,
  wifi_rate NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE billing_rates ENABLE ROW LEVEL SECURITY;

-- 7. Create Electric Readings Table
CREATE TABLE IF NOT EXISTS electric_readings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  month_year TEXT NOT NULL,
  reading NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(room_id, month_year)
);

ALTER TABLE electric_readings ENABLE ROW LEVEL SECURITY;

-- 8. Create Bill Items Table (for detailed billing breakdown)
CREATE TABLE IF NOT EXISTS bill_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  bill_id UUID NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('room_rent', 'electricity', 'water', 'wifi')),
  amount NUMERIC(10,2) NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE bill_items ENABLE ROW LEVEL SECURITY;

-- 9. Create Payments Table
CREATE TABLE IF NOT EXISTS payments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  bill_id UUID NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  amount_paid NUMERIC(10,2) NOT NULL,
  payment_date TIMESTAMPTZ NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('gcash', 'bank', 'in_person')),
  reference_number TEXT,
  received_by TEXT,
  receipt_image TEXT,
  status TEXT NOT NULL CHECK (status IN ('successful', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- 7. Create Basic RLS Policies (allow all for testing)
-- These are simplified policies for testing purposes
CREATE POLICY "Allow all users to read users" ON users
  FOR SELECT USING (true);

CREATE POLICY "Allow all users to read rooms" ON rooms
  FOR SELECT USING (true);

CREATE POLICY "Allow all users to read tenants" ON tenants
  FOR SELECT USING (true);

CREATE POLICY "Allow all users to read bills" ON bills
  FOR SELECT USING (true);

CREATE POLICY "Allow all users to read payments" ON payments
  FOR SELECT USING (true);

-- Allow admins to manage all data
CREATE POLICY "Admins can manage users" ON users
  USING (auth.jwt() ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admins can manage rooms" ON rooms
  USING (auth.jwt() ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admins can manage tenants" ON tenants
  USING (auth.jwt() ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admins can manage bills" ON bills
  USING (auth.jwt() ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admins can manage payments" ON payments
  USING (auth.jwt() ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

-- 8. Insert Sample Data
-- Insert sample rooms
INSERT INTO rooms (room_number, type, rent_amount, status, description) VALUES 
('101', 'Single', 5000.00, 'available', 'Single room with aircon'),
('102', 'Single', 5000.00, 'occupied', 'Single room with aircon'),
('201', 'Double', 8000.00, 'available', 'Double room with aircon and bathroom'),
('202', 'Double', 8000.00, 'available', 'Double room with aircon and bathroom'),
('301', 'Family', 12000.00, 'maintenance', 'Family room with 2 bedrooms')
ON CONFLICT (room_number) DO NOTHING;

-- 9. Create Function to Update Updated At Timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER trigger_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_rooms_updated_at
BEFORE UPDATE ON rooms
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_tenants_updated_at
BEFORE UPDATE ON tenants
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_bills_updated_at
BEFORE UPDATE ON bills
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

-- 10. Enable Postgres Real-Time
ALTER PUBLICATION supabase_realtime ADD TABLE users, rooms, tenants, bills, bill_items, payments, billing_rates, electric_readings;

-- 11. Create Triggers for updated_at
CREATE TRIGGER trigger_billing_rates_updated_at
BEFORE UPDATE ON billing_rates
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_electric_readings_updated_at
BEFORE UPDATE ON electric_readings
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

-- 12. Create RLS Policies for new tables
CREATE POLICY "Allow all users to read billing rates" ON billing_rates
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage billing rates" ON billing_rates
  USING (auth.jwt() ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Allow all users to read electric readings" ON electric_readings
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage electric readings" ON electric_readings
  USING (auth.jwt() ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Allow all users to read bill items" ON bill_items
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage bill items" ON bill_items
  USING (auth.jwt() ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

-- 11. Create Storage Bucket for Receipts
-- Note: You need to enable storage and create buckets through the dashboard
-- This SQL will create the bucket (run this if you have storage enabled)
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('receipts', 'receipts', true)
-- ON CONFLICT (id) DO NOTHING;

-- 12. Grant Necessary Permissions
GRANT USAGE ON SCHEMA public TO authenticated, anon, service_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO authenticated, anon, service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO authenticated, anon, service_role;

-- Optional: Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tenants_user_id ON tenants(user_id);
CREATE INDEX IF NOT EXISTS idx_tenants_room_id ON tenants(room_id);
CREATE INDEX IF NOT EXISTS idx_bills_tenant_id ON bills(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bills_room_id ON bills(room_id);
CREATE INDEX IF NOT EXISTS idx_bills_status ON bills(status);
CREATE INDEX IF NOT EXISTS idx_payments_bill_id ON payments(bill_id);
CREATE INDEX IF NOT EXISTS idx_payments_tenant_id ON payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- Success message
SELECT 'Database setup complete. You can now:
1. Create users in Authentication > Users
2. Add their roles in the users table
3. Test the login functionality

Sample users to create:
- Email: admin@example.com (role: admin)
- Email: tenant@example.com (role: tenant)' AS setup_complete;
