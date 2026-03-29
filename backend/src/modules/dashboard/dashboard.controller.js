const { sequelize } = require('../../models');
const { Op } = require('sequelize');

/** GET /api/dashboard */
async function stats(req, res) {
  const tenantId = req.user.tenantId;
  const tahun = new Date().getFullYear();

  const [totalAnggota, totalSimpanan, totalPinjaman, totalPiutang, shuBerjalan, pinjamanMacet] = await Promise.all([
    sequelize.query(`SELECT COUNT(*) AS total FROM anggota WHERE tenant_id=:t AND status='aktif'`, { replacements:{t:tenantId}, type:sequelize.QueryTypes.SELECT }),
    sequelize.query(`SELECT COALESCE(SUM(saldo),0) AS total FROM simpanan WHERE tenant_id=:t`, { replacements:{t:tenantId}, type:sequelize.QueryTypes.SELECT }),
    sequelize.query(`SELECT COALESCE(SUM(pokok),0) AS total FROM pinjaman WHERE tenant_id=:t AND status='cair'`, { replacements:{t:tenantId}, type:sequelize.QueryTypes.SELECT }),
    sequelize.query(`SELECT COALESCE(SUM(sisa_pokok),0) AS total FROM pinjaman WHERE tenant_id=:t AND status IN ('cair','macet')`, { replacements:{t:tenantId}, type:sequelize.QueryTypes.SELECT }),
    sequelize.query(`
      SELECT COALESCE(SUM(CASE WHEN r.tipe='pendapatan' AND jd.posisi='K' THEN jd.nominal ELSE -jd.nominal END),0) AS total
      FROM jurnal_detail jd JOIN jurnal_header jh ON jd.jurnal_header_id=jh.id JOIN rekening r ON jd.rekening_id=r.id
      WHERE jh.tenant_id=:t AND YEAR(jh.tanggal)=:y AND r.tipe IN ('pendapatan','beban')
    `, { replacements:{t:tenantId,y:tahun}, type:sequelize.QueryTypes.SELECT }),
    sequelize.query(`SELECT COUNT(*) AS total FROM pinjaman WHERE tenant_id=:t AND status='macet'`, { replacements:{t:tenantId}, type:sequelize.QueryTypes.SELECT }),
  ]);

  res.json({
    success: true,
    data: {
      total_anggota:    parseInt(totalAnggota[0]?.total || 0),
      total_simpanan:   parseFloat(totalSimpanan[0]?.total || 0),
      total_pinjaman:   parseFloat(totalPinjaman[0]?.total || 0),
      total_piutang:    parseFloat(totalPiutang[0]?.total || 0),
      shu_berjalan:     parseFloat(shuBerjalan[0]?.total || 0),
      pinjaman_macet:   parseInt(pinjamanMacet[0]?.total || 0),
    },
  });
}

module.exports = { stats };
