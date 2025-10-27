const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');
const { getDb } = require('../utils/database');

const db = getDb();

const listCustomers = (req, res) => {
  const { search } = req.query;
  let query = 'SELECT * FROM customers';
  let params = [];

  if (search) {
    query += ' WHERE name LIKE ? OR phone LIKE ?';
    params = [`%${search}%`, `%${search}%`];
  }

  query += ' ORDER BY created_at DESC';
  const customers = db.prepare(query).all(...params);
  res.json(customers);
};

const createCustomer = (req, res) => {
  const { name, phone, email, notes } = req.body;
  if (!name || !phone) {
    return res.status(400).json({ message: 'Name and phone are required' });
  }

  const existing = db.prepare('SELECT 1 FROM customers WHERE phone = ?').get(phone);
  if (existing) {
    return res.status(409).json({ message: 'Customer with this phone already exists' });
  }

  const id = uuidv4();
  const now = dayjs().toISOString();
  db.prepare(
    'INSERT INTO customers (id, name, phone, email, notes, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, name, phone, email || null, notes || null, now);

  res.status(201).json(db.prepare('SELECT * FROM customers WHERE id = ?').get(id));
};

const getCustomer = (req, res) => {
  const { id } = req.params;
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
  if (!customer) {
    return res.status(404).json({ message: 'Customer not found' });
  }

  const devices = db.prepare('SELECT * FROM devices WHERE customer_id = ? ORDER BY created_at DESC').all(id);
  const jobs = db.prepare('SELECT * FROM jobs WHERE customer_id = ? ORDER BY created_at DESC').all(id);

  res.json({ ...customer, devices, jobs });
};

const updateCustomer = (req, res) => {
  const { id } = req.params;
  const { name, phone, email, notes } = req.body;

  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
  if (!customer) {
    return res.status(404).json({ message: 'Customer not found' });
  }

  db.prepare(
    'UPDATE customers SET name = ?, phone = ?, email = ?, notes = ? WHERE id = ?'
  ).run(name || customer.name, phone || customer.phone, email || customer.email, notes || customer.notes, id);

  res.json(db.prepare('SELECT * FROM customers WHERE id = ?').get(id));
};

const deleteCustomer = (req, res) => {
  const { id } = req.params;
  db.prepare('DELETE FROM customers WHERE id = ?').run(id);
  res.status(204).send();
};

module.exports = {
  listCustomers,
  createCustomer,
  getCustomer,
  updateCustomer,
  deleteCustomer
};
