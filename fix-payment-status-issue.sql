-- Fix the payment status issue
-- Run this in Supabase SQL Editor

-- First, update the specific failing row
UPDATE payments 
SET status = 'accepted' 
WHERE id = 'ba4aa96d-35b8-449f-aff6-df4383740a0f';

-- Then update all other existing statuses
UPDATE payments 
SET status = 'accepted' 
WHERE status = 'successful' AND id != 'ba4aa96d-35b8-449f-aff6-df4383740a0f';

UPDATE payments 
SET status = 'declined' 
WHERE status = 'failed';

-- Now update the check constraint
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_status_check;
ALTER TABLE payments ADD CONSTRAINT payments_status_check CHECK (status IN ('pending', 'accepted', 'declined'));

-- Verify the changes
SELECT status, COUNT(*) as count 
FROM payments 
GROUP BY status;

-- Success message
SELECT 'Payment status issue fixed. All payments now have valid statuses and the check constraint has been updated.' AS issue_fixed;
