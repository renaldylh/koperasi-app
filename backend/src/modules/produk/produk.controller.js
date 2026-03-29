const { Produk, Kategori, Rekening } = require('../../models');
const { logAudit } = require('../../middleware/auditLog');
const { asyncHandler } = require('../../middleware/errorHandler');
const { Op } = require('sequelize');

exports.listProduk = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, search = '', kategori_id } = req.query;
  const offset = (page - 1) * limit;

  const where = { tenant_id: req.user.tenantId };
  if (search) {
    where[Op.or] = [
      { nama: { [Op.iLike]: `%${search}%` } },
      { kode: { [Op.iLike]: `%${search}%` } },
      { barcode: { [Op.iLike]: `%${search}%` } }
    ];
  }
  if (kategori_id) where.kategori_id = kategori_id;

  const { count, rows } = await Produk.findAndCountAll({
    where,
    include: [{ model: Kategori, as: 'kategori', attributes: ['nama'] }],
    limit: parseInt(limit),
    offset: parseInt(offset),
    order: [['nama', 'ASC']]
  });

  res.json({
    data: rows,
    meta: {
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / limit)
    }
  });
});

exports.createProduk = asyncHandler(async (req, res) => {
  const data = { ...req.body, tenant_id: req.user.tenantId };
  
  // Auto-generate kode if empty
  if (!data.kode) {
    const count = await Produk.count({ where: { tenant_id: req.user.tenantId } });
    data.kode = `PRD-${(count + 1).toString().padStart(5, '0')}`;
  }

  const produk = await Produk.create(data);
  await logAudit({ userId: req.user.id, tenantId: req.user.tenantId, aksi: 'CREATE', tabel: 'produk', recordId: produk.id, dataBaru: produk, req });
  res.status(201).json({ message: 'Produk berhasil ditambahkan', data: produk });
});

exports.updateProduk = asyncHandler(async (req, res) => {
  const produk = await Produk.findOne({ where: { id: req.params.id, tenant_id: req.user.tenantId } });
  if (!produk) return res.status(404).json({ message: 'Produk tidak ditemukan' });

  await produk.update(req.body);
  await logAudit({ userId: req.user.id, tenantId: req.user.tenantId, aksi: 'UPDATE', tabel: 'produk', recordId: produk.id, dataBaru: produk, req });
  res.json({ message: 'Data produk berhasil diperbarui', data: produk });
});

exports.deleteProduk = asyncHandler(async (req, res) => {
  const produk = await Produk.findOne({ where: { id: req.params.id, tenant_id: req.user.tenantId } });
  if (!produk) return res.status(404).json({ message: 'Produk tidak ditemukan' });

  await produk.destroy();
  await logAudit({ userId: req.user.id, tenantId: req.user.tenantId, aksi: 'DELETE', tabel: 'produk', recordId: produk.id, req });
  res.json({ message: 'Produk berhasil dihapus' });
});

// ─── KATEGORI ───────────────────────────────────────────────
exports.listKategori = asyncHandler(async (req, res) => {
  const kategori = await Kategori.findAll({ where: { tenant_id: req.user.tenantId }, order: [['nama', 'ASC']] });
  res.json({ data: kategori });
});

exports.createKategori = asyncHandler(async (req, res) => {
  const kategori = await Kategori.create({ ...req.body, tenant_id: req.user.tenantId });
  res.status(201).json({ data: kategori });
});
exports.bulkUpdateProduk = asyncHandler(async (req, res) => {
  const { rows } = req.body;
  const { tenantId: tenant_id } = req.user;

  const result = await sequelize.transaction(async (t) => {
    let created = 0;
    let updated = 0;

    for (const r of rows) {
      if (!r.nama) continue;

      let p = null;
      if (r.kode) {
        p = await Produk.findOne({ where: { kode: r.kode, tenant_id }, transaction: t });
      }

      if (p) {
        await p.update({
          barcode: r.barcode || p.barcode,
          nama: r.nama || p.nama,
          harga_jual: r.harga_jual || p.harga_jual,
          stok_saat_ini: r.stok_saat_ini !== undefined ? r.stok_saat_ini : p.stok_saat_ini,
          kategori_id: r.kategori_id || p.kategori_id
        }, { transaction: t });
        updated++;
      } else {
        await Produk.create({
          tenant_id,
          kode: r.kode || `PRD-AUTO-${Date.now()}-${Math.floor(Math.random()*1000)}`,
          barcode: r.barcode,
          nama: r.nama,
          harga_jual: r.harga_jual || 0,
          stok_saat_ini: r.stok_saat_ini || 0,
          kategori_id: r.kategori_id,
          satuan: r.satuan || 'Pcs'
        }, { transaction: t });
        created++;
      }
    }
    return { created, updated };
  });

  res.json({ success: true, message: `Bulk update selesai: ${result.created} dibuat, ${result.updated} diperbarui.`, data: result });
});
