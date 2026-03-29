const { sequelize, TransaksiOperasional, Rekening, KasirSesi } = require('../../models');
const { logAudit } = require('../../middleware/auditLog');
const { jurnalPemasukanOperasional, jurnalPengeluaranOperasional } = require('../../utils/jurnalEngine');
const { asyncHandler } = require('../../middleware/errorHandler');

exports.list = asyncHandler(async (req, res) => {
  const { tenantId: tenant_id } = req.user;
  const { page = 1, limit = 20, search = '' } = req.query;
  const offset = (page - 1) * limit;

  const whereClause = { tenant_id };
  if (search) {
    whereClause.keterangan = { [sequelize.Sequelize.Op.like]: `%${search}%` };
  }

  const { count, rows } = await TransaksiOperasional.findAndCountAll({
    where: whereClause,
    include: [{ model: Rekening, as: 'rekeningLawan', attributes: ['kode', 'nama', 'tipe'] }],
    order: [['tanggal', 'DESC'], ['createdAt', 'DESC']],
    limit: parseInt(limit),
    offset: parseInt(offset)
  });

  res.json({
    data: rows,
    meta: { total: count, page: parseInt(page), limit: parseInt(limit) }
  });
});

exports.catatPemasukan = asyncHandler(async (req, res) => {
  const { tenantId: tenant_id, id: user_id } = req.user;
  const { rekening_id, nominal, tanggal, keterangan } = req.body;

  if (!rekening_id || !nominal || nominal <= 0) {
    return res.status(400).json({ message: 'Rekening dan nominal harus valid (>0)' });
  }

  // Verifikasi rekening adalah tipe pendapatan
  const rek = await Rekening.findOne({ where: { id: rekening_id, tenant_id, tipe: 'pendapatan' } });
  if (!rek) return res.status(404).json({ message: 'Rekening pendapatan tidak ditemukan/tidak valid' });

  const result = await sequelize.transaction(async (t) => {
    // Buat data transaksi
    const trx = await TransaksiOperasional.create({
      tenant_id,
      rekening_id,
      jenis: 'pemasukan',
      nominal,
      tanggal: tanggal || new Date(),
      keterangan,
      user_id
    }, { transaction: t });

    // Panggil Engine Jurnal (Debit Kas, Kredit Pendapatan)
    const jurnal = await jurnalPemasukanOperasional({
      tenantId: tenant_id,
      transaksiId: trx.id,
      rekeningPendapatanId: rek.id,
      nominal,
      tanggal: trx.tanggal,
      keterangan
    }, t);

    return trx;
  });

  await logAudit({ userId: req.user.id, tenantId: req.user.tenantId, aksi: 'CREATE', tabel: 'transaksi_operasional', recordId: result.id, dataBaru: result, req });
  res.status(201).json({ message: 'Pemasukan berhasil dicatat beserta jurnal otomatis', data: result });
});

exports.catatPengeluaran = asyncHandler(async (req, res) => {
  const { tenantId: tenant_id, id: user_id } = req.user;
  const { rekening_id, nominal, tanggal, keterangan } = req.body;

  if (!rekening_id || !nominal || nominal <= 0) {
    return res.status(400).json({ message: 'Rekening dan nominal harus valid (>0)' });
  }

  // Verifikasi rekening adalah tipe beban
  const rek = await Rekening.findOne({ where: { id: rekening_id, tenant_id, tipe: 'beban' } });
  if (!rek) return res.status(404).json({ message: 'Rekening beban biaya tidak ditemukan/tidak valid' });

  const result = await sequelize.transaction(async (t) => {
    // Buat data transaksi
    const trx = await TransaksiOperasional.create({
      tenant_id,
      rekening_id,
      jenis: 'pengeluaran',
      nominal,
      tanggal: tanggal || new Date(),
      keterangan,
      user_id
    }, { transaction: t });

    // Panggil Engine Jurnal (Debit Beban, Kredit Kas)
    const jurnal = await jurnalPengeluaranOperasional({
      tenantId: tenant_id,
      transaksiId: trx.id,
      rekeningBebanId: rek.id,
      nominal,
      tanggal: trx.tanggal,
      keterangan
    }, t);

    return trx;
  });

  await logAudit({ userId: req.user.id, tenantId: req.user.tenantId, aksi: 'CREATE', tabel: 'transaksi_operasional', recordId: result.id, dataBaru: result, req });
  res.status(201).json({ message: 'Pengeluaran/Beban berhasil dicatat beserta jurnal otomatis', data: result });
});


// ==========================================
// EOD KASIR (SHIFT MANAGEMENT)
// ==========================================

exports.checkSesiKasir = asyncHandler(async (req, res) => {
  const sesi = await KasirSesi.findOne({
     where: { tenant_id: req.user.tenantId, user_id: req.user.id, status: 'buka' }
  });
  res.json({ data: sesi });
});

exports.bukaKasir = asyncHandler(async (req, res) => {
  const { saldo_awal_fisik } = req.body;
  if(saldo_awal_fisik === undefined || saldo_awal_fisik < 0) return res.status(400).json({ message: 'Saldo awal fisik tidak valid' });

  const existing = await KasirSesi.findOne({
    where: { tenant_id: req.user.tenantId, user_id: req.user.id, status: 'buka' }
  });
  if(existing) return res.status(400).json({ message: 'Anda masih memiliki sesi kasir yang belum ditutup.' });

  const sesi = await KasirSesi.create({
    tenant_id: req.user.tenantId,
    user_id: req.user.id,
    waktu_buka: new Date(),
    saldo_awal_fisik
  });
  
  await logAudit({ userId: req.user.id, tenantId: req.user.tenantId, aksi: 'CREATE', tabel: 'kasir_sesi', recordId: sesi.id, dataBaru: sesi, req });
  res.status(201).json({ message: 'Sesi Kasir Berhasil Dibuka', data: sesi });
});

exports.tutupKasir = asyncHandler(async (req, res) => {
  const { saldo_akhir_fisik } = req.body;
  if(saldo_akhir_fisik === undefined || saldo_akhir_fisik < 0) return res.status(400).json({ message: 'Saldo akhir fisik tidak valid' });

  const sesi = await KasirSesi.findOne({
    where: { tenant_id: req.user.tenantId, user_id: req.user.id, status: 'buka' }
  });
  if(!sesi) return res.status(404).json({ message: 'Tidak ada sesi kasir yang aktif/terbuka.' });

  // Idealnya: hitung mutasi kas berdasarkan jurnal_detail akun KAS yang terjadi antara waktu_buka s/d sekarang oleh user_id ini.
  // Untuk fase ini, kita akan simpan saldo akhirnya saja sebagai audit report
  const saldoSistem = -1; // -1 indicates we defer the deep ledger calculation to the report query later for performance

  sesi.waktu_tutup = new Date();
  sesi.saldo_akhir_fisik = saldo_akhir_fisik;
  sesi.saldo_akhir_sistem = saldoSistem;
  sesi.status = 'tutup';
  
  await sesi.save();
  
  await logAudit({ userId: req.user.id, tenantId: req.user.tenantId, aksi: 'UPDATE', tabel: 'kasir_sesi', recordId: sesi.id, dataBaru: sesi, req });
  res.json({ message: 'Kasir Berhasil Ditutup', data: sesi });
});

