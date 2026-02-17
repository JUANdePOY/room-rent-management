-- Update the payments table status check constraint to include new status values
-- Run this in Supabase SQL Editor

-- First, drop the existing check constraint
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_status_check;

-- Create the new check constraint with the updated status values
ALTER TABLE payments ADD CONSTRAINT payments_status_check CHECK (status IN ('pending', 'accepted', 'declined'));

-- Verify the constraint
SELECT conname, consrc 
FROM pg_constraint 
WHERE conrelid = 'payments'::regclass;

-- Success message
SELECT 'Payment status check constraint updated successfully to include pending, accepted, and declined statuses.' AS constraint_updated;
