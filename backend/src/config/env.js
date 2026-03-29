require('dotenv').config();

module.exports = {
  app: {
    name: process.env.APP_NAME || 'Ukoperasi',
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT) || 3000,
    url: process.env.APP_URL || 'http://localhost:3000',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  },
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    name: process.env.DB_NAME || 'ukoperasi',
    user: process.env.DB_USER || 'root',
    pass: process.env.DB_PASS || '',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'default_secret_change_me',
    expires: process.env.JWT_EXPIRES || '8h',
    refreshExpires: process.env.JWT_REFRESH_EXPIRES || '7d',
  },
};
