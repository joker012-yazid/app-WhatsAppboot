const { v4: uuidv4 } = require('uuid');
const path = require('path');
const dayjs = require('dayjs');
const QRCode = require('qrcode');
const multer = require('multer');
const fs = require('fs');
const { getDb } = require('../utils/database');
const templateService = require('../services/templateService');

const db = getDb();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.resolve(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const upload = multer({ storage });

const listJobs = (req, res) => {
  const { status, customer, from, to } = req.query;
  let query = `SELECT jobs.*, customers.name AS customer_name, devices.device_type, devices.brand, devices.model
               FROM jobs
               JOIN customers ON customers.id = jobs.customer_id
               JOIN devices ON devices.id = jobs.device_id`;
  const conditions = [];
  const params = [];

  if (status) {
    conditions.push('jobs.status = ?');
    params.push(status);
  }

  if (customer) {
    conditions.push('customers.name LIKE ?');
    params.push(`%${customer}%`);
  }

  if (from) {
    conditions.push('jobs.created_at >= ?');
    params.push(from);
  }

  if (to) {
    conditions.push('jobs.created_at <= ?');
    params.push(to);
  }

  if (conditions.length) {
    query += ` WHERE ${conditions.join(' AND ')}`;
  }

  query += ' ORDER BY jobs.created_at DESC';
  const jobs = db.prepare(query).all(...params);
  res.json(jobs);
};

const createJob = async (req, res) => {
  const { customer_id, device_id, title, description, priority, quoted_amount, due_date } = req.body;
  if (!customer_id || !device_id || !title) {
    return res.status(400).json({ message: 'customer_id, device_id and title are required' });
  }

  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customer_id);
  const device = db.prepare('SELECT * FROM devices WHERE id = ?').get(device_id);

  if (!customer || !device) {
    return res.status(404).json({ message: 'Customer or device not found' });
  }

  const id = uuidv4();
  const qrToken = uuidv4();
  const now = dayjs().toISOString();
  db.prepare(`
    INSERT INTO jobs (id, customer_id, device_id, title, description, priority, quoted_amount, due_date, qr_token, qr_expires_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    customer_id,
    device_id,
    title,
    description || null,
    priority || 'normal',
    quoted_amount || null,
    due_date || null,
    qrToken,
    dayjs().add(7, 'day').toISOString(),
    now,
    now
  );

  db.prepare('INSERT INTO job_status_history (id, job_id, status, notes) VALUES (?, ?, ?, ?)')
    .run(uuidv4(), id, 'pending', 'Job created');

  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(id);
  const qrUrl = `${req.protocol}://${req.get('host') || 'localhost'}/public/register/index.html?token=${qrToken}`;
  const qrImage = await QRCode.toDataURL(qrUrl);

  res.status(201).json({ job, qr_url: qrUrl, qr_image: qrImage });
};

const getJob = (req, res) => {
  const { id } = req.params;
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(id);
  if (!job) {
    return res.status(404).json({ message: 'Job not found' });
  }

  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(job.customer_id);
  const device = db.prepare('SELECT * FROM devices WHERE id = ?').get(job.device_id);
  const photos = db.prepare('SELECT * FROM job_photos WHERE job_id = ? ORDER BY created_at DESC').all(id);
  const statusHistory = db.prepare('SELECT * FROM job_status_history WHERE job_id = ? ORDER BY created_at DESC').all(id);
  const messages = db.prepare('SELECT * FROM job_messages WHERE job_id = ? ORDER BY created_at DESC').all(id);

  res.json({ job, customer, device, photos, status_history: statusHistory, messages });
};

const updateJob = (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM jobs WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ message: 'Job not found' });
  }

  const {
    title,
    description,
    status,
    priority,
    quoted_amount,
    approved_amount,
    diagnosis,
    due_date
  } = req.body;

  db.prepare(`
    UPDATE jobs
    SET title = ?,
        description = ?,
        status = ?,
        priority = ?,
        quoted_amount = ?,
        approved_amount = ?,
        diagnosis = ?,
        due_date = ?
    WHERE id = ?
  `).run(
    title || existing.title,
    description || existing.description,
    status || existing.status,
    priority || existing.priority,
    quoted_amount || existing.quoted_amount,
    approved_amount || existing.approved_amount,
    diagnosis || existing.diagnosis,
    due_date || existing.due_date,
    id
  );

  if (status && status !== existing.status) {
    db.prepare('INSERT INTO job_status_history (id, job_id, status, notes) VALUES (?, ?, ?, ?)')
      .run(uuidv4(), id, status, `Status updated from ${existing.status} to ${status}`);
  }

  res.json(db.prepare('SELECT * FROM jobs WHERE id = ?').get(id));
};

