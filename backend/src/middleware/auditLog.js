const { AuditLog } = require('../models');

/**
 * Catat audit log ke database
 */
async function logAudit({ userId, tenantId, aksi, tabel, recordId, dataLama, dataBaru, req }) {
  try {
    await AuditLog.create({
      user_id:    userId,
      tenant_id:  tenantId,
      aksi,
      tabel,
      record_id:  recordId,
      data_lama:  dataLama || null,
      data_baru:  dataBaru || null,
      ip_address: req ? (req.headers['x-forwarded-for'] || req.socket?.remoteAddress) : null,
      user_agent: req ? req.headers['user-agent'] : null,
    });
  } catch (err) {
    console.error('[AUDIT] Failed to write audit log:', err.message);
  }
}

module.exports = { logAudit };
