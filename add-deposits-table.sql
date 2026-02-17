-- Add Deposits Table
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS deposits (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  deposit_date TIMESTAMPTZ NOT NULL,
  refund_date TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('active', 'refunded', 'forfeited')),
  method TEXT NOT NULL CHECK (method IN ('gcash', 'bank', 'in_person')),
  reference_number TEXT,
  received_by TEXT,
  receipt_image TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE deposits ENABLE ROW LEVEL SECURITY;

-- Create trigger for updated_at
CREATE TRIGGER trigger_deposits_updated_at
BEFORE UPDATE ON deposits
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

-- Create RLS Policies
CREATE POLICY "Allow all users to read deposits" ON deposits
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage deposits" ON deposits
  USING (auth.jwt() ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

-- Enable Postgres Real-Time
ALTER PUBLICATION supabase_realtime ADD TABLE deposits;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_deposits_tenant_id ON deposits(tenant_id);
CREATE INDEX IF NOT EXISTS idx_deposits_room_id ON deposits(room_id);
CREATE INDEX IF NOT EXISTS idx_deposits_status ON deposits(status);

-- Success message
SELECT 'Deposits table created successfully' AS success;
