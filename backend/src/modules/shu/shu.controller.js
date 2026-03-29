const { sequelize, ShuPeriode, ShuDistribusi, Anggota } = require('../../models');
const { hitungSHU } = require('../../utils/shuCalculator');
const { jurnalClosingSHU } = require('../../utils/jurnalEngine');
const { randomUUID } = require('crypto');
const uuidv4 = randomUUID;

/** POST /api/shu/hitung */
async function hitung(req, res) {
  const { tahun, pct_jasa_modal = 30, pct_jasa_usaha = 40 } = req.body;
  const tenantId = req.user.tenantId;
  const result = await hitungSHU(tenantId, tahun, {
    pctJasaModal: pct_jasa_modal, pctJasaUsaha: pct_jasa_usaha,
  });

  // Simpan / update draft SHU periode
  const [periode] = await ShuPeriode.findOrCreate({
    where: { tenant_id: tenantId, tahun },
    defaults: {
      id: uuidv4(), tenant_id: tenantId, tahun,
      total_shu: result.total_shu,
      persentase_jasa_modal: pct_jasa_modal,
      persentase_jasa_usaha: pct_jasa_usaha,
      status: 'draft',
    },
  });
  await periode.update({ total_shu: result.total_shu });

  // Upsert distribusi
  await ShuDistribusi.destroy({ where: { shu_periode_id: periode.id } });
  await ShuDistribusi.bulkCreate(result.distribusi.map(d => ({
    id: uuidv4(), shu_periode_id: periode.id, ...d,
  })));

  res.json({ success: true, data: result });
}

/** GET /api/shu/:periodeId */
async function detail(req, res) {
  const periode = await ShuPeriode.findOne({
    where: { id: req.params.periodeId, tenant_id: req.user.tenantId },
    include: [{ model: ShuDistribusi, as: 'distribusi', include: [{ model: Anggota, attributes: ['nama','no_anggota'] }] }],
  });
  if (!periode) return res.status(404).json({ success: false, message: 'Periode SHU tidak ditemukan.' });
  res.json({ success: true, data: periode });
}

/** POST /api/shu/:periodeId/closing */
async function closing(req, res) {
  const tenantId = req.user.tenantId;
  const periode = await ShuPeriode.findOne({ where: { id: req.params.periodeId, tenant_id: tenantId } });
  if (!periode) return res.status(404).json({ success: false, message: 'Periode tidak ditemukan.' });
  if (periode.status === 'final') return res.status(400).json({ success: false, message: 'Closing sudah dilakukan.' });

  const dbTx = await sequelize.transaction();
  try {
    const { hitungPendapatanBeban } = require('../../utils/shuCalculator');
    const { pendapatan, beban } = await hitungPendapatanBeban(tenantId, periode.tahun);
    const jurnalHeader = await jurnalClosingSHU({
      tenantId, userId: req.user.id, tahun: periode.tahun,
      totalPendapatan: pendapatan, totalBeban: beban,
    }, dbTx);
    await periode.update({ status: 'final', closing_entry_id: jurnalHeader.id }, { transaction: dbTx });
    await dbTx.commit();
    res.json({ success: true, message: `Closing SHU tahun ${periode.tahun} berhasil.`, data: { jurnal_id: jurnalHeader.id } });
  } catch (err) {
    await dbTx.rollback();
    throw err;
  }
}

module.exports = { hitung, detail, closing };
