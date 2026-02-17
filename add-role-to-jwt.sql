-- Add role claim to JWT token
-- Run this in Supabase SQL Editor

-- 1. Create function to get user role from database
create or replace function public.get_user_role() 
returns text as $$
  select role from public.users where id = auth.uid();
$$ language sql stable;

-- 2. Create function to customize JWT claims
create or replace function public.custom_jwt_claims()
returns jsonb as $$
  select jsonb_build_object(
    'role', public.get_user_role()
  );
$$ language sql stable;

-- 3. Verify the function works
select public.custom_jwt_claims();

-- Success message
select 'Function to add role to JWT created successfully. Restart your session for changes to take effect.' as function_created;
