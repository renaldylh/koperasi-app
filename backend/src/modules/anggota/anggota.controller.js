const { Anggota, Simpanan, SimpananJenis } = require('../../models');
const { logAudit } = require('../../middleware/auditLog');
const { sendWAMessage, parseTemplate } = require('../../utils/wa');
const { Op } = require('sequelize');

/** GET /api/anggota */
async function list(req, res) {
  const { page = 1, limit = 20, search = '', status } = req.query;
  const where = { tenant_id: req.user.tenantId };
  if (search) where.nama = { [Op.like]: `%${search}%` };
  if (status) where.status = status;

  const { count, rows } = await Anggota.findAndCountAll({
    where, limit: parseInt(limit), offset: (parseInt(page) - 1) * parseInt(limit),
    order: [['created_at', 'DESC']],
  });
  res.json({ success: true, data: rows, meta: { total: count, page: parseInt(page), limit: parseInt(limit) } });
}

/** GET /api/anggota/:id */
async function detail(req, res) {
  const a = await Anggota.findOne({ where: { id: req.params.id, tenant_id: req.user.tenantId } });
  if (!a) return res.status(404).json({ success: false, message: 'Anggota tidak ditemukan.' });
  res.json({ success: true, data: a });
}

/** POST /api/anggota */
async function create(req, res) {
  const data = { ...req.body, tenant_id: req.user.tenantId };
  const a = await Anggota.create(data);

  // Otomatis buat record simpanan untuk setiap jenis yang wajib
  const jenisWajib = await SimpananJenis.findAll({ where: { tenant_id: req.user.tenantId, wajib: true } });
  await Promise.all(jenisWajib.map(j => Simpanan.create({ tenant_id: req.user.tenantId, anggota_id: a.id, simpanan_jenis_id: j.id, saldo: 0 })));

  await logAudit({ userId: req.user.id, tenantId: req.user.tenantId, aksi: 'CREATE', tabel: 'anggota', recordId: a.id, dataBaru: data, req });
  
  // ─── NOTIFIKASI WA DINAMIS ────────────────────────────────
  const bypassWA = req.settings?.wa_enabled === false;
  if (!bypassWA && a.telepon) {
     const tpl = req.settings?.template_wa_welcome || 'Selamat bergabung {nama} di Koperasi. No Anggota: {no_anggota}.';
     const msg = parseTemplate(tpl, { 
        nama: a.nama, 
        no_anggota: a.no_anggota,
        koperasi: req.settings?.nama_koperasi || 'Ukoperasi'
     });
     sendWAMessage(a.telepon, msg, req.settings?.wa_token);
     
     // Kirim ke grup pengurus jika ada
     if (req.settings?.wa_group_admin) {
        const groupMsg = `[REGISTRASI] Anggota baru terdaftar:\nNama: ${a.nama}\nNo: ${a.no_anggota}`;
        sendWAMessage(req.settings.wa_group_admin, groupMsg, req.settings?.wa_token);
     }
  }

  res.status(201).json({ success: true, message: 'Anggota berhasil ditambahkan.', data: { id: a.id, no_anggota: a.no_anggota } });
}

/** PUT /api/anggota/:id */
async function update(req, res) {
  const a = await Anggota.findOne({ where: { id: req.params.id, tenant_id: req.user.tenantId } });
  if (!a) return res.status(404).json({ success: false, message: 'Anggota tidak ditemukan.' });
  const dataLama = a.toJSON();
  await a.update(req.body);
  await logAudit({ userId: req.user.id, tenantId: req.user.tenantId, aksi: 'UPDATE', tabel: 'anggota', recordId: a.id, dataLama, dataBaru: req.body, req });
  res.json({ success: true, message: 'Data anggota diperbarui.' });
}

/** DELETE /api/anggota/:id (non-aktifkan) */
async function remove(req, res) {
  const a = await Anggota.findOne({ where: { id: req.params.id, tenant_id: req.user.tenantId } });
  if (!a) return res.status(404).json({ success: false, message: 'Anggota tidak ditemukan.' });
  await a.update({ status: 'non_aktif' });
  await logAudit({ userId: req.user.id, tenantId: req.user.tenantId, aksi: 'NONAKTIF', tabel: 'anggota', recordId: a.id, req });
  res.json({ success: true, message: 'Anggota dinonaktifkan.' });
}

/** GET /api/anggota/:id/ledger */
async function ledger(req, res) {
  const { id } = req.params;
  const { tahun } = req.query;
  const tenant_id = req.user.tenantId;

  const { sequelize, SimpananTransaksi, PinjamanAngsuran, Penjualan } = require('../../models');

  // Multi-query aggregation with SQL for performance
  const data = await sequelize.query(`
    (SELECT st.tanggal, 'SIMPANAN' as kategori, st.tipe as jenis, CAST(st.nominal AS DOUBLE) as nominal, st.keterangan
     FROM simpanan_transaksi st
     JOIN simpanan s ON st.simpanan_id = s.id
     WHERE s.anggota_id = :id AND st.tenant_id = :tenant_id
     ${tahun ? 'AND YEAR(st.tanggal) = :tahun' : ''})
    UNION ALL
    (SELECT pa.tgl_bayar as tanggal, 'PINJAMAN' as kategori, 'angsuran' as jenis, CAST((pa.bayar_pokok + pa.bayar_bunga) AS DOUBLE) as nominal, CONCAT('Angsuran ke-', pa.ke) as keterangan
     FROM pinjaman_angsuran pa
     JOIN pinjaman p ON pa.pinjaman_id = p.id
     WHERE p.anggota_id = :id AND pa.status != 'belum'
     ${tahun ? 'AND YEAR(pa.tgl_bayar) = :tahun' : ''})
    UNION ALL
    (SELECT p.tanggal, 'BELANJA' as kategori, p.metode_bayar as jenis, CAST(p.total AS DOUBLE) as nominal, p.no_faktur as keterangan
     FROM penjualan p
     WHERE p.anggota_id = :id AND p.tenant_id = :tenant_id
     ${tahun ? 'AND YEAR(p.tanggal) = :tahun' : ''})
    ORDER BY tanggal DESC
  `, { replacements: { id, tenant_id, tahun }, type: sequelize.QueryTypes.SELECT });

  res.json({ success: true, data });
}

module.exports = { list, detail, create, update, remove, ledger };
