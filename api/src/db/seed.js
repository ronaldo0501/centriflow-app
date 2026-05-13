require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function seed() {
  const client = await pool.connect();
  try {
    // Test org
    const orgResult = await client.query(`
      INSERT INTO organizations (name, slug, state, timezone, plan_tier, cw_enabled, status)
      VALUES ('Cedar Hills Water District', 'cedar-hills', 'UT', 'America/Denver', 'professional', false, 'active')
      ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `);
    const orgId = orgResult.rows[0].id;
    console.log(`  org   Cedar Hills Water District (${orgId})`);

    // Admin user
    const hash = await bcrypt.hash('Password123!', 10);
    await client.query(`
      INSERT INTO users (org_id, email, password_hash, name, role)
      VALUES ($1, 'admin@cedarhills.gov', $2, 'Admin User', 'admin')
      ON CONFLICT (email) DO NOTHING
    `, [orgId, hash]);
    console.log('  user  admin@cedarhills.gov / Password123!');

    // Test property
    const propResult = await client.query(`
      INSERT INTO properties (org_id, address_line1, city, state, zip, owner_name, owner_email)
      VALUES ($1, '123 Main St', 'Cedar Hills', 'UT', '84062', 'John Smith', 'jsmith@example.com')
      RETURNING id
    `, [orgId]);
    const propertyId = propResult.rows[0].id;
    console.log(`  prop  123 Main St, Cedar Hills UT (${propertyId})`);

    // Test device
    await client.query(`
      INSERT INTO devices (org_id, property_id, tag_number, assembly_type, size, manufacturer, model_number, hazard_classification, last_test_result, next_test_due)
      VALUES ($1, $2, 'CH-0001', 'RP', '1"', 'Watts', '009M2', 'high', 'pass', NOW() + INTERVAL '60 days')
      ON CONFLICT (org_id, tag_number) DO NOTHING
    `, [orgId, propertyId]);
    console.log('  device CH-0001 — Watts 009M2 1" RP');

    // Test tester
    await client.query(`
      INSERT INTO certified_testers (org_id, email, name, license_number, license_state, license_expiration, certifying_body, company_name, is_approved)
      VALUES ($1, 'tester@plumbingco.com', 'Jane Tester', 'UT-BF-12345', 'UT', NOW() + INTERVAL '1 year', 'ABPA', 'Utah Plumbing Co', true)
      ON CONFLICT DO NOTHING
    `, [orgId]);
    console.log('  tester Jane Tester — UT-BF-12345');

    console.log('\nSeed complete. Login: admin@cedarhills.gov / Password123!');
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
