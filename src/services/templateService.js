const { getDb } = require('../utils/database');
const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');

const db = getDb();

const listTemplates = () => {
  return db.prepare('SELECT * FROM message_templates ORDER BY created_at DESC').all();
};

const createTemplate = ({ name, category, body }) => {
  const id = uuidv4();
  const now = dayjs().toISOString();
  db.prepare(
    'INSERT INTO message_templates (id, name, category, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)' 
  ).run(id, name, category, body, now, now);
  return db.prepare('SELECT * FROM message_templates WHERE id = ?').get(id);
};

const updateTemplate = (id, { name, category, body }) => {
  const now = dayjs().toISOString();
  db.prepare(
    'UPDATE message_templates SET name = ?, category = ?, body = ?, updated_at = ? WHERE id = ?'
  ).run(name, category, body, now, id);
  return db.prepare('SELECT * FROM message_templates WHERE id = ?').get(id);
};

const deleteTemplate = (id) => {
  db.prepare('DELETE FROM message_templates WHERE id = ?').run(id);
};

const renderTemplate = (body, variables = {}) => {
  return body.replace(/\{(.*?)\}/g, (_, key) => {
    const trimmed = key.trim();
    return Object.prototype.hasOwnProperty.call(variables, trimmed) ? variables[trimmed] : `{${trimmed}}`;
  });
};

module.exports = {
  listTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  renderTemplate
};
