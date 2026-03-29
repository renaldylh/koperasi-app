const { Sequelize } = require('sequelize');
const config = require('./env');

const sequelize = new Sequelize(config.db.name, config.db.user, config.db.pass, {
  host: config.db.host,
  port: config.db.port,
  dialect: 'mysql',
  logging: config.app.env === 'development' ? console.log : false,
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
  define: {
    underscored: true,
    timestamps: true,
  },
  timezone: '+07:00',
});

async function connectDB() {
  try {
    await sequelize.authenticate();
    console.log('[DB] MySQL connected successfully.');
  } catch (err) {
    console.error('[DB] Connection failed:', err.message);
    process.exit(1);
  }
}

module.exports = { sequelize, connectDB };
