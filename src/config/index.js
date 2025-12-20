const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

module.exports = {
  port: process.env.PORT || 4000,
  jwtSecret: process.env.JWT_SECRET || 'super-secret-key',
  databasePath: process.env.DATABASE_PATH || path.resolve(process.cwd(), 'storage/data.db')
};
