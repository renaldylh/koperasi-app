const cron = require('node-cron');
const { Op } = require('sequelize');
const { PinjamanAngsuran, Pinjaman, Tenant } = require('../models');
const { hitungPenyusutanBulanan } = require('../modules/aset/aset.controller');

// ============================================================
// CRON JOB: DENDA KETERLAMBATAN HARIAN (0.1% per hari)
// Berjalan setiap hari jam 00:01
// ============================================================
function initCronJobs() {
  cron.schedule('1 0 * * *', async () => {
    console.log('[CRON] Menjalankan perhitungan denda keterlambatan harian...');
    try {
      const today = new Date().toISOString().slice(0, 10);
      
      // Cari angsuran yang belum bayar dan jatuh tempo < hari ini
      const angsuranTelat = await PinjamanAngsuran.findAll({
        where: {
          status: { [Op.in]: ['belum', 'telat'] },
          jatuh_tempo: { [Op.lt]: today }
        },
        include: [{ model: Pinjaman, attributes: ['sisa_pokok', 'status'] }]
      });

      let updatedCount = 0;
      for (const angsuran of angsuranTelat) {
        if (angsuran.Pinjaman.status === 'lunas' || angsuran.Pinjaman.status === 'macet') continue;

        // Denda harian = 0.1% dari pokok angsuran
        const penambahanDenda = parseFloat(angsuran.pokok) * 0.001; 
        const dendaBaru = parseFloat(angsuran.bayar_denda) + penambahanDenda;

        await angsuran.update({
          status: 'telat',
          bayar_denda: Math.round(dendaBaru)
        });
        updatedCount++;
      }

      console.log(`[CRON] Selesai. ${updatedCount} jadwal angsuran diperbarui dendanya.`);
    } catch (err) {
      console.error('[CRON] Gagal memproses denda harian:', err.message);
    }
  });

  // ============================================================
  // CRON JOB: PENYUSUTAN ASET TETAP BULANAN
  // Berjalan setiap tanggal 1 jam 01:00
  // ============================================================
  cron.schedule('0 1 1 * *', async () => {
    console.log('[CRON] Menjalankan penyusutan aset tetap bulanan...');
    try {
       const today = new Date().toISOString().slice(0, 10);
       const tenants = await Tenant.findAll({ where: { aktif: true } });
       
       let totalAsetSut = 0;
       for (const t of tenants) {
         // Use a system user ID or null for background jobs if your audit log allows
         // the controller expects tenantId, userId, tanggal
         const count = await hitungPenyusutanBulanan(t.id, null, today);
         totalAsetSut += count;
       }
       console.log(`[CRON] Selesai. ${totalAsetSut} aset tetap disusutkan bulan ini.`);
    } catch (err) {
       console.error('[CRON] Gagal memproses penyusutan aset:', err.message);
    }
  });
}

module.exports = { initCronJobs };
