const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const config = require('../config');

const ensureDirectory = (filePath) => {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

let db;

const getDb = () => {
  if (!db) {
    ensureDirectory(config.databasePath);
    db = new Database(config.databasePath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
};

module.exports = {
  getDb
};
