const { sequelize, Rekening, JurnalHeader, JurnalDetail } = require('../../models');
const { Op } = require('sequelize');

/** GET /api/akuntansi/rekening */
async function listRekening(req, res) {
  const rekenings = await Rekening.findAll({
    where: { tenant_id: req.user.tenantId },
    order: [['kode','ASC']],
  });
  res.json({ success: true, data: rekenings });
}

/** GET /api/akuntansi/jurnal */
async function listJurnal(req, res) {
  const { page = 1, limit = 30, dari, sampai } = req.query;
  const where = { tenant_id: req.user.tenantId };
  if (dari && sampai) where.tanggal = { [Op.between]: [dari, sampai] };
  const { count, rows } = await JurnalHeader.findAndCountAll({
    where, include: [{ model: JurnalDetail, as: 'details', include: [Rekening] }],
    order: [['tanggal','ASC'],['created_at','ASC']],
    limit: parseInt(limit), offset: (parseInt(page)-1)*parseInt(limit),
  });
  res.json({ success: true, data: rows, meta: { total: count, page: parseInt(page), limit: parseInt(limit) } });
}

/** GET /api/akuntansi/buku-besar/:rekeningId */
async function bukuBesar(req, res) {
  const { dari, sampai } = req.query;
  const rekening = await Rekening.findOne({ where: { id: req.params.rekeningId, tenant_id: req.user.tenantId } });
  if (!rekening) return res.status(404).json({ success: false, message: 'Rekening tidak ditemukan.' });

  const rows = await sequelize.query(`
    SELECT jh.tanggal, jh.no_jurnal, jh.keterangan,
      CASE WHEN jd.posisi = 'D' THEN jd.nominal ELSE 0 END AS debit,
      CASE WHEN jd.posisi = 'K' THEN jd.nominal ELSE 0 END AS kredit
    FROM jurnal_detail jd
    JOIN jurnal_header jh ON jd.jurnal_header_id = jh.id
    WHERE jd.rekening_id = :rekeningId
      AND jh.tenant_id = :tenantId
      ${dari && sampai ? 'AND jh.tanggal BETWEEN :dari AND :sampai' : ''}
    ORDER BY jh.tanggal ASC, jh.created_at ASC
  `, {
    replacements: { rekeningId: req.params.rekeningId, tenantId: req.user.tenantId, dari, sampai },
    type: sequelize.QueryTypes.SELECT,
  });

  // Hitung saldo berjalan
  let saldo = 0;
  const data = rows.map(r => {
    const debit  = parseFloat(r.debit);
    const kredit = parseFloat(r.kredit);
    if (rekening.posisi_normal === 'D') saldo += debit - kredit;
    else                                saldo += kredit - debit;
    return { ...r, saldo };
  });

  res.json({ success: true, rekening, data });
}

/** GET /api/akuntansi/neraca-saldo */
async function neracaSaldo(req, res) {
  const { sampai } = req.query;
  const rows = await sequelize.query(`
    SELECT r.kode, r.nama, r.tipe, r.posisi_normal,
      COALESCE(SUM(CASE WHEN jd.posisi = 'D' THEN jd.nominal ELSE 0 END), 0) AS total_debit,
      COALESCE(SUM(CASE WHEN jd.posisi = 'K' THEN jd.nominal ELSE 0 END), 0) AS total_kredit
    FROM rekening r
    LEFT JOIN jurnal_detail jd ON r.id = jd.rekening_id
    LEFT JOIN jurnal_header jh ON jd.jurnal_header_id = jh.id
      AND jh.tenant_id = :tenantId
      ${sampai ? 'AND jh.tanggal <= :sampai' : ''}
    WHERE r.tenant_id = :tenantId AND r.aktif = 1
    GROUP BY r.id
    ORDER BY r.kode
  `, {
    replacements: { tenantId: req.user.tenantId, sampai },
    type: sequelize.QueryTypes.SELECT,
  });

  const result = rows.map(r => ({
    ...r,
    saldo: r.posisi_normal === 'D'
      ? parseFloat(r.total_debit) - parseFloat(r.total_kredit)
      : parseFloat(r.total_kredit) - parseFloat(r.total_debit),
  }));

  const totalDebitNeraca = result.filter(r => r.saldo > 0 && ['aset'].includes(r.tipe)).reduce((s,r) => s+r.saldo, 0);
  res.json({ success: true, data: result, total_debit: totalDebitNeraca });
}

/** POST /api/akuntansi/jurnal/bulk */
async function bulkJurnal(req, res) {
  const { rows } = req.body;
  if (!rows || rows.length === 0) return res.status(400).json({ success: false, message: 'Data kosong.' });

  const t = await sequelize.transaction();
  try {
    // 1. Ambil semua rekening untuk mapping kode -> id
    const rekenings = await Rekening.findAll({ where: { tenant_id: req.user.tenantId } });
    const coaMap = rekenings.reduce((acc, r) => ({ ...acc, [r.kode]: r.id }), {});

    // 2. Grouping by Tanggal + Keterangan (Agar jadi 1 No Jurnal per transaksi logis)
    const groups = {};
    rows.forEach(r => {
      const key = `${r.tanggal}_${r.keterangan}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    });

    for (const key in groups) {
      const groupRows = groups[key];
      const { tanggal, keterangan } = groupRows[0];

      // Create Header
      const header = await JurnalHeader.create({
        id: require('uuid').v4(),
        tenant_id: req.user.tenantId,
        no_jurnal: `JR-${Date.now()}-${Math.floor(Math.random()*1000)}`,
        tanggal,
        keterangan,
        tipe: 'MEMORIAL'
      }, { transaction: t });

      // Create Details
      for (const r of groupRows) {
        const rekeningId = coaMap[r.coa];
        if (!rekeningId) throw new Error(`Kode Akun ${r.coa} tidak ditemukan.`);

        await JurnalDetail.create({
          id: require('uuid').v4(),
          jurnal_header_id: header.id,
          rekening_id: rekeningId,
          posisi: r.posisi || (r.debit > 0 ? 'D' : 'K'),
          nominal: r.debit > 0 ? r.debit : r.kredit
        }, { transaction: t });
      }
    }

    await t.commit();
    res.json({ success: true, message: 'Berhasil menyimpan jurnal massal.' });
  } catch (err) {
    await t.rollback();
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = { listRekening, listJurnal, bulkJurnal, bukuBesar, neracaSaldo };
