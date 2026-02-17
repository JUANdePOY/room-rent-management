-- Create the admin user with the specific ID that the application is trying to access
INSERT INTO users (id, email, role) 
VALUES ('c76734ce-dacd-4f92-a8c6-ac1a5dbab4f1', 'admin@example.com', 'admin')
ON CONFLICT (id) DO UPDATE SET 
  email = EXCLUDED.email,
  role = EXCLUDED.role,
  updated_at = NOW();

-- Create a tenant user for testing
INSERT INTO users (id, email, role) 
VALUES ('a1b2c3d4-e5f6-7890-1234-567890abcdef', 'tenant@example.com', 'tenant')
ON CONFLICT (id) DO UPDATE SET 
  email = EXCLUDED.email,
  role = EXCLUDED.role,
  updated_at = NOW();

-- Verify the users were created
SELECT * FROM users;
