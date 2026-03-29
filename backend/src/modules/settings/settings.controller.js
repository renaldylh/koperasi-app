const { Tenant, User, Setting } = require('../../models');
const { logAudit } = require('../../middleware/auditLog');
const { asyncHandler } = require('../../middleware/errorHandler');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ── Multer Storage Configuration ────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../../public/uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `logo-${Date.now()}${ext}`);
  }
});

exports.uploadMiddleware = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.png', '.jpg', '.jpeg', '.svg'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Format file tidak didukung (PNG/JPG/SVG)'));
  }
}).single('logo');

exports.getTenant = asyncHandler(async (req, res) => {
  const tenant = await Tenant.findByPk(req.user.tenantId, {
    attributes: ['id', 'nama', 'kode', 'alamat', 'no_badan_hukum']
  });
  res.json({ data: tenant });
});

exports.updateTenant = asyncHandler(async (req, res) => {
  const { nama, alamat, no_badan_hukum } = req.body;
  const tenant = await Tenant.findByPk(req.user.tenantId);
  
  if (nama) tenant.nama = nama;
  if (alamat) tenant.alamat = alamat;
  if (no_badan_hukum) tenant.no_badan_hukum = no_badan_hukum;
  
  await tenant.save();
  await logAudit({ userId: req.user.id, tenantId: req.user.tenantId, aksi: 'UPDATE', tabel: 'tenants', recordId: tenant.id, dataBaru: tenant, req });
  res.json({ message: 'Profil Koperasi berhasil diperbarui', data: tenant });
});

exports.listUsers = asyncHandler(async (req, res) => {
  const users = await User.findAll({
    where: { tenant_id: req.user.tenantId },
    attributes: ['id', 'nama', 'email', 'role', 'aktif', 'created_at'],
    order: [['created_at', 'DESC']]
  });
  res.json({ data: users });
});

exports.createUser = asyncHandler(async (req, res) => {
  const { nama, email, password, role } = req.body;
  
  if (!nama || !email || !password || !role) {
     return res.status(400).json({ message: 'Semua field wajib diisi' });
  }

  const existing = await User.findOne({ where: { email } });
  if (existing) return res.status(400).json({ message: 'Email sudah terdaftar' });

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await User.create({
    tenant_id: req.user.tenantId,
    nama,
    email,
    password: hashedPassword,
    role
  });

  const userData = user.toJSON();
  delete userData.password;
  
  await logAudit({ userId: req.user.id, tenantId: req.user.tenantId, aksi: 'CREATE', tabel: 'users', recordId: user.id, dataBaru: userData, req });
  res.status(201).json({ message: 'Akun operator baru berhasil dibuat', data: userData });
});

exports.toggleUserStatus = asyncHandler(async (req, res) => {
  const user = await User.findOne({ where: { id: req.params.id, tenant_id: req.user.tenantId } });
  if (!user) return res.status(404).json({ message: 'User tidak ditemukan' });
  if (user.id === req.user.id) return res.status(400).json({ message: 'Aksi tidak diijinkan pada akun sendiri' });

  user.aktif = !user.aktif;
  await user.save();
  res.json({ message: `Akun ${user.nama} berhasil di-${user.aktif ? 'aktifkan' : 'non-aktifkan'}`, data: user });
});

exports.updateUserPermissions = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { permissions } = req.body;
  const user = await User.findOne({ where: { id, tenant_id: req.user.tenantId } });
  if (!user) return res.status(404).json({ message: 'User tidak ditemukan' });

  user.permissions = permissions;
  await user.save();
  res.json({ message: 'Hak akses modul berhasil diperbarui', data: { id, permissions } });
});

// ─── DYNAMIC CONFIGURATION ──────────────────────────────────
exports.getSettings = asyncHandler(async (req, res) => {
  const settings = await Setting.findAll({
    where: { tenant_id: req.user.tenantId },
    order: [['group', 'ASC'], ['key', 'ASC']]
  });
  res.json({ data: settings });
});

exports.getSettingsPublic = asyncHandler(async (req, res) => {
  // Public branding & system status info
  const keys = [
    'nama_koperasi', 'app_name_alias', 'logo_url', 'theme_color', 
    'sidebar_bg_color', 'sidebar_text_color', 'topbar_bg_color',
    'app_footer_text', 'sidebar_logo_subtext', 'primary_font_family',
    'dashboard_welcome_msg', 'allow_self_register', 'maintenance_mode',
    'currency_symbol', 'decimal_places'
  ];
  const settings = await Setting.findAll({
    where: { key: keys },
    attributes: ['key', 'value']
  });
  res.json({ data: settings });
});

exports.updateSettings = asyncHandler(async (req, res) => {
  const { settings } = req.body; // Array of { key, value }
  
  if (!Array.isArray(settings)) {
    return res.status(400).json({ message: 'Format data settings tidak valid (harus array)' });
  }

  for (const item of settings) {
    const [row, created] = await Setting.findOrCreate({
      where: { tenant_id: req.user.tenantId, key: item.key },
      defaults: { value: String(item.value), group: item.group || 'umum', type: item.type || 'string' }
    });

    if (!created) {
      row.value = String(item.value);
      if (item.group) row.group = item.group;
      if (item.type) row.type = item.type;
      await row.save();
    }
  }

  await logAudit({ userId: req.user.id, tenantId: req.user.tenantId, aksi: 'UPDATE_BULK', tabel: 'settings', dataBaru: settings, req });
  res.json({ message: 'Pengaturan sistem berhasil diperbarui' });
});

exports.uploadLogo = asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'File tidak ditemukan' });

  const logoUrl = `/uploads/${req.file.filename}`;
  
  // Update or Create setting for logo_url
  const [row] = await Setting.findOrCreate({
    where: { tenant_id: req.user.tenantId, key: 'logo_url' },
    defaults: { value: logoUrl, group: 'branding', type: 'string' }
  });

  if (row) {
    row.value = logoUrl;
    await row.save();
  }

  await logAudit({ userId: req.user.id, tenantId: req.user.tenantId, aksi: 'UPLOAD_LOGO', tabel: 'settings', dataBaru: { logoUrl }, req });
  res.json({ message: 'Logo berhasil diupload', logoUrl });
});
