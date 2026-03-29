const { sequelize, AsetTetap, Rekening } = require('../../models');
const { createJurnal, validateBalance } = require('../../utils/jurnalEngine');
const { logAudit } = require('../../middleware/auditLog');
const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');

/** GET /api/aset */
async function list(req, res) {
  const { page = 1, limit = 20, status } = req.query;
  const where = { tenant_id: req.user.tenantId };
  if (status) where.status = status;
  
  const { count, rows } = await AsetTetap.findAndCountAll({
    where,
    order: [['created_at', 'DESC']],
    limit: parseInt(limit),
    offset: (parseInt(page) - 1) * parseInt(limit)
  });
  
  res.json({ success: true, data: rows, meta: { total: count, page: parseInt(page), limit: parseInt(limit) } });
}

/** GET /api/aset/:id */
async function detail(req, res) {
  const aset = await AsetTetap.findOne({ where: { id: req.params.id, tenant_id: req.user.tenantId } });
  if (!aset) return res.status(404).json({ success: false, message: 'Aset tidak ditemukan' });
  res.json({ success: true, data: aset });
}

/** POST /api/aset */
async function create(req, res) {
  const { kode, nama, kategori, tanggal_perolehan, harga_perolehan, umur_ekonomis, nilai_sisa = 0, metode_penyusutan = 'garis_lurus', beban_rekening_id, akumulasi_rekening_id } = req.body;
  const tenantId = req.user.tenantId;

  // Validate that the CoA are provided
  if (!beban_rekening_id || !akumulasi_rekening_id) {
     return res.status(400).json({ success: false, message: 'ID Rekening Beban dan Akumulasi wajib diisi.' });
  }

  const aset = await AsetTetap.create({
    id: uuidv4(),
    tenant_id: tenantId,
    kode, nama, kategori,
    tanggal_perolehan,
    harga_perolehan,
    umur_ekonomis,
    nilai_sisa,
    nilai_buku: harga_perolehan,
    metode_penyusutan,
    beban_rekening_id,
    akumulasi_rekening_id,
    status: 'aktif'
  });

  await logAudit({ userId: req.user.id, tenantId, aksi:'CREATE', tabel:'aset_tetap', recordId:aset.id, dataBaru:req.body, req });
  res.status(201).json({ success: true, message: 'Aset Tetap berhasil diregistrasi.', data: aset });
}

/**
 * Service function to process asset depreciation for one month.
 * Designed to be called by cron or manually.
 */
async function hitungPenyusutanBulanan(tenantId, userId, tanggal) {
  const tglTutup = new Date(tanggal || new Date());
  
  // Ambil semua aset yang masih aktif dan nilai buku > nilai sisa
  const asetAktifList = await AsetTetap.findAll({
    where: { 
      tenant_id: tenantId, 
      status: 'aktif',
      nilai_buku: { [Op.gt]: sequelize.col('nilai_sisa') }
    }
  });

  if (asetAktifList.length === 0) return 0;

  let totalDisusutkan = 0;
  const dbTx = await sequelize.transaction();

  try {
    for (const aset of asetAktifList) {
      // Perhitungan Garis Lurus (Straight Line)
      // (Harga Perolehan - Nilai Sisa) / Umur Ekonomis
      const bebanPenyusutanRupiah = (parseFloat(aset.harga_perolehan) - parseFloat(aset.nilai_sisa)) / aset.umur_ekonomis;
      
      // Jika disusutkan hasilnya bikin nilai buku < nilai sisa, cap load-nya
      let bebanTercatat = bebanPenyusutanRupiah;
      if (parseFloat(aset.nilai_buku) - bebanTercatat < parseFloat(aset.nilai_sisa)) {
        bebanTercatat = parseFloat(aset.nilai_buku) - parseFloat(aset.nilai_sisa);
      }

      if (bebanTercatat <= 0) continue;

      // Buat jurnal penyusutan
      // D: Beban Penyusutan
      // K: Akumulasi Penyusutan
      await createJurnal({
        tenantId,
        referensiTipe: 'penyusutan_aset',
        referensiId: aset.id,
        tanggal: tglTutup.toISOString().slice(0,10),
        keterangan: `Penyusutan Aset Tetap: ${aset.nama} (${tglTutup.toISOString().slice(0,7)})`,
        entries: [
          { rekeningId: aset.beban_rekening_id, posisi: 'D', nominal: Math.round(bebanTercatat) },
          { rekeningId: aset.akumulasi_rekening_id, posisi: 'K', nominal: Math.round(bebanTercatat) },
        ]
      }, dbTx);

      // Update nilai buku & akumulasi 
      const akumulasiBaru = parseFloat(aset.akumulasi_penyusutan) + bebanTercatat;
      const nilaiBukuBaru = parseFloat(aset.nilai_buku) - bebanTercatat;

      // Tandai lunas/habis jika nilai buku sudah menyentuh nilai sisa
      if (nilaiBukuBaru <= parseFloat(aset.nilai_sisa)) {
         // Optionally change status, but standard 'aktif' means it's still being used, just fully depreciated.
      }

      await aset.update({
        akumulasi_penyusutan: Math.round(akumulasiBaru),
        nilai_buku: Math.round(nilaiBukuBaru)
      }, { transaction: dbTx });

      totalDisusutkan++;
    }

    await dbTx.commit();
    return totalDisusutkan;

  } catch (err) {
    await dbTx.rollback();
    throw err;
  }
}

/** POST /api/aset/penyusutan — Manual trigger for current month */
async function runPenyusutan(req, res) {
  const { tanggal } = req.body;
  try {
    const total = await hitungPenyusutanBulanan(req.user.tenantId, req.user.id, tanggal);
    res.json({ success: true, message: `Berhasil mensusutkan ${total} aset tetap untuk periode ini.` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal melakukan penyusutan', error: err.message });
  }
}

module.exports = { list, detail, create, runPenyusutan, hitungPenyusutanBulanan };
