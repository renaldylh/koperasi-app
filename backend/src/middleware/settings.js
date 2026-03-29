const { Setting } = require('../models');

/**
 * Middleware to load all tenant settings from the database 
 * and inject them into the request object (req.settings).
 */
const loadSettings = async (req, res, next) => {
  if (!req.user || !req.user.tenantId) return next();

  try {
    const settingsRows = await Setting.findAll({
      where: { tenant_id: req.user.tenantId }
    });

    // Convert array of rows into a convenient key-value object
    req.settings = {};
    settingsRows.forEach(s => {
      let val = s.value;
      if (s.type === 'number') val = parseFloat(val);
      if (s.type === 'boolean') val = val === 'true' || val === '1';
      if (s.type === 'json') {
        try { val = JSON.parse(val); } catch (e) { val = {}; }
      }
      req.settings[s.key] = val;
    });

    next();
  } catch (err) {
    console.error('[SETTINGS-MW] Error loading settings:', err);
    next(); // Continue even if settings fail to load (fallback to defaults in controllers)
  }
};

module.exports = { loadSettings };
