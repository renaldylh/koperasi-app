// ============================================================
// UKOPERASI BACKEND — Main Entry Point
// ============================================================
require('dotenv').config();
const express     = require('express');
const cors        = require('cors');
const path        = require('path');
const helmet      = require('helmet');
const morgan      = require('morgan');
const rateLimit   = require('express-rate-limit');

const { connectDB, sequelize } = require('./config/database');
const { errorHandler }  = require('./middleware/errorHandler');
const { authenticate }  = require('./middleware/auth');
const { loadSettings }  = require('./middleware/settings');
const { initCronJobs }  = require('./utils/cronJobs');

// ── Route imports ────────────────────────────────────────────
const authRoutes      = require('./modules/auth/auth.routes');
const anggotaRoutes   = require('./modules/anggota/anggota.routes');
const simpananRoutes  = require('./modules/simpanan/simpanan.routes');
const pinjamanRoutes  = require('./modules/pinjaman/pinjaman.routes');
const akuntansiRoutes = require('./modules/akuntansi/akuntansi.routes');
const laporanRoutes   = require('./modules/laporan/laporan.routes');
const shuRoutes       = require('./modules/shu/shu.routes');
const settingsRoutes  = require('./modules/settings/settings.routes');
const excelRoutes     = require('./modules/excel/excel.routes');
const transaksiRoutes = require('./modules/transaksi/transaksi.routes');
const asetRoutes      = require('./modules/aset/aset.routes');
const memberRoutes    = require('./modules/member/member.routes');
const produkRoutes    = require('./modules/produk/produk.routes');
const penjualanRoutes = require('./modules/produk/penjualan.routes');
const { stats }       = require('./modules/dashboard/dashboard.controller');
const { asyncHandler }= require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Security Middleware ──────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
}));

// ── Rate Limiting ────────────────────────────────────────────
// ── General Middleware ───────────────────────────────────────
app.use(morgan(process.env.NODE_ENV === 'development' ? 'dev' : 'combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));
app.use(loadSettings); // Inject institutional settings (publicly needed for branding)

// ── Health Check & Public Routes ─────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', app: 'Ukoperasi', version: '1.0.0', time: new Date() }));
app.use('/api/auth', authRoutes);
app.use('/api/settings', settingsRoutes); // Some sub-routes are public (branding)
app.use('/api/member',   memberRoutes);   // Some sub-routes are public (login)

// ── Protected API Routes ─────────────────────────────────────
app.use(authenticate); // ALL routes below this line require valid JWT

app.use('/api/anggota',    anggotaRoutes);
app.use('/api/simpanan',   simpananRoutes);
app.use('/api/pinjaman',   pinjamanRoutes);
app.use('/api/akuntansi',  akuntansiRoutes);
app.use('/api/laporan',    laporanRoutes);
app.use('/api/shu',        shuRoutes);
app.use('/api/transaksi',  transaksiRoutes);
app.use('/api/excel',      excelRoutes);
app.use('/api/aset',       asetRoutes);
app.use('/api/produk',     produkRoutes);
app.use('/api/penjualan',  penjualanRoutes);
app.get('/api/dashboard',  asyncHandler(stats));

// ── 404 ──────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} tidak ditemukan.` }));

// ── Global Error Handler ─────────────────────────────────────
app.use(errorHandler);

// ── Start Server ─────────────────────────────────────────────
async function start() {
  await connectDB();
  if (process.env.NODE_ENV === 'development') {
    await sequelize.sync({ alter: false });
    console.log('[DB] Models synced.');
  }

  // Init Background Jobs
  initCronJobs();

  app.listen(PORT, () => {
    console.log(`\n✅ Ukoperasi Backend running on http://localhost:${PORT}`);
    console.log(`   Health: http://localhost:${PORT}/health\n`);
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
