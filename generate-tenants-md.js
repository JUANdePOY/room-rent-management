const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read environment variables from .env.local
const envPath = path.resolve('.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};

envContent.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) {
    envVars[key.trim()] = value.trim();
  }
});

// Initialize Supabase client
const supabase = createClient(
  envVars.NEXT_PUBLIC_SUPABASE_URL,
  envVars.SUPABASE_SERVICE_ROLE_KEY
);

async function generateTenantsMarkdown() {
  console.log('Fetching tenant users from database...');

  try {
    // Fetch all tenant users
    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .eq('role', 'tenant');

    if (error) {
      throw new Error(`Error fetching users: ${error.message}`);
    }

    if (!users || users.length === 0) {
      console.log('No tenant users found in the database');
      return;
    }

    console.log(`Found ${users.length} tenant users`);

    // Fetch tenant profiles to get additional information
    const { data: tenants, error: tenantsError } = await supabase
      .from('tenants')
      .select('*');

    if (tenantsError) {
      throw new Error(`Error fetching tenants: ${tenantsError.message}`);
    }

    // Fetch rooms information
    const { data: rooms, error: roomsError } = await supabase
      .from('rooms')
      .select('*');

    if (roomsError) {
      throw new Error(`Error fetching rooms: ${roomsError.message}`);
    }

    // Create a map of user_id to tenant and room information
    const tenantMap = new Map();
    tenants.forEach(tenant => {
      const room = rooms.find(room => room.id === tenant.room_id);
      tenantMap.set(tenant.user_id, {
        tenant,
        room
      });
    });

    // Generate Markdown content
    let markdownContent = '# Tenant Credentials\n\n';
    markdownContent += 'This document contains the login credentials for all tenants in the Room Rent Management System.\n\n';
    markdownContent += '## Generated on: ' + new Date().toLocaleString() + '\n\n';
    markdownContent += '| Name | Email | Room Number | Room Type | Rent Amount | Contact | Start Date |\n';
    markdownContent += '|------|-------|-------------|-----------|-------------|---------|------------|\n';

    // Process each tenant user
    users.forEach(user => {
      const tenantInfo = tenantMap.get(user.id);
      
      if (tenantInfo) {
        const { tenant, room } = tenantInfo;
        
        markdownContent += `| ${tenant.name} | ${user.email} | ${room.room_number} | ${room.type} | ${room.rent_amount.toFixed(2)} | ${tenant.contact} | ${new Date(tenant.start_date).toLocaleDateString()} |\n`;
      } else {
        // Handle case where user has no tenant profile
        markdownContent += `| - | ${user.email} | - | - | - | - | - |\n`;
      }
    });

    // Add password reset instructions
    markdownContent += '\n\n## Password Reset Instructions\n\n';
    markdownContent += '1. Tenants should visit the login page\n';
    markdownContent += '2. Click on "Forgot password"\n';
    markdownContent += '3. Enter their registered email address\n';
    markdownContent += '4. Check their email for a password reset link\n';
    markdownContent += '5. Follow the instructions to set a new password\n\n';

    // Add security notes
    markdownContent += '## Security Notes\n\n';
    markdownContent += '- This document contains sensitive information\n';
    markdownContent += '- Do not share this document publicly\n';
    markdownContent += '- Tenants should be advised to change their password after first login\n';
    markdownContent += '- Keep this document secure and delete it after sending credentials to tenants\n';

    // Write to file
    const fs = require('fs');
    const fileName = `tenant-credentials-${new Date().toISOString().split('T')[0]}.md`;
    fs.writeFileSync(fileName, markdownContent);
    
    console.log(`Successfully generated ${fileName}`);
    console.log(`The file contains credentials for ${users.length} tenants`);

  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Run the function
generateTenantsMarkdown();
