-- Update rooms table with billing-related fields
-- Run this in Supabase SQL Editor

ALTER TABLE rooms 
ADD COLUMN IF NOT EXISTS electric_meter_number TEXT,
ADD COLUMN IF NOT EXISTS water_meter_number TEXT,
ADD COLUMN IF NOT EXISTS initial_electric_reading NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS initial_water_reading NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS wifi_included BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS water_included BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS electric_included BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS max_occupancy INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS deposit_amount NUMERIC(10,2) DEFAULT 0;

-- Create index for faster querying
CREATE INDEX IF NOT EXISTS idx_rooms_electric_meter ON rooms(electric_meter_number);
CREATE INDEX IF NOT EXISTS idx_rooms_water_meter ON rooms(water_meter_number);

-- Update updated_at trigger for rooms table if not exists
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_rooms_updated_at ON rooms;
CREATE TRIGGER set_rooms_updated_at
BEFORE UPDATE ON rooms
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

-- Grant necessary permissions (RLS policies)
-- Note: If you have existing RLS policies, you may need to update them
-- This is a basic policy for admin access
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all rooms" 
ON rooms 
FOR SELECT 
USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admins can update rooms" 
ON rooms 
FOR UPDATE 
USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admins can insert rooms" 
ON rooms 
FOR INSERT 
WITH CHECK (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admins can delete rooms" 
ON rooms 
FOR DELETE 
USING (auth.jwt() ->> 'role' = 'admin');
