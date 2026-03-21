-- Migration to make bill_id optional in payments table
-- This allows tenants to make payments without a specific bill's UUID or existing bill

-- First, drop the NOT NULL constraint on bill_id
ALTER TABLE payments ALTER COLUMN bill_id DROP NOT NULL;

-- Then, update the foreign key constraint to allow ON DELETE SET NULL (optional but recommended)
-- First, we need to drop the existing foreign key constraint
-- Note: The constraint name might vary. Check your actual constraint name using:
-- SELECT conname FROM pg_constraint WHERE conrelid = 'payments'::regclass AND confrelid = 'bills'::regclass;

-- Assuming the foreign key constraint name is payments_bill_id_fkey
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_bill_id_fkey;

-- Recreate the foreign key constraint with ON DELETE SET NULL
ALTER TABLE payments 
ADD CONSTRAINT payments_bill_id_fkey 
FOREIGN KEY (bill_id) 
REFERENCES bills(id) 
ON DELETE SET NULL;

-- Verify the change
SELECT column_name, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'payments' AND column_name = 'bill_id';

-- Success message
SELECT 'bill_id column made optional in payments table successfully!' AS migration_complete;
