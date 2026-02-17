-- Update existing payment statuses to match new check constraint
-- Run this in Supabase SQL Editor

-- First, update any existing 'successful' statuses to 'accepted'
UPDATE payments 
SET status = 'accepted' 
WHERE status = 'successful';

-- Update any existing 'failed' statuses to 'declined'
UPDATE payments 
SET status = 'declined' 
WHERE status = 'failed';

-- Verify the changes
SELECT status, COUNT(*) as count 
FROM payments 
GROUP BY status;

-- Success message
SELECT 'Existing payment statuses updated successfully. All payments now have statuses of pending, accepted, or declined.' AS statuses_updated;
