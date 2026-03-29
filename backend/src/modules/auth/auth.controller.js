const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { User, Anggota } = require('../../models');
const { logAudit }      = require('../../middleware/auditLog');
const config            = require('../../config/env');

/**
 * POST /api/auth/login
 */
async function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ success: false, message: 'Email dan password wajib diisi.' });

  const user = await User.findOne({ where: { email, aktif: true } });
  if (!user) return res.status(401).json({ success: false, message: 'Email atau password salah.' });

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(401).json({ success: false, message: 'Email atau password salah.' });

  const payload = { id: user.id, email: user.email, role: user.role, tenantId: user.tenant_id };
  const token   = jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expires });

  await logAudit({ userId: user.id, tenantId: user.tenant_id, aksi: 'LOGIN', req });

  res.json({
    success: true,
    message: 'Login berhasil.',
    data: { token, user: { id: user.id, nama: user.nama, email: user.email, role: user.role } },
  });
}

/**
 * GET /api/auth/me
 */
async function me(req, res) {
  const user = await User.findByPk(req.user.id, { attributes: { exclude: ['password'] } });
  res.json({ success: true, data: user });
}

/**
 * POST /api/auth/register (superadmin only)
 */
async function register(req, res) {
  const { nama, email, password, role, tenant_id } = req.body;
  const existing = await User.findOne({ where: { email } });
  if (existing) return res.status(409).json({ success: false, message: 'Email sudah terdaftar.' });

  const hashed = await bcrypt.hash(password, 12);
  const user = await User.create({ nama, email, password: hashed, role, tenant_id });

  await logAudit({ userId: req.user.id, tenantId: tenant_id, aksi: 'CREATE', tabel: 'users', recordId: user.id, dataBaru: { nama, email, role }, req });
  res.status(201).json({ success: true, message: 'User berhasil dibuat.', data: { id: user.id } });
}

module.exports = { login, me, register };