const deleteJob = (req, res) => {
  const { id } = req.params;
  db.prepare('DELETE FROM jobs WHERE id = ?').run(id);
  res.status(204).send();
};

const uploadPhotos = [
  upload.array('photos', 6),
  (req, res) => {
    const { id } = req.params;
    const job = db.prepare('SELECT 1 FROM jobs WHERE id = ?').get(id);
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    const { label } = req.body;
    const saved = req.files.map((file) => {
      const photoId = uuidv4();
      db.prepare(
        'INSERT INTO job_photos (id, job_id, label, file_path) VALUES (?, ?, ?, ?)'
      ).run(photoId, id, label || 'documentation', path.relative(process.cwd(), file.path));
      return db.prepare('SELECT * FROM job_photos WHERE id = ?').get(photoId);
    });

    res.status(201).json(saved);
  }
];

const registerFromQr = (req, res) => {
  const { token } = req.params;
  const job = db.prepare('SELECT * FROM jobs WHERE qr_token = ?').get(token);
  if (!job) {
    return res.status(404).json({ message: 'Invalid or expired QR token' });
  }

  if (job.qr_expires_at && dayjs(job.qr_expires_at).isBefore(dayjs())) {
    return res.status(410).json({ message: 'Registration link has expired' });
  }

  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(job.customer_id);
  const device = db.prepare('SELECT * FROM devices WHERE id = ?').get(job.device_id);

  res.json({ job, customer, device });
};

const completeRegistration = (req, res) => {
  const { token } = req.params;
  const {
    name,
    phone,
    device_type,
    model,
    accept_terms
  } = req.body;

  if (!accept_terms) {
    return res.status(400).json({ message: 'Terms must be accepted' });
  }

  const job = db.prepare('SELECT * FROM jobs WHERE qr_token = ?').get(token);
  if (!job) {
    return res.status(404).json({ message: 'Invalid or expired QR token' });
  }

  if (job.qr_expires_at && dayjs(job.qr_expires_at).isBefore(dayjs())) {
    return res.status(410).json({ message: 'Registration link has expired' });
  }

  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(job.customer_id);
  if (name && phone) {
    db.prepare('UPDATE customers SET name = ?, phone = ? WHERE id = ?')
      .run(name, phone, customer.id);
  }

  if (device_type || model) {
    db.prepare('UPDATE devices SET device_type = ?, model = ? WHERE id = ?')
      .run(device_type || null, model || null, job.device_id);
  }

  res.json({ message: 'Registration completed' });
};

const sendTemplatePreview = (req, res) => {
  const { templateId } = req.params;
  const template = db.prepare('SELECT * FROM message_templates WHERE id = ?').get(templateId);
  if (!template) {
    return res.status(404).json({ message: 'Template not found' });
  }

  const { variables } = req.body;
  const rendered = templateService.renderTemplate(template.body, variables || {});
  res.json({ preview: rendered });
};

module.exports = {
  listJobs,
  createJob,
  getJob,
  updateJob,
  deleteJob,
  uploadPhotos,
  registerFromQr,
  completeRegistration,
  sendTemplatePreview
};
