const { getDb } = require('../utils/database');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

const seed = async () => {
  const db = getDb();

  const adminEmail = 'admin@repairhub.local';
  const adminExists = db.prepare('SELECT 1 FROM users WHERE email = ?').get(adminEmail);
  if (!adminExists) {
    const passwordHash = await bcrypt.hash('admin123', 10);
    db.prepare(
      'INSERT INTO users (id, name, email, password, role) VALUES (?, ?, ?, ?, ?)'
    ).run(uuidv4(), 'Administrator', adminEmail, passwordHash, 'admin');
    console.log('Created default admin user (admin@repairhub.local / admin123)');
  }

  const customerCount = db.prepare('SELECT COUNT(*) as count FROM customers').get().count;
  if (customerCount === 0) {
    const customerId = uuidv4();
    db.prepare(
      'INSERT INTO customers (id, name, phone, email, notes) VALUES (?, ?, ?, ?, ?)'
    ).run(customerId, 'Ahmad Repair', '+60123456789', 'ahmad@example.com', 'Preferred customer');

    const deviceId = uuidv4();
    db.prepare(
      `INSERT INTO devices (id, customer_id, device_type, brand, model, serial_number, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(deviceId, customerId, 'Smartphone', 'Samsung', 'Galaxy S21', 'SN123456', 'Screen cracked');

    const jobId = uuidv4();
    db.prepare(
      `INSERT INTO jobs (id, customer_id, device_id, title, description, status, priority, quoted_amount)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(jobId, customerId, deviceId, 'Screen Replacement', 'Replace cracked screen and test', 'pending', 'high', 350);

    db.prepare(
      'INSERT INTO job_status_history (id, job_id, status, notes) VALUES (?, ?, ?, ?)'
    ).run(uuidv4(), jobId, 'pending', 'Job created from seed data');

    console.log('Seeded demo customer, device, and job');
  }
};

seed().then(() => {
  console.log('Seeding completed');
  process.exit(0);
}).catch((err) => {
  console.error('Seeding failed', err);
  process.exit(1);
});
