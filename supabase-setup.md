# Supabase Database Setup Guide for Room Rent Management System

This guide provides detailed steps to set up your Supabase database for the room rent management system.

## Prerequisites

1. Create a Supabase account at [supabase.com](https://supabase.com)
2. Create a new project
3. Obtain your project credentials from Settings > API:
   - `NEXT_PUBLIC_SUPABASE_URL`: Project URL (e.g., https://abc123.supabase.co)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Public API key
4. Update your `.env.local` file with these credentials

## Database Setup Steps

### Step 1: Create Tables

Execute the following SQL scripts in the Supabase SQL Editor (SQL > SQL Editor):

#### Users Table
```sql
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'tenant')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable row level security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
```

#### Rooms Table
```sql
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

-- Enable row level security
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
```

#### Tenants Table
```sql
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

-- Enable row level security
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_tenants_user_id ON tenants(user_id);
CREATE INDEX IF NOT EXISTS idx_tenants_room_id ON tenants(room_id);
```

#### Bills Table
```sql
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

-- Enable row level security
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_bills_tenant_id ON bills(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bills_room_id ON bills(room_id);
CREATE INDEX IF NOT EXISTS idx_bills_status ON bills(status);
```

#### Payments Table
```sql
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

-- Enable row level security
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_payments_bill_id ON payments(bill_id);
CREATE INDEX IF NOT EXISTS idx_payments_tenant_id ON payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
```

### Step 2: Create Row Level Security (RLS) Policies

#### Users Table Policies
```sql
-- Allow admins to manage all users
CREATE POLICY "Admins can view all users"
  ON users
  FOR SELECT
  USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admins can create users"
  ON users
  FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admins can update users"
  ON users
  FOR UPDATE
  USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admins can delete users"
  ON users
  FOR DELETE
  USING (auth.jwt() ->> 'role' = 'admin');

-- Allow users to view their own profile
CREATE POLICY "Users can view their own profile"
  ON users
  FOR SELECT
  USING (auth.uid()::TEXT = id::TEXT);
```

#### Rooms Table Policies
```sql
-- Allow admins to manage all rooms
CREATE POLICY "Admins can view all rooms"
  ON rooms
  FOR SELECT
  USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admins can create rooms"
  ON rooms
  FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admins can update rooms"
  ON rooms
  FOR UPDATE
  USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admins can delete rooms"
  ON rooms
  FOR DELETE
  USING (auth.jwt() ->> 'role' = 'admin');

-- Allow tenants to view rooms (read-only)
CREATE POLICY "Tenants can view rooms"
  ON rooms
  FOR SELECT
  USING (auth.jwt() ->> 'role' = 'tenant');
```

#### Tenants Table Policies
```sql
-- Allow admins to manage all tenants
CREATE POLICY "Admins can view all tenants"
  ON tenants
  FOR SELECT
  USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admins can create tenants"
  ON tenants
  FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admins can update tenants"
  ON tenants
  FOR UPDATE
  USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admins can delete tenants"
  ON tenants
  FOR DELETE
  USING (auth.jwt() ->> 'role' = 'admin');

-- Allow users to view their own tenant profile
CREATE POLICY "Users can view their own tenant profile"
  ON tenants
  FOR SELECT
  USING (auth.uid()::TEXT = user_id::TEXT);

-- Allow users to update their own tenant profile
CREATE POLICY "Users can update their own tenant profile"
  ON tenants
  FOR UPDATE
  USING (auth.uid()::TEXT = user_id::TEXT);
```

#### Bills Table Policies
```sql
-- Allow admins to manage all bills
CREATE POLICY "Admins can view all bills"
  ON bills
  FOR SELECT
  USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admins can create bills"
  ON bills
  FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admins can update bills"
  ON bills
  FOR UPDATE
  USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admins can delete bills"
  ON bills
  FOR DELETE
  USING (auth.jwt() ->> 'role' = 'admin');

-- Allow tenants to view their own bills
CREATE POLICY "Tenants can view their own bills"
  ON bills
  FOR SELECT
  USING (
    auth.jwt() ->> 'role' = 'tenant'
    AND tenant_id IN (
      SELECT id FROM tenants WHERE user_id = auth.uid()
    )
  );
```

#### Payments Table Policies
```sql
-- Allow admins to manage all payments
CREATE POLICY "Admins can view all payments"
  ON payments
  FOR SELECT
  USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admins can create payments"
  ON payments
  FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admins can update payments"
  ON payments
  FOR UPDATE
  USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admins can delete payments"
  ON payments
  FOR DELETE
  USING (auth.jwt() ->> 'role' = 'admin');

-- Allow tenants to view their own payments
CREATE POLICY "Tenants can view their own payments"
  ON payments
  FOR SELECT
  USING (
    auth.jwt() ->> 'role' = 'tenant'
    AND tenant_id IN (
      SELECT id FROM tenants WHERE user_id = auth.uid()
    )
  );

-- Allow tenants to create payments for their own bills
CREATE POLICY "Tenants can create their own payments"
  ON payments
  FOR INSERT
  WITH CHECK (
    auth.jwt() ->> 'role' = 'tenant'
    AND tenant_id IN (
      SELECT id FROM tenants WHERE user_id = auth.uid()
    )
  );
```

### Step 3: Create Storage Bucket for Receipt Images

1. Go to Storage > Policies
2. Create a new policy with the following settings:
   - Name: `Tenants can upload receipt images`
   - Allowed operation: INSERT
   - Policy definition:
     ```sql
     (auth.jwt() ->> 'role' = 'admin') OR (auth.jwt() ->> 'role' = 'tenant')
     ```

3. Create another policy:
   - Name: `Admins can manage all receipt images`
   - Allowed operation: ALL (SELECT, INSERT, UPDATE, DELETE)
   - Policy definition:
     ```sql
     auth.jwt() ->> 'role' = 'admin'
     ```

4. Create a policy for reading images:
   - Name: `Users can read receipt images`
   - Allowed operation: SELECT
   - Policy definition:
     ```sql
     true
     ```

### Step 4: Create SQL Functions for Common Operations

```sql
-- Function to get tenant bills with room information
CREATE OR REPLACE FUNCTION get_tenant_bills(p_tenant_id UUID)
RETURNS TABLE (
  id UUID,
  room_number TEXT,
  amount NUMERIC,
  due_date TIMESTAMPTZ,
  status TEXT,
  description TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.id,
    r.room_number,
    b.amount,
    b.due_date,
    b.status,
    b.description,
    b.created_at,
    b.updated_at
  FROM bills b
  JOIN rooms r ON b.room_id = r.id
  WHERE b.tenant_id = p_tenant_id;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate total payments per bill
CREATE OR REPLACE FUNCTION get_bill_payments_total(p_bill_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  total NUMERIC;
BEGIN
  SELECT COALESCE(SUM(amount_paid), 0) INTO total
  FROM payments 
  WHERE bill_id = p_bill_id AND status = 'successful';
  RETURN total;
END;
$$ LANGUAGE plpgsql;

-- Function to update bill status based on payments
CREATE OR REPLACE FUNCTION update_bill_status()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE bills
  SET status = CASE 
    WHEN (SELECT get_bill_payments_total(NEW.bill_id)) >= amount THEN 'paid'
    WHEN due_date < NOW() THEN 'overdue'
    ELSE 'pending'
  END
  WHERE id = NEW.bill_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update bill status when payment is created
CREATE TRIGGER trigger_update_bill_status
AFTER INSERT OR UPDATE ON payments
FOR EACH ROW
EXECUTE FUNCTION update_bill_status();
```

### Step 5: Seed Initial Data

```sql
-- Insert initial admin user (password: admin123)
INSERT INTO users (email, role) VALUES 
('admin@example.com', 'admin')
ON CONFLICT (email) DO NOTHING;

-- Insert sample rooms
INSERT INTO rooms (room_number, type, rent_amount, status, description) VALUES 
('101', 'Single', 5000.00, 'available', 'Single room with aircon'),
('102', 'Single', 5000.00, 'occupied', 'Single room with aircon'),
('201', 'Double', 8000.00, 'available', 'Double room with aircon and bathroom'),
('202', 'Double', 8000.00, 'available', 'Double room with aircon and bathroom'),
('301', 'Family', 12000.00, 'maintenance', 'Family room with 2 bedrooms')
ON CONFLICT (room_number) DO NOTHING;

-- Insert sample tenants (connected to admin user)
INSERT INTO tenants (user_id, room_id, name, contact, lease_start, lease_end) 
SELECT 
  u.id,
  r.id,
  'John Doe',
  '09171234567',
  '2024-01-01',
  '2024-12-31'
FROM users u, rooms r
WHERE u.email = 'admin@example.com' AND r.room_number = '102'
ON CONFLICT DO NOTHING;
```

### Step 6: Test the Database Connection

1. Update your `.env.local` file with your Supabase credentials
2. Run `npm run dev` to start the development server
3. Access the application at http://localhost:3000
4. Try to login or register a user
5. Verify that you can view and manage rooms, tenants, bills, and payments

## Additional Configuration

### Authentication Settings

1. Go to Authentication > Settings
2. Enable email/password authentication
3. Configure email templates for password reset and email verification
4. Set up social login providers if needed (Google, Facebook, etc.)

### Security Settings

1. Go to Security > Policies
2. Review all existing policies
3. Add additional policies as needed
4. Configure rate limiting for API endpoints

### Monitoring and Analytics

1. Go to Database > Logs to monitor queries
2. Use the Supabase Dashboard to view metrics and performance
3. Set up alerts for important events

## Troubleshooting

If you encounter any issues:

1. Check the Supabase Dashboard > Database > Logs for query errors
2. Verify your `.env.local` file has the correct credentials
3. Check that RLS policies are correctly configured
4. Test API calls using the Supabase Client
5. Verify storage bucket permissions are set correctly

## Backup and Maintenance

1. Set up automatic backups in Supabase Dashboard > Database > Backups
2. Regularly export your data for safekeeping
3. Monitor database performance and optimize queries
4. Update your database schema as the application evolves
