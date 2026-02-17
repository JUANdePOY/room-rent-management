-- Update bill items table to include remaining_balance as valid item type
-- Run this in Supabase SQL Editor

-- First, check the current check constraint
SELECT conname 
FROM pg_constraint 
WHERE conrelid = 'bill_items'::regclass 
AND contype = 'c';

-- Drop the existing check constraint (the name might vary, but this is the default)
ALTER TABLE bill_items DROP CONSTRAINT IF EXISTS bill_items_item_type_check;

-- Add new check constraint that includes remaining_balance
ALTER TABLE bill_items 
ADD CONSTRAINT bill_items_item_type_check 
CHECK (item_type IN ('room_rent', 'electricity', 'water', 'wifi', 'remaining_balance'));

-- Verify the changes
SELECT * 
FROM information_schema.table_constraints 
WHERE table_name = 'bill_items';

-- Success message
SELECT 'Bill items check constraint updated successfully! Now allows remaining_balance item type.' AS check_constraint_updated;
