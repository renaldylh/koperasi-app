const { Penjualan, PenjualanDetail, Produk, Anggota, JurnalHeader, JurnalDetail, sequelize } = require('../../models');
const { asyncHandler } = require('../../middleware/errorHandler');
const { logAudit } = require('../../middleware/auditLog');
const { randomUUID } = require('crypto');
const uuidv4 = randomUUID;

/** GET /api/produk/penjualan */
exports.list = asyncHandler(async (req, res) => {
  const { tenantId: tenant_id } = req.user;
  const { page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  const { count, rows } = await Penjualan.findAndCountAll({
    where: { tenant_id },
    include: [
      { model: Anggota, as: 'pembeli', attributes: ['nama', 'no_anggota'] },
      { model: PenjualanDetail, as: 'items', include: [{ model: Produk, as: 'produk', attributes: ['nama'] }] }
    ],
    order: [['tanggal', 'DESC'], ['createdAt', 'DESC']],
    limit: parseInt(limit),
    offset: parseInt(offset)
  });

  res.json({ success: true, data: rows, meta: { total: count, page, limit } });
});

/** POST /api/produk/penjualan (Checkout POS) */
exports.checkout = asyncHandler(async (req, res) => {
  const { tenantId: tenant_id, id: user_id } = req.user;
  const { anggota_id, items, metode_bayar, keterangan, bayar } = req.body;

  if (!items || items.length === 0) return res.status(400).json({ message: 'Keranjang belanja kosong.' });

  const result = await sequelize.transaction(async (t) => {
    let total = 0;
    // 1. Hitung Total & Validasi Stok
    for (const item of items) {
      const p = await Produk.findOne({ where: { id: item.produk_id, tenant_id }, transaction: t });
      if (!p) throw new Error(`Produk ${item.produk_id} tidak ditemukan.`);
      if (p.stok_saat_ini < item.qty) throw new Error(`Stok ${p.nama} tidak mencukupi (Sisa: ${p.stok_saat_ini}).`);
      
      item.harga_satuan = p.harga_jual;
      item.subtotal = item.qty * item.harga_satuan;
      total += item.subtotal;

      // Update Stok
      await p.update({ stok_saat_ini: p.stok_saat_ini - item.qty }, { transaction: t });
    }

    const kembali = bayar ? (bayar - total) : 0;

    // 2. Buat Header Penjualan
    const sale = await Penjualan.create({
      tenant_id,
      anggota_id: anggota_id || null,
      no_faktur: `INV-${Date.now()}`,
      tanggal: new Date(),
      total,
      bayar: bayar || total,
      kembali: kembali > 0 ? kembali : 0,
      metode_bayar: metode_bayar || 'tunai',
      keterangan,
      user_id
    }, { transaction: t });

    const { Rekening } = require('../../models');
    
    // ─── OTOMASI JURNAL AKUNTANSI ──────────────────────────────
    // 1. Kas -> Pendapatan Penjualan
    const header = await JurnalHeader.create({
        tenant_id, user_id,
        tanggal: new Date(),
        no_jurnal: `JR-SALES-${sale.id.substring(0,8)}`,
        keterangan: `Penjualan Toko #${sale.no_faktur}`,
        sumber: 'penjualan',
        sumber_id: sale.id
    }, { transaction: t });

    // Lookup Akun (1101: Kas, 4101: Pendapatan)
    const accKas = await Rekening.findOne({ where: { kode: '1101', tenant_id }, transaction: t });
    const accPen = await Rekening.findOne({ where: { kode: '4101', tenant_id }, transaction: t });

    if (accKas && accPen) {
        await JurnalDetail.bulkCreate([
            { jurnal_header_id: header.id, rekening_id: accKas.id, posisi: 'D', nominal: total },
            { jurnal_header_id: header.id, rekening_id: accPen.id, posisi: 'K', nominal: total }
        ], { transaction: t });
    }
    
    // 2. HPP (5101) -> Persediaan (1105)
    let totalHpp = 0;
    for (const item of items) {
        const p = await Produk.findByPk(item.produk_id, { transaction: t });
        totalHpp += (p.harga_beli || (p.harga_jual * 0.8)) * item.qty;
    }

    const accHPP = await Rekening.findOne({ where: { kode: '5101', tenant_id }, transaction: t });
    const accStk = await Rekening.findOne({ where: { kode: '1105', tenant_id }, transaction: t });

    if (accHPP && accStk) {
        const hppHeader = await JurnalHeader.create({
            tenant_id, user_id,
            tanggal: new Date(),
            no_jurnal: `JR-HPP-${sale.id.substring(0,8)}`,
            keterangan: `HPP Penjualan #${sale.no_faktur}`,
            sumber: 'penjualan',
            sumber_id: sale.id
        }, { transaction: t });

        await JurnalDetail.bulkCreate([
            { jurnal_header_id: hppHeader.id, rekening_id: accHPP.id, posisi: 'D', nominal: totalHpp },
            { jurnal_header_id: hppHeader.id, rekening_id: accStk.id, posisi: 'K', nominal: totalHpp }
        ], { transaction: t });
    }

    // 3. Buat Detail Penjualan
    for (const item of items) {
      await PenjualanDetail.create({
        penjualan_id: sale.id,
        produk_id: item.produk_id,
        qty: item.qty,
        harga_satuan: item.harga_satuan,
        subtotal: item.subtotal
      }, { transaction: t });
    }

    return sale;
  });

  await logAudit({ userId: req.user.id, tenantId: req.user.tenantId, aksi: 'CREATE', tabel: 'penjualan', recordId: result.id, dataBaru: result, req });
  res.status(201).json({ success: true, message: 'Transaksi berhasil disimpan.', data: result });
});

/** POST /api/produk/penjualan/bulk (Excel Import) */
exports.bulkInsert = asyncHandler(async (req, res) => {
  const { rows } = req.body;
  const { tenantId: tenant_id, id: user_id } = req.user;

  const t = await sequelize.transaction();
  try {
    for (const r of rows) {
      // Logic mapping sederhana (Asumsi 1 baris excel = 1 item penjualan)
      // Mencari produk by kode
      const p = await Produk.findOne({ where: { kode: r.kode_produk, tenant_id }, transaction: t });
      if (!p) continue;

      const sale = await Penjualan.create({
        tenant_id,
        anggota_id: r.anggota_id || null, // null if guest
        no_faktur: `INV-Bulk-${Date.now()}-${Math.random()}`,
        tanggal: r.tanggal || new Date(),
        total: r.qty * p.harga_jual,
        bayar: r.qty * p.harga_jual,
        metode_bayar: 'tunai',
        user_id
      }, { transaction: t });

      await PenjualanDetail.create({
        penjualan_id: sale.id,
        produk_id: p.id,
        qty: r.qty,
        harga_satuan: p.harga_jual,
        subtotal: r.qty * p.harga_jual
      }, { transaction: t });

      await p.update({ stok_saat_ini: p.stok_saat_ini - r.qty }, { transaction: t });
    }
    await t.commit();
    res.json({ success: true, message: 'Import bulk penjualan selesai.' });
  } catch (err) {
    await t.rollback();
    res.status(500).json({ message: err.message });
  }
});
