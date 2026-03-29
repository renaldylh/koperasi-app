// ============================================================
// SHU CALCULATOR — SAK EP Compliant
// SHU = Pendapatan - Beban
// Distribusi: Jasa Modal (simpanan) + Jasa Usaha (transaksi)
// ============================================================
const { sequelize, JurnalHeader, JurnalDetail, Rekening, Simpanan, SimpananTransaksi, Anggota, ShuDistribusi } = require('../models');
const { Op } = require('sequelize');

/**
 * Hitung total pendapatan dan beban dari jurnal dalam satu tahun
 */
async function hitungPendapatanBeban(tenantId, tahun) {
  const baseWhere = {
    tenant_id: tenantId,
    tanggal: {
      [Op.between]: [`${tahun}-01-01`, `${tahun}-12-31`],
    },
  };

  const [pendapatanRows, bebanRows] = await Promise.all([
    sequelize.query(`
      SELECT COALESCE(SUM(jd.nominal), 0) AS total
      FROM jurnal_detail jd
      JOIN jurnal_header jh ON jd.jurnal_header_id = jh.id
      JOIN rekening r ON jd.rekening_id = r.id
      WHERE jh.tenant_id = :tenantId
        AND YEAR(jh.tanggal) = :tahun
        AND r.tipe = 'pendapatan'
        AND jd.posisi = 'K'
    `, { replacements: { tenantId, tahun }, type: sequelize.QueryTypes.SELECT }),

    sequelize.query(`
      SELECT COALESCE(SUM(jd.nominal), 0) AS total
      FROM jurnal_detail jd
      JOIN jurnal_header jh ON jd.jurnal_header_id = jh.id
      JOIN rekening r ON jd.rekening_id = r.id
      WHERE jh.tenant_id = :tenantId
        AND YEAR(jh.tanggal) = :tahun
        AND r.tipe = 'beban'
        AND jd.posisi = 'D'
    `, { replacements: { tenantId, tahun }, type: sequelize.QueryTypes.SELECT }),
  ]);

  return {
    pendapatan: parseFloat(pendapatanRows[0]?.total || 0),
    beban: parseFloat(bebanRows[0]?.total || 0),
  };
}

/**
 * Hitung distribusi SHU per anggota
 * - Jasa Modal: proporsional terhadap rata-rata simpanan
 * - Jasa Usaha: proporsional terhadap total transaksi (setoran + angsuran)
 */
async function hitungSHU(tenantId, tahun, config = {}) {
  const {
    pctJasaModal   = 30,
    pctJasaUsaha   = 40,
  } = config;

  // 1. Hitung total SHU
  const { pendapatan, beban } = await hitungPendapatanBeban(tenantId, tahun);
  const totalSHU = pendapatan - beban;

  const shuUntukJasaModal = totalSHU * (pctJasaModal / 100);
  const shuUntukJasaUsaha = totalSHU * (pctJasaUsaha / 100);

  // 2. Ambil semua anggota aktif
  const anggotaList = await Anggota.findAll({
    where: { tenant_id: tenantId, status: 'aktif' },
    attributes: ['id', 'nama', 'no_anggota'],
  });

  // 3. Hitung total simpanan per anggota (rata-rata saldo akhir)
  const simpananRows = await sequelize.query(`
    SELECT s.anggota_id, COALESCE(SUM(s.saldo), 0) AS total_simpanan
    FROM simpanan s
    WHERE s.tenant_id = :tenantId
    GROUP BY s.anggota_id
  `, { replacements: { tenantId }, type: sequelize.QueryTypes.SELECT });

  const simpananMap = {};
  simpananRows.forEach(r => { simpananMap[r.anggota_id] = parseFloat(r.total_simpanan); });
  const totalSimpananSemua = simpananRows.reduce((s, r) => s + parseFloat(r.total_simpanan), 0);

  // 4. Hitung total transaksi per anggota dalam tahun berjalan
  const transaksiRows = await sequelize.query(`
    SELECT st.simpanan_id, s.anggota_id,
      COALESCE(SUM(st.nominal), 0) AS total_transaksi
    FROM simpanan_transaksi st
    JOIN simpanan s ON st.simpanan_id = s.id
    WHERE st.tenant_id = :tenantId
      AND YEAR(st.tanggal) = :tahun
    GROUP BY s.anggota_id
  `, { replacements: { tenantId, tahun }, type: sequelize.QueryTypes.SELECT });

  const transaksiMap = {};
  transaksiRows.forEach(r => { transaksiMap[r.anggota_id] = parseFloat(r.total_transaksi); });
  const totalTransaksiSemua = transaksiRows.reduce((s, r) => s + parseFloat(r.total_transaksi), 0);

  // 5. Hitung distribusi per anggota
  const distribusi = anggotaList.map(a => {
    const sSimpanan  = simpananMap[a.id]   || 0;
    const sTransaksi = transaksiMap[a.id]  || 0;

    const jasaModal = totalSimpananSemua > 0
      ? (sSimpanan / totalSimpananSemua) * shuUntukJasaModal : 0;
    const jasaUsaha = totalTransaksiSemua > 0
      ? (sTransaksi / totalTransaksiSemua) * shuUntukJasaUsaha : 0;

    return {
      anggota_id:         a.id,
      nama:               a.nama,
      no_anggota:         a.no_anggota,
      total_simpanan:     sSimpanan,
      total_transaksi:    sTransaksi,
      jasa_modal:         Math.round(jasaModal),
      jasa_usaha:         Math.round(jasaUsaha),
      total_shu_diterima: Math.round(jasaModal + jasaUsaha),
    };
  });

  return {
    tahun,
    pendapatan,
    beban,
    total_shu: totalSHU,
    shu_jasa_modal: shuUntukJasaModal,
    shu_jasa_usaha: shuUntukJasaUsaha,
    shu_dana_cadangan: totalSHU * 0.20,
    shu_dana_sosial:   totalSHU * 0.10,
    distribusi,
  };
}

module.exports = { hitungSHU, hitungPendapatanBeban };
