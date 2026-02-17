-- Test RLS Policies for billing_rates table
-- Run this in Supabase SQL Editor to verify permissions

-- Check current user role and JWT claims
select 
  auth.uid() as user_id,
  auth.role() as auth_role,
  auth.jwt() as full_jwt,
  auth.jwt() ->> 'role' as custom_role,
  public.get_user_role() as db_role
from auth.users limit 1;

-- Check if RLS is enabled on billing_rates
select relname, relrowsecurity 
from pg_class 
where relname = 'billing_rates';

-- Check existing RLS policies on billing_rates
select * 
from pg_policies 
where tablename = 'billing_rates';

-- Test SELECT permission (should return rates if you're authenticated)
select * from billing_rates;

-- Test if you can insert a test rate (will fail if not admin)
insert into billing_rates (month_year, electricity_rate, water_rate, wifi_rate) 
values ('2024-12', 10.0000, 500.00, 300.00) 
on conflict (month_year) do nothing
returning *;
