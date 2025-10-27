const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');
const { getDb } = require('../utils/database');

const db = getDb();

const listDevices = (req, res) => {
  const { customerId } = req.query;
  let query = `SELECT devices.*, customers.name AS customer_name
               FROM devices
               JOIN customers ON customers.id = devices.customer_id`;
  const params = [];

  if (customerId) {
    query += ' WHERE devices.customer_id = ?';
    params.push(customerId);
  }

  query += ' ORDER BY devices.created_at DESC';
  const devices = db.prepare(query).all(...params);
  res.json(devices);
};

const createDevice = (req, res) => {
  const { customer_id, device_type, brand, model, serial_number, notes } = req.body;
  if (!customer_id || !device_type) {
    return res.status(400).json({ message: 'customer_id and device_type are required' });
  }

  const customer = db.prepare('SELECT 1 FROM customers WHERE id = ?').get(customer_id);
  if (!customer) {
    return res.status(404).json({ message: 'Customer not found' });
  }

  const id = uuidv4();
  const now = dayjs().toISOString();
  db.prepare(`
    INSERT INTO devices (id, customer_id, device_type, brand, model, serial_number, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, customer_id, device_type, brand || null, model || null, serial_number || null, notes || null, now);

  res.status(201).json(db.prepare('SELECT * FROM devices WHERE id = ?').get(id));
};

const updateDevice = (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM devices WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ message: 'Device not found' });
  }

  const { device_type, brand, model, serial_number, notes } = req.body;
  db.prepare(`
    UPDATE devices SET device_type = ?, brand = ?, model = ?, serial_number = ?, notes = ? WHERE id = ?
  `).run(
    device_type || existing.device_type,
    brand || existing.brand,
    model || existing.model,
    serial_number || existing.serial_number,
    notes || existing.notes,
    id
  );

  res.json(db.prepare('SELECT * FROM devices WHERE id = ?').get(id));
};

const deleteDevice = (req, res) => {
  const { id } = req.params;
  db.prepare('DELETE FROM devices WHERE id = ?').run(id);
  res.status(204).send();
};

module.exports = {
  listDevices,
  createDevice,
  updateDevice,
  deleteDevice
};
