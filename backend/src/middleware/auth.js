const jwt    = require('jsonwebtoken');
const config = require('../config/env');

/**
 * Middleware: Verifikasi JWT di header Authorization: Bearer <token>
 */
function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Token tidak ditemukan.' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, config.jwt.secret);
    req.user = payload; // { id, email, role, tenantId }
    next();
  } catch (err) {
    const msg = err.name === 'TokenExpiredError' ? 'Token kadaluarsa.' : 'Token tidak valid.';
    return res.status(401).json({ success: false, message: msg });
  }
}

/**
 * Middleware: Role-Based Access Control
 * @param {...string} roles daftar role yang diizinkan
 */
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ success: false, message: 'Belum login.' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Akses ditolak.' });
    }
    next();
  };
}

module.exports = { authenticate, authorize };
