const bcrypt = require('bcryptjs');
const { Client } = require('pg');
require('dotenv').config();

async function seed() {
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('Seeding database...');
    await client.query('BEGIN');

    // ── Users ──────────────────────────────────────────────
    const passwordHash = await bcrypt.hash('Axialogy2024!', 10);

    const { rows: [owner] } = await client.query(`
      INSERT INTO users (name, email, username, password_hash, role)
      VALUES ('Admin User', 'admin@axialogy.com', 'admin', $1, 'admin')
      ON CONFLICT (email) DO UPDATE SET name=EXCLUDED.name, role='admin' RETURNING id
    `, [passwordHash]);

    const { rows: [member1] } = await client.query(`
      INSERT INTO users (name, email, username, password_hash, role)
      VALUES ('Sara Design', 'sara@axialogy.com', 'sara', $1, 'graphic_designer')
      ON CONFLICT (email) DO UPDATE SET name=EXCLUDED.name, role='graphic_designer' RETURNING id
    `, [passwordHash]);

    const { rows: [member2] } = await client.query(`
      INSERT INTO users (name, email, username, password_hash, role)
      VALUES ('Karim Dev', 'karim@axialogy.com', 'karim', $1, 'software_developer')
      ON CONFLICT (email) DO UPDATE SET name=EXCLUDED.name, role='software_developer' RETURNING id
    `, [passwordHash]);

    const { rows: [printer] } = await client.query(`
      INSERT INTO users (name, email, username, password_hash, role)
      VALUES ('Yacine Print', 'yacine@axialogy.com', 'yacine', $1, 'printer')
      ON CONFLICT (email) DO UPDATE SET name=EXCLUDED.name, role='printer' RETURNING id
    `, [passwordHash]);

    const { rows: [manager] } = await client.query(`
      INSERT INTO users (name, email, username, password_hash, role)
      VALUES ('Lina Ads', 'lina@axialogy.com', 'lina', $1, 'ads_manager')
      ON CONFLICT (email) DO UPDATE SET name=EXCLUDED.name, role='ads_manager' RETURNING id
    `, [passwordHash]);

    console.log('  ✓ Users created');


    // ── Clients ────────────────────────────────────────────
    const { rows: [client1] } = await client.query(`
      INSERT INTO clients (company_name, contact_name, contact_email, contact_phone, assigned_manager_id)
      VALUES ('TechVenture Co.', 'Maria Silva', 'maria@techventure.com', '+1-555-0101', $1)
      ON CONFLICT DO NOTHING RETURNING id
    `, [manager.id]);

    const { rows: [client2] } = await client.query(`
      INSERT INTO clients (company_name, contact_name, contact_email, contact_phone, assigned_manager_id)
      VALUES ('BrightBrand Inc.', 'John Chen', 'john@brightbrand.com', '+1-555-0202', $1)
      ON CONFLICT DO NOTHING RETURNING id
    `, [manager.id]);

    const { rows: [client3] } = await client.query(`
      INSERT INTO clients (company_name, contact_name, contact_email, contact_phone, assigned_manager_id)
      VALUES ('GlobalReach LLC', 'Emma Watson', 'emma@globalreach.com', '+1-555-0303', $1)
      ON CONFLICT DO NOTHING RETURNING id
    `, [owner.id]);

    // Handle conflict (re-read if needed)
    let c1id = client1?.id, c2id = client2?.id, c3id = client3?.id;
    if (!c1id) {
      const res = await client.query(`SELECT id FROM clients WHERE company_name='TechVenture Co.' LIMIT 1`);
      c1id = res.rows[0]?.id;
    }
    if (!c2id) {
      const res = await client.query(`SELECT id FROM clients WHERE company_name='BrightBrand Inc.' LIMIT 1`);
      c2id = res.rows[0]?.id;
    }
    if (!c3id) {
      const res = await client.query(`SELECT id FROM clients WHERE company_name='GlobalReach LLC' LIMIT 1`);
      c3id = res.rows[0]?.id;
    }

    console.log('  ✓ Clients created');

    // ── Client Services ────────────────────────────────────
    await client.query(`
      INSERT INTO client_services (client_id, service_type, start_date, delivery_status)
      VALUES
        ($1, 'graphic_design', CURRENT_DATE - INTERVAL '60 days', 'on_track'),
        ($1, 'digital_marketing', CURRENT_DATE - INTERVAL '30 days', 'on_track'),
        ($2, 'dev_transformation', CURRENT_DATE - INTERVAL '90 days', 'at_risk'),
        ($3, 'content_courses', CURRENT_DATE - INTERVAL '15 days', 'on_track'),
        ($3, 'digital_marketing', CURRENT_DATE - INTERVAL '15 days', 'on_track')
      ON CONFLICT DO NOTHING
    `, [c1id, c2id, c3id]);

    console.log('  ✓ Client services created');

    // ── Tasks ──────────────────────────────────────────────
    const { rows: [task1] } = await client.query(`
      INSERT INTO tasks (client_id, title, description, service_type, assignee_id, deadline, status)
      VALUES ($1, 'Design Q2 Brand Identity Pack', 'Full brand refresh including logo, color palette, and typography guide', 'graphic_design', $2, CURRENT_DATE + 7, 'in_progress')
      RETURNING id
    `, [c1id, member1.id]);

    const { rows: [task2] } = await client.query(`
      INSERT INTO tasks (client_id, title, description, service_type, assignee_id, deadline, status)
      VALUES ($1, 'Launch May Social Campaign', 'Instagram + LinkedIn content calendar for May', 'digital_marketing', $2, CURRENT_DATE + 14, 'not_started')
      RETURNING id
    `, [c1id, member2.id]);

    const { rows: [task3] } = await client.query(`
      INSERT INTO tasks (client_id, title, description, service_type, assignee_id, deadline, status, review_status)
      VALUES ($1, 'Website Redesign - Homepage', 'Rebuild homepage with new SaaS layout', 'dev_transformation', $2, CURRENT_DATE - 2, 'in_progress', 'submitted')
      RETURNING id
    `, [c2id, member1.id]);

    const { rows: [task4] } = await client.query(`
      INSERT INTO tasks (client_id, title, description, service_type, assignee_id, deadline, status)
      VALUES ($1, 'Content Strategy Document', 'Q2 content plan with SEO keywords', 'content_courses', $2, CURRENT_DATE + 3, 'not_started')
      RETURNING id
    `, [c3id, member2.id]);

    console.log('  ✓ Tasks created');

    // ── Quotations ─────────────────────────────────────────
    const { rows: [quote1] } = await client.query(`
      INSERT INTO quotations (client_id, quote_number, status, notes)
      VALUES ($1, 'QT-2026-001', 'approved', 'Brand identity full package - approved by client')
      RETURNING id
    `, [c1id]);

    const { rows: [quote2] } = await client.query(`
      INSERT INTO quotations (client_id, quote_number, status, notes)
      VALUES ($1, 'QT-2026-002', 'sent', 'Website redesign proposal - awaiting client approval')
      RETURNING id
    `, [c2id]);

    // Line items for quote1
    await client.query(`
      INSERT INTO quotation_line_items (quotation_id, description, quantity, unit_price)
      VALUES
        ($1, 'Logo Design & Brand Guidelines', 1, 2500.00),
        ($1, 'Color Palette & Typography System', 1, 800.00),
        ($1, 'Brand Assets Pack (Social, Print)', 1, 700.00)
    `, [quote1.id]);

    // Line items for quote2
    await client.query(`
      INSERT INTO quotation_line_items (quotation_id, description, quantity, unit_price)
      VALUES
        ($1, 'Homepage Redesign', 1, 3500.00),
        ($1, 'Mobile Responsive Implementation', 1, 1200.00)
    `, [quote2.id]);

    console.log('  ✓ Quotations created');

    // ── Invoices ───────────────────────────────────────────
    const { rows: [inv1] } = await client.query(`
      INSERT INTO invoices (client_id, quotation_id, invoice_number, status, due_date, notes)
      VALUES ($1, $2, 'INV-2026-001', 'paid', CURRENT_DATE - 10, 'Brand Identity Project - Paid in Full')
      RETURNING id
    `, [c1id, quote1.id]);

    const { rows: [inv2] } = await client.query(`
      INSERT INTO invoices (client_id, invoice_number, status, due_date, notes)
      VALUES ($1, 'INV-2026-002', 'overdue', CURRENT_DATE - 5, 'Digital Marketing Retainer - March')
      RETURNING id
    `, [c1id]);

    const { rows: [inv3] } = await client.query(`
      INSERT INTO invoices (client_id, invoice_number, status, due_date, notes)
      VALUES ($1, 'INV-2026-003', 'sent', CURRENT_DATE + 20, 'Website Redesign - 50% Deposit')
      RETURNING id
    `, [c2id]);

    // Invoice line items
    await client.query(`
      INSERT INTO invoice_line_items (invoice_id, description, quantity, unit_price)
      VALUES
        ($1, 'Logo Design & Brand Guidelines', 1, 2500.00),
        ($1, 'Color Palette & Typography System', 1, 800.00),
        ($1, 'Brand Assets Pack (Social, Print)', 1, 700.00)
    `, [inv1.id]);

    await client.query(`
      INSERT INTO invoice_line_items (invoice_id, description, quantity, unit_price)
      VALUES
        ($1, 'Digital Marketing Management - March', 1, 1500.00)
    `, [inv2.id]);

    await client.query(`
      INSERT INTO invoice_line_items (invoice_id, description, quantity, unit_price)
      VALUES
        ($1, 'Homepage Redesign - 50% Deposit', 1, 1750.00),
        ($1, 'Mobile Responsive - 50% Deposit', 1, 600.00)
    `, [inv3.id]);

    console.log('  ✓ Invoices created');

    // ── Payments ───────────────────────────────────────────
    await client.query(`
      INSERT INTO payments (invoice_id, client_id, amount, payment_date, notes)
      VALUES ($1, $2, 4000.00, CURRENT_DATE - 15, 'Full payment received - bank transfer')
    `, [inv1.id, c1id]);

    console.log('  ✓ Payments created');

    // ── Ads Budgets ────────────────────────────────────────
    await client.query(`
      INSERT INTO ads_budgets (client_id, platform, allocated_budget, set_by)
      VALUES
        ($1, 'facebook', 2000.00, $4),
        ($1, 'google', 1500.00, $4),
        ($2, 'facebook', 3000.00, $4),
        ($2, 'tiktok', 1000.00, $4),
        ($3, 'facebook', 1500.00, $4),
        ($3, 'google', 2500.00, $4),
        ($3, 'tiktok', 800.00, $4)
      ON CONFLICT (client_id, platform) DO NOTHING
    `, [c1id, c2id, c3id, owner.id]);

    // ── Ads Spend Logs ─────────────────────────────────────
    await client.query(`
      INSERT INTO ads_spend_logs (client_id, platform, amount, spend_date, logged_by)
      VALUES
        ($1, 'facebook', 1800.00, CURRENT_DATE - 5, $4),
        ($1, 'google', 900.00, CURRENT_DATE - 3, $4),
        ($2, 'facebook', 1200.00, CURRENT_DATE - 7, $4),
        ($2, 'tiktok', 450.00, CURRENT_DATE - 2, $4),
        ($3, 'facebook', 300.00, CURRENT_DATE - 1, $4),
        ($3, 'google', 500.00, CURRENT_DATE - 4, $4)
    `, [c1id, c2id, c3id, manager.id]);

    console.log('  ✓ Ads budgets & spend logs created');

    // ── Fixed Expenses ─────────────────────────────────────
    await client.query(`
      INSERT INTO fixed_expenses (name, amount, frequency, category)
      VALUES
        ('Office Rent', 2500.00, 'monthly', 'Facilities'),
        ('Adobe Creative Cloud Teams', 599.99, 'monthly', 'Software'),
        ('Slack Pro', 87.50, 'monthly', 'Software'),
        ('Server Infrastructure', 350.00, 'monthly', 'Technology'),
        ('Annual Accounting Software', 1200.00, 'annual', 'Software')
    `);

    // ── Variable Expenses ──────────────────────────────────
    await client.query(`
      INSERT INTO variable_expenses (name, amount, category, linked_to_client, client_id, expense_date)
      VALUES
        ('Freelance Copywriter - March', 800.00, 'freelancer', true, $1, CURRENT_DATE - 20),
        ('Canva Pro Annual', 120.00, 'tool', false, null, CURRENT_DATE - 10),
        ('Print Materials for Client Pitch', 250.00, 'other', true, $2, CURRENT_DATE - 5)
    `, [c1id, c2id]);

    console.log('  ✓ Expenses created');

    // ── Client Notes ───────────────────────────────────────
    await client.query(`
      INSERT INTO client_notes (client_id, author_id, content)
      VALUES
        ($1, $3, 'Client prefers communication via email. Very responsive. Brand direction approved in last meeting.'),
        ($2, $3, 'Website timeline extended by 2 weeks due to client scope changes. Need to send updated proposal.')
    `, [c1id, c2id, owner.id]);

    console.log('  ✓ Client notes created');

    // ── Activity Log ───────────────────────────────────────
    await client.query(`
      INSERT INTO activity_log (client_id, user_id, action_type, description)
      VALUES
        ($1, $3, 'task_created', 'Task "Design Q2 Brand Identity Pack" created'),
        ($1, $3, 'invoice_sent', 'Invoice INV-2026-001 sent to TechVenture Co.'),
        ($1, $3, 'payment_received', 'Payment of $4,000.00 received for INV-2026-001'),
        ($2, $3, 'task_created', 'Task "Website Redesign - Homepage" created'),
        ($2, $3, 'task_status_changed', 'Task status changed to in_review')
    `, [c1id, c2id, owner.id]);

    console.log('  ✓ Activity log seeded');

    await client.query('COMMIT');
    console.log('\n✅ Database seeded successfully!');
    console.log('\n📋 Login credentials (all use password: Axialogy2024!):');
    console.log('   admin@axialogy.com   (username: admin)  → admin');
    console.log('   sara@axialogy.com    (username: sara)   → graphic_designer');
    console.log('   karim@axialogy.com   (username: karim)  → software_developer');
    console.log('   yacine@axialogy.com  (username: yacine) → printer');
    console.log('   lina@axialogy.com    (username: lina)   → ads_manager');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed error:', err);
    throw err;
  } finally {
    await client.end();
  }
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
