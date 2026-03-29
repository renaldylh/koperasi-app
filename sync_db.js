const { sequelize } = require('./backend/src/config/database');
const models = require('./backend/src/models');

async function syncDB() {
    try {
        console.log("Connecting to database...");
        await sequelize.authenticate();
        console.log("Database connected. Syncing tables...");
        
        // Force create tables if they don't exist
        await sequelize.sync({ alter: true });
        
        console.log("Success: All tables have been created/updated.");
        process.exit(0);
    } catch (err) {
        console.error("Sync failed:", err);
        process.exit(1);
    }
}

syncDB();
