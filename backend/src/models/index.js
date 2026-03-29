// ============================================================
// UKOPERASI — ALL SEQUELIZE MODELS
// ============================================================
const { DataTypes } = require('sequelize');
const { sequelize }  = require('../config/database');

// ─── TENANT ────────────────────────────────────────────────
const Tenant = sequelize.define('Tenant', {
  id:              { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  nama:            { type: DataTypes.STRING(200), allowNull: false },
  kode:            { type: DataTypes.STRING(20), allowNull: false, unique: true },
  alamat:          { type: DataTypes.TEXT },
  no_badan_hukum:  { type: DataTypes.STRING(100) },
  aktif:           { type: DataTypes.BOOLEAN, defaultValue: true },
}, { tableName: 'tenants' });

// ─── USER ───────────────────────────────────────────────────
const User = sequelize.define('User', {
  id:         { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenant_id:  { type: DataTypes.UUID, allowNull: false },
  anggota_id: { type: DataTypes.UUID },
  nama:       { type: DataTypes.STRING(150), allowNull: false },
  email:      { type: DataTypes.STRING(150), allowNull: false, unique: true },
  password:   { type: DataTypes.STRING(255), allowNull: false },
  role:       { type: DataTypes.ENUM('superadmin','admin','pengurus','anggota'), defaultValue: 'anggota' },
  permissions:{ type: DataTypes.JSON }, // JSON object of allowed modules: { "anggota": true, "simpanan": false, ... }
  aktif:      { type: DataTypes.BOOLEAN, defaultValue: true },
}, { tableName: 'users' });

// ─── ANGGOTA ────────────────────────────────────────────────
const Anggota = sequelize.define('Anggota', {
  id:              { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenant_id:       { type: DataTypes.UUID, allowNull: false },
  no_anggota:      { type: DataTypes.STRING(20), allowNull: false },
  nik:             { type: DataTypes.STRING(20), allowNull: false },
  nama:            { type: DataTypes.STRING(150), allowNull: false },
  tempat_lahir:    { type: DataTypes.STRING(100) },
  tanggal_lahir:   { type: DataTypes.DATEONLY },
  jenis_kelamin:   { type: DataTypes.ENUM('L','P') },
  alamat:          { type: DataTypes.TEXT },
  telepon:         { type: DataTypes.STRING(20) },
  pekerjaan:       { type: DataTypes.STRING(100) },
  tanggal_masuk:   { type: DataTypes.DATEONLY, allowNull: false },
  status:          { type: DataTypes.ENUM('aktif','non_aktif','keluar'), defaultValue: 'aktif' },
  foto_url:        { type: DataTypes.STRING(500) },
}, { tableName: 'anggota' });

// ─── REKENING (Chart of Accounts) ──────────────────────────
const Rekening = sequelize.define('Rekening', {
  id:           { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenant_id:    { type: DataTypes.UUID, allowNull: false },
  kode:         { type: DataTypes.STRING(20), allowNull: false },
  nama:         { type: DataTypes.STRING(200), allowNull: false },
  tipe:         { type: DataTypes.ENUM('aset','kewajiban','ekuitas','pendapatan','beban'), allowNull: false },
  posisi_normal:{ type: DataTypes.ENUM('D','K'), allowNull: false },
  parent_id:    { type: DataTypes.UUID },
  level:        { type: DataTypes.TINYINT, defaultValue: 1 },
  aktif:        { type: DataTypes.BOOLEAN, defaultValue: true },
}, { tableName: 'rekening' });

// ─── JURNAL HEADER ──────────────────────────────────────────
const JurnalHeader = sequelize.define('JurnalHeader', {
  id:              { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenant_id:       { type: DataTypes.UUID, allowNull: false },
  no_jurnal:       { type: DataTypes.STRING(30), allowNull: false },
  tanggal:         { type: DataTypes.DATEONLY, allowNull: false },
  referensi_tipe:  { type: DataTypes.STRING(50) },
  referensi_id:    { type: DataTypes.UUID },
  keterangan:      { type: DataTypes.TEXT },
  total_debit:     { type: DataTypes.DECIMAL(18,2), defaultValue: 0 },
  total_kredit:    { type: DataTypes.DECIMAL(18,2), defaultValue: 0 },
  user_id:         { type: DataTypes.UUID, allowNull: false },
}, { tableName: 'jurnal_header' });

// ─── JURNAL DETAIL ──────────────────────────────────────────
const JurnalDetail = sequelize.define('JurnalDetail', {
  id:               { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  jurnal_header_id: { type: DataTypes.UUID, allowNull: false },
  rekening_id:      { type: DataTypes.UUID, allowNull: false },
  posisi:           { type: DataTypes.ENUM('D','K'), allowNull: false },
  nominal:          { type: DataTypes.DECIMAL(18,2), allowNull: false },
}, { tableName: 'jurnal_detail', timestamps: false });

// ─── SIMPANAN JENIS ─────────────────────────────────────────
const SimpananJenis = sequelize.define('SimpananJenis', {
  id:            { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenant_id:     { type: DataTypes.UUID, allowNull: false },
  nama:          { type: DataTypes.STRING(100), allowNull: false },
  kode:          { type: DataTypes.STRING(20), allowNull: false },
  wajib:         { type: DataTypes.BOOLEAN, defaultValue: false },
  nominal_tetap: { type: DataTypes.DECIMAL(18,2) },
  rekening_id:   { type: DataTypes.UUID },
}, { tableName: 'simpanan_jenis' });

// ─── SIMPANAN ───────────────────────────────────────────────
const Simpanan = sequelize.define('Simpanan', {
  id:                { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenant_id:         { type: DataTypes.UUID, allowNull: false },
  anggota_id:        { type: DataTypes.UUID, allowNull: false },
  simpanan_jenis_id: { type: DataTypes.UUID, allowNull: false },
  saldo:             { type: DataTypes.DECIMAL(18,2), defaultValue: 0 },
}, { tableName: 'simpanan' });

// ─── SIMPANAN TRANSAKSI ─────────────────────────────────────
const SimpananTransaksi = sequelize.define('SimpananTransaksi', {
  id:               { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenant_id:        { type: DataTypes.UUID, allowNull: false },
  simpanan_id:      { type: DataTypes.UUID, allowNull: false },
  tipe:             { type: DataTypes.ENUM('setoran','penarikan'), allowNull: false },
  nominal:          { type: DataTypes.DECIMAL(18,2), allowNull: false },
  saldo_sebelum:    { type: DataTypes.DECIMAL(18,2), allowNull: false },
  saldo_sesudah:    { type: DataTypes.DECIMAL(18,2), allowNull: false },
  jurnal_header_id: { type: DataTypes.UUID },
  keterangan:       { type: DataTypes.TEXT },
  tanggal:          { type: DataTypes.DATEONLY, allowNull: false },
  user_id:          { type: DataTypes.UUID, allowNull: false },
}, { tableName: 'simpanan_transaksi' });

// ─── PINJAMAN ───────────────────────────────────────────────
const Pinjaman = sequelize.define('Pinjaman', {
  id:                { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenant_id:         { type: DataTypes.UUID, allowNull: false },
  anggota_id:        { type: DataTypes.UUID, allowNull: false },
  no_pinjaman:       { type: DataTypes.STRING(30), allowNull: false },
  pokok:             { type: DataTypes.DECIMAL(18,2), allowNull: false },
  suku_bunga:        { type: DataTypes.DECIMAL(5,2), allowNull: false },
  jangka_waktu:      { type: DataTypes.INTEGER, allowNull: false },
  tanggal_cair:      { type: DataTypes.DATEONLY },
  tanggal_jatuh_tempo: { type: DataTypes.DATEONLY },
  metode_angsuran:   { type: DataTypes.ENUM('flat','efektif','anuitas'), defaultValue: 'flat' },
  tujuan:            { type: DataTypes.TEXT },
  status:            { type: DataTypes.ENUM('diajukan','disetujui','cair','lunas','macet'), defaultValue: 'diajukan' },
  jurnal_cair_id:    { type: DataTypes.UUID },
  sisa_pokok:        { type: DataTypes.DECIMAL(18,2), defaultValue: 0 },
}, { tableName: 'pinjaman' });

// ─── PINJAMAN ANGSURAN ──────────────────────────────────────
const PinjamanAngsuran = sequelize.define('PinjamanAngsuran', {
  id:               { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  pinjaman_id:      { type: DataTypes.UUID, allowNull: false },
  ke:               { type: DataTypes.INTEGER, allowNull: false },
  jatuh_tempo:      { type: DataTypes.DATEONLY, allowNull: false },
  pokok:            { type: DataTypes.DECIMAL(18,2), allowNull: false },
  bunga:            { type: DataTypes.DECIMAL(18,2), allowNull: false },
  total:            { type: DataTypes.DECIMAL(18,2), allowNull: false },
  tgl_bayar:        { type: DataTypes.DATEONLY },
  bayar_pokok:      { type: DataTypes.DECIMAL(18,2), defaultValue: 0 },
  bayar_bunga:      { type: DataTypes.DECIMAL(18,2), defaultValue: 0 },
  bayar_denda:      { type: DataTypes.DECIMAL(18,2), defaultValue: 0 },
  status:           { type: DataTypes.ENUM('belum','lunas','telat'), defaultValue: 'belum' },
  jurnal_header_id: { type: DataTypes.UUID },
}, { tableName: 'pinjaman_angsuran' });

// ─── PINJAMAN AGUNAN (COLLATERAL) ───────────────────────────
const PinjamanAgunan = sequelize.define('PinjamanAgunan', {
  id:             { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  pinjaman_id:    { type: DataTypes.UUID, allowNull: false },
  jenis:          { type: DataTypes.ENUM('bpkb','sertifikat_tanah','emas','lainnya'), allowNull: false },
  nilai_taksiran: { type: DataTypes.DECIMAL(18,2), allowNull: false },
  deskripsi:      { type: DataTypes.TEXT },
  foto_url:       { type: DataTypes.STRING(500) },
  status_kembali: { type: DataTypes.BOOLEAN, defaultValue: false },
}, { tableName: 'pinjaman_agunan', timestamps: true });

// ─── ASET TETAP ──────────────────────────────────────────────
const AsetTetap = sequelize.define('AsetTetap', {
  id:                  { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenant_id:           { type: DataTypes.UUID, allowNull: false },
  kode:                { type: DataTypes.STRING(30), allowNull: false },
  nama:                { type: DataTypes.STRING(200), allowNull: false },
  kategori:            { type: DataTypes.STRING(100), allowNull: false },
  tanggal_perolehan:   { type: DataTypes.DATEONLY, allowNull: false },
  harga_perolehan:     { type: DataTypes.DECIMAL(18,2), allowNull: false },
  umur_ekonomis:       { type: DataTypes.INTEGER, allowNull: false }, // dalam bulan
  nilai_sisa:          { type: DataTypes.DECIMAL(18,2), defaultValue: 0 },
  akumulasi_penyusutan:{ type: DataTypes.DECIMAL(18,2), defaultValue: 0 },
  nilai_buku:          { type: DataTypes.DECIMAL(18,2), allowNull: false },
  metode_penyusutan:   { type: DataTypes.ENUM('garis_lurus'), defaultValue: 'garis_lurus' },
  status:              { type: DataTypes.ENUM('aktif','dijual','dihapus'), defaultValue: 'aktif' },
  beban_rekening_id:   { type: DataTypes.UUID, allowNull: false },
  akumulasi_rekening_id:{ type: DataTypes.UUID, allowNull: false },
}, { tableName: 'aset_tetap' });

// ─── KATEGORI PRODUK ────────────────────────────────────────
const Kategori = sequelize.define('Kategori', {
  id:        { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenant_id: { type: DataTypes.UUID, allowNull: false },
  nama:      { type: DataTypes.STRING(100), allowNull: false },
  deskripsi: { type: DataTypes.TEXT },
}, { tableName: 'kategori' });

// ─── PRODUK (Barang / Jasa) ──────────────────────────────────
const Produk = sequelize.define('Produk', {
  id:                { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenant_id:         { type: DataTypes.UUID, allowNull: false },
  kategori_id:       { type: DataTypes.UUID },
  kode:              { type: DataTypes.STRING(50), allowNull: false },
  barcode:           { type: DataTypes.STRING(100) },
  nama:              { type: DataTypes.STRING(200), allowNull: false },
  deskripsi:         { type: DataTypes.TEXT },
  satuan:            { type: DataTypes.STRING(20), defaultValue: 'Pcs' }, // UOM Utama
  harga_beli:        { type: DataTypes.DECIMAL(18,2), defaultValue: 0 },
  harga_jual:        { type: DataTypes.DECIMAL(18,2), defaultValue: 0 },
  stok_minimal:      { type: DataTypes.DECIMAL(18,2), defaultValue: 0 },
  stok_saat_ini:     { type: DataTypes.DECIMAL(18,2), defaultValue: 0 },
  aktif:             { type: DataTypes.BOOLEAN, defaultValue: true },
  tipe:              { type: DataTypes.ENUM('barang', 'jasa'), defaultValue: 'barang' },
  metode_stok:       { type: DataTypes.ENUM('fifo', 'average', 'none'), defaultValue: 'fifo' },
}, { tableName: 'produk' });

// ─── SHU PERIODE ────────────────────────────────────────────
const ShuPeriode = sequelize.define('ShuPeriode', {
  id:                       { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenant_id:                { type: DataTypes.UUID, allowNull: false },
  tahun:                    { type: DataTypes.INTEGER, allowNull: false },
  total_shu:                { type: DataTypes.DECIMAL(18,2), defaultValue: 0 },
  persentase_jasa_modal:    { type: DataTypes.DECIMAL(5,2), defaultValue: 30 },
  persentase_jasa_usaha:    { type: DataTypes.DECIMAL(5,2), defaultValue: 40 },
  persentase_dana_cadangan: { type: DataTypes.DECIMAL(5,2), defaultValue: 20 },
  persentase_dana_sosial:   { type: DataTypes.DECIMAL(5,2), defaultValue: 10 },
  status:                   { type: DataTypes.ENUM('draft','final'), defaultValue: 'draft' },
  closing_entry_id:         { type: DataTypes.UUID },
}, { tableName: 'shu_periode' });

// ─── SHU DISTRIBUSI ─────────────────────────────────────────
const ShuDistribusi = sequelize.define('ShuDistribusi', {
  id:                  { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  shu_periode_id:      { type: DataTypes.UUID, allowNull: false },
  anggota_id:          { type: DataTypes.UUID, allowNull: false },
  total_simpanan:      { type: DataTypes.DECIMAL(18,2), defaultValue: 0 },
  total_transaksi:     { type: DataTypes.DECIMAL(18,2), defaultValue: 0 },
  jasa_modal:          { type: DataTypes.DECIMAL(18,2), defaultValue: 0 },
  jasa_usaha:          { type: DataTypes.DECIMAL(18,2), defaultValue: 0 },
  total_shu_diterima:  { type: DataTypes.DECIMAL(18,2), defaultValue: 0 },
}, { tableName: 'shu_distribusi' });

// ─── AUDIT LOG ──────────────────────────────────────────────
const AuditLog = sequelize.define('AuditLog', {
  id:         { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenant_id:  { type: DataTypes.UUID },
  user_id:    { type: DataTypes.UUID },
  aksi:       { type: DataTypes.STRING(100), allowNull: false },
  tabel:      { type: DataTypes.STRING(100) },
  record_id:  { type: DataTypes.UUID },
  data_lama:  { type: DataTypes.JSON },
  data_baru:  { type: DataTypes.JSON },
  ip_address: { type: DataTypes.STRING(50) },
  user_agent: { type: DataTypes.STRING(500) },
}, { tableName: 'audit_log', updatedAt: false });

// ─── NOTIFIKASI ─────────────────────────────────────────────
const Notifikasi = sequelize.define('Notifikasi', {
  id:        { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenant_id: { type: DataTypes.UUID, allowNull: false },
  user_id:   { type: DataTypes.UUID, allowNull: false },
  judul:     { type: DataTypes.STRING(200), allowNull: false },
  pesan:     { type: DataTypes.TEXT },
  tipe:      { type: DataTypes.STRING(50) },
  dibaca:    { type: DataTypes.BOOLEAN, defaultValue: false },
}, { tableName: 'notifikasi', updatedAt: false });

// ─── SETTING (Global System Parameters) ─────────────────────
const Setting = sequelize.define('Setting', {
  id:          { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenant_id:   { type: DataTypes.UUID, allowNull: false },
  key:         { type: DataTypes.STRING(100), allowNull: false },
  value:       { type: DataTypes.TEXT, allowNull: false },
  group:       { type: DataTypes.STRING(50), defaultValue: 'umum' },
  type:        { type: DataTypes.ENUM('string', 'number', 'boolean', 'json'), defaultValue: 'string' },
  description: { type: DataTypes.TEXT },
}, { tableName: 'settings' });

// ─── TRANSAKSI OPERASIONAL (Beban/Pendapatan Lain) ─────────
const TransaksiOperasional = sequelize.define('TransaksiOperasional', {
  id:               { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenant_id:        { type: DataTypes.UUID, allowNull: false },
  rekening_id:      { type: DataTypes.UUID, allowNull: false },
  jenis:            { type: DataTypes.ENUM('pemasukan','pengeluaran'), allowNull: false },
  nominal:          { type: DataTypes.DECIMAL(18,2), allowNull: false },
  tanggal:          { type: DataTypes.DATEONLY, allowNull: false },
  keterangan:       { type: DataTypes.TEXT },
  jurnal_header_id: { type: DataTypes.UUID },
  user_id:          { type: DataTypes.UUID, allowNull: false },
}, { tableName: 'transaksi_operasional' });

// ─── KASIR SESI (Shift Kasir) ──────────────────────────────
const KasirSesi = sequelize.define('KasirSesi', {
  id:                 { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenant_id:          { type: DataTypes.UUID, allowNull: false },
  user_id:            { type: DataTypes.UUID, allowNull: false },
  waktu_buka:         { type: DataTypes.DATE, allowNull: false },
  waktu_tutup:        { type: DataTypes.DATE },
  saldo_awal_fisik:   { type: DataTypes.DECIMAL(18,2), allowNull: false },
  saldo_akhir_fisik:  { type: DataTypes.DECIMAL(18,2) },
  saldo_akhir_sistem: { type: DataTypes.DECIMAL(18,2) },
  status:             { type: DataTypes.ENUM('buka','tutup'), defaultValue: 'buka' },
}, { tableName: 'kasir_sesi' });

// ─── PENJUALAN (SALES/BELANJA) ─────────────────────────────
const Penjualan = sequelize.define('Penjualan', {
  id:               { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenant_id:        { type: DataTypes.UUID, allowNull: false },
  anggota_id:       { type: DataTypes.UUID }, // Null if non-member
  no_faktur:        { type: DataTypes.STRING(30), allowNull: false },
  tanggal:          { type: DataTypes.DATEONLY, allowNull: false },
  total:            { type: DataTypes.DECIMAL(18,2), defaultValue: 0 },
  bayar:            { type: DataTypes.DECIMAL(18,2), defaultValue: 0 },
  kembali:          { type: DataTypes.DECIMAL(18,2), defaultValue: 0 },
  metode_bayar:     { type: DataTypes.ENUM('tunai','tabungan','piutang'), defaultValue: 'tunai' },
  keterangan:       { type: DataTypes.TEXT },
  user_id:          { type: DataTypes.UUID, allowNull: false },
  kasir_sesi_id:    { type: DataTypes.UUID },
}, { tableName: 'penjualan' });

const PenjualanDetail = sequelize.define('PenjualanDetail', {
  id:               { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  penjualan_id:     { type: DataTypes.UUID, allowNull: false },
  produk_id:        { type: DataTypes.UUID, allowNull: false },
  qty:              { type: DataTypes.DECIMAL(18,2), allowNull: false },
  harga_satuan:     { type: DataTypes.DECIMAL(18,2), allowNull: false },
  subtotal:         { type: DataTypes.DECIMAL(18,2), allowNull: false },
}, { tableName: 'penjualan_detail', timestamps: false });

// ─── ASSOCIATIONS ───────────────────────────────────────────
Tenant.hasMany(User,               { foreignKey: 'tenant_id' });
Tenant.hasMany(Anggota,            { foreignKey: 'tenant_id' });
Tenant.hasMany(Rekening,           { foreignKey: 'tenant_id' });
Tenant.hasMany(JurnalHeader,       { foreignKey: 'tenant_id' });
Tenant.hasMany(SimpananJenis,      { foreignKey: 'tenant_id' });
Tenant.hasMany(Pinjaman,           { foreignKey: 'tenant_id' });
Tenant.hasMany(ShuPeriode,         { foreignKey: 'tenant_id' });
Tenant.hasMany(AsetTetap,          { foreignKey: 'tenant_id' });
Tenant.hasMany(TransaksiOperasional, { foreignKey: 'tenant_id' });
Tenant.hasMany(KasirSesi,          { foreignKey: 'tenant_id' });
Tenant.hasMany(Setting,            { foreignKey: 'tenant_id' });
Tenant.hasMany(Kategori,           { foreignKey: 'tenant_id' });
Tenant.hasMany(Produk,             { foreignKey: 'tenant_id' });

User.belongsTo(Tenant,             { foreignKey: 'tenant_id' });
Anggota.belongsTo(Tenant,          { foreignKey: 'tenant_id' });
Anggota.hasMany(Simpanan,          { foreignKey: 'anggota_id' });
Anggota.hasMany(Pinjaman,          { foreignKey: 'anggota_id' });
Anggota.hasMany(ShuDistribusi,     { foreignKey: 'anggota_id' });

Rekening.hasMany(JurnalDetail,     { foreignKey: 'rekening_id' });
JurnalHeader.hasMany(JurnalDetail, { foreignKey: 'jurnal_header_id', as: 'details' });
JurnalDetail.belongsTo(JurnalHeader, { foreignKey: 'jurnal_header_id' });
JurnalDetail.belongsTo(Rekening,   { foreignKey: 'rekening_id' });

SimpananJenis.hasMany(Simpanan,    { foreignKey: 'simpanan_jenis_id' });
Simpanan.belongsTo(Anggota,        { foreignKey: 'anggota_id' });
Simpanan.belongsTo(SimpananJenis,  { foreignKey: 'simpanan_jenis_id' });
Simpanan.hasMany(SimpananTransaksi,{ foreignKey: 'simpanan_id' });
SimpananTransaksi.belongsTo(Simpanan, { foreignKey: 'simpanan_id' });

Pinjaman.belongsTo(Anggota,        { foreignKey: 'anggota_id' });
Pinjaman.hasMany(PinjamanAngsuran, { foreignKey: 'pinjaman_id', as: 'angsuran' });
Pinjaman.hasMany(PinjamanAgunan,   { foreignKey: 'pinjaman_id', as: 'agunan' });
PinjamanAngsuran.belongsTo(Pinjaman, { foreignKey: 'pinjaman_id' });
PinjamanAgunan.belongsTo(Pinjaman, { foreignKey: 'pinjaman_id' });

ShuPeriode.hasMany(ShuDistribusi,  { foreignKey: 'shu_periode_id', as: 'distribusi' });
ShuDistribusi.belongsTo(Anggota,   { foreignKey: 'anggota_id' });

TransaksiOperasional.belongsTo(Tenant,   { foreignKey: 'tenant_id' });
TransaksiOperasional.belongsTo(Rekening, { foreignKey: 'rekening_id', as: 'rekeningLawan' });
TransaksiOperasional.belongsTo(User,     { foreignKey: 'user_id' });
KasirSesi.belongsTo(Tenant, { foreignKey: 'tenant_id' });
KasirSesi.belongsTo(User,   { foreignKey: 'user_id' });
Setting.belongsTo(Tenant,   { foreignKey: 'tenant_id' });
Kategori.belongsTo(Tenant,  { foreignKey: 'tenant_id' });
Produk.belongsTo(Tenant,    { foreignKey: 'tenant_id' });
Produk.belongsTo(Kategori,  { foreignKey: 'kategori_id', as: 'kategori' });
Kategori.hasMany(Produk,    { foreignKey: 'kategori_id' });

Penjualan.belongsTo(Tenant,  { foreignKey: 'tenant_id' });
Penjualan.belongsTo(Anggota, { foreignKey: 'anggota_id', as: 'pembeli' });
Penjualan.hasMany(PenjualanDetail, { foreignKey: 'penjualan_id', as: 'items' });
PenjualanDetail.belongsTo(Penjualan, { foreignKey: 'penjualan_id' });
PenjualanDetail.belongsTo(Produk,    { foreignKey: 'produk_id', as: 'produk' });
Anggota.hasMany(Penjualan,           { foreignKey: 'anggota_id' });

module.exports = {
  sequelize,
  Tenant, User, Anggota,
  Rekening, JurnalHeader, JurnalDetail,
  SimpananJenis, Simpanan, SimpananTransaksi,
  Pinjaman, PinjamanAngsuran, PinjamanAgunan,
  AsetTetap, TransaksiOperasional, KasirSesi,
  ShuPeriode, ShuDistribusi,
  AuditLog, Notifikasi, Setting,
  Kategori, Produk, Penjualan, PenjualanDetail
};
