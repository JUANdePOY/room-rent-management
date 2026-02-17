-- Update tenant table columns
-- Run this in Supabase SQL Editor

-- Rename lease_start to start_date
ALTER TABLE tenants RENAME COLUMN lease_start TO start_date;

-- Rename lease_end to emergency_contact_name
ALTER TABLE tenants RENAME COLUMN lease_end TO emergency_contact_name;

-- Add emergency_contact_number column
ALTER TABLE tenants ADD COLUMN emergency_contact_number TEXT NOT NULL DEFAULT '';

-- Update the updated_at trigger function if needed
-- (This is usually handled automatically if you have the trigger installed)

-- Success message
SELECT 'Tenant table columns updated successfully. Renamed lease_start to start_date, lease_end to emergency_contact_name, and added emergency_contact_number.' AS columns_updated;
