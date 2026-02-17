-- Create billing-related tables
-- Run this in Supabase SQL Editor after initial setup

-- Create Billing Rates Table
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

-- Create Electric Readings Table
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

-- Create Bill Items Table (for detailed billing breakdown)
CREATE TABLE IF NOT EXISTS bill_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  bill_id UUID NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('room_rent', 'electricity', 'water', 'wifi')),
  amount NUMERIC(10,2) NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE bill_items ENABLE ROW LEVEL SECURITY;

-- Create Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_billing_rates_updated_at
BEFORE UPDATE ON billing_rates
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_electric_readings_updated_at
BEFORE UPDATE ON electric_readings
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

-- Enable Postgres Real-Time for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE billing_rates, electric_readings, bill_items;

-- Create RLS Policies for new tables
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

-- Insert sample billing rates for testing
INSERT INTO billing_rates (month_year, electricity_rate, water_rate, wifi_rate) VALUES 
('2024-01', 12.50, 500.00, 300.00),
('2024-02', 12.80, 500.00, 300.00),
('2024-03', 13.20, 500.00, 300.00)
ON CONFLICT (month_year) DO NOTHING;

-- Insert sample electric readings for testing
INSERT INTO electric_readings (room_id, month_year, reading) VALUES 
((SELECT id FROM rooms WHERE room_number = '102'), '2024-01', 150.5),
((SELECT id FROM rooms WHERE room_number = '102'), '2024-02', 220.3),
((SELECT id FROM rooms WHERE room_number = '102'), '2024-03', 300.7)
ON CONFLICT (room_id, month_year) DO NOTHING;

-- Success message
SELECT 'Billing tables created successfully!' AS tables_created;
