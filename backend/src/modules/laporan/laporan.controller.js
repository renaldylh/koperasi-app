// ============================================================
// LAPORAN SAK EP — Neraca, Laba Rugi, Arus Kas, CALK
// ============================================================
const { sequelize } = require('../../models');

function q(tenantId, tahun, tipe, posisi) {
  return sequelize.query(`
    SELECT COALESCE(SUM(jd.nominal), 0) AS total
    FROM jurnal_detail jd
    JOIN jurnal_header jh ON jd.jurnal_header_id = jh.id
    JOIN rekening r ON jd.rekening_id = r.id
    WHERE jh.tenant_id = :tenantId AND YEAR(jh.tanggal) = :tahun
      AND r.tipe = :tipe AND jd.posisi = :posisi
  `, { replacements: { tenantId, tahun, tipe, posisi }, type: sequelize.QueryTypes.SELECT });
}

function qByTipe(tenantId, tahun, tipe) {
  return sequelize.query(`
    SELECT r.kode, r.nama, r.posisi_normal,
      COALESCE(SUM(CASE WHEN jd.posisi='D' THEN jd.nominal ELSE 0 END),0) AS debit,
      COALESCE(SUM(CASE WHEN jd.posisi='K' THEN jd.nominal ELSE 0 END),0) AS kredit
    FROM rekening r
    LEFT JOIN jurnal_detail jd ON r.id = jd.rekening_id
    LEFT JOIN jurnal_header jh ON jd.jurnal_header_id = jh.id
      AND jh.tenant_id = :tenantId AND YEAR(jh.tanggal) = :tahun
    WHERE r.tenant_id = :tenantId AND r.tipe = :tipe AND r.aktif = 1
    GROUP BY r.id ORDER BY r.kode
  `, { replacements: { tenantId, tahun, tipe }, type: sequelize.QueryTypes.SELECT });
}

/** GET /api/laporan/neraca */
async function neraca(req, res) {
  const { tahun = new Date().getFullYear() } = req.query;
  const tenantId = req.user.tenantId;

  const [aset, kewajiban, ekuitas] = await Promise.all([
    qByTipe(tenantId, tahun, 'aset'),
    qByTipe(tenantId, tahun, 'kewajiban'),
    qByTipe(tenantId, tahun, 'ekuitas'),
  ]);

  const calcSaldo = (rows, posNormal) => rows.map(r => ({
    ...r,
    saldo: posNormal === 'D'
      ? parseFloat(r.debit) - parseFloat(r.kredit)
      : parseFloat(r.kredit) - parseFloat(r.debit),
  }));

  const asetData     = calcSaldo(aset, 'D');
  const kewajibanData = calcSaldo(kewajiban, 'K');
  const ekuitasData  = calcSaldo(ekuitas, 'K');

  const totalAset     = asetData.reduce((s,r)=>s+r.saldo,0);
  const totalKewajiban= kewajibanData.reduce((s,r)=>s+r.saldo,0);
  const totalEkuitas  = ekuitasData.reduce((s,r)=>s+r.saldo,0);
  const balance       = Math.abs(totalAset - (totalKewajiban + totalEkuitas)) < 1;

  res.json({ success: true, data: {
    tahun, aset: asetData, kewajiban: kewajibanData, ekuitas: ekuitasData,
    total_aset: totalAset, total_kewajiban_ekuitas: totalKewajiban + totalEkuitas,
    balance,
  }});
}

/** GET /api/laporan/perubahan-ekuitas */
async function perubahanEkuitas(req, res) {
  const { tahun = new Date().getFullYear() } = req.query;
  const tenantId = req.user.tenantId;

  // Ekuitas: Simpanan Pokok, Wajib, Cadangan, SHU Ditahan
  const ekuitas = await qByTipe(tenantId, tahun, 'ekuitas');
  const calcSaldo = (rows) => rows.map(r => ({
    kode: r.kode, nama: r.nama,
    saldo_akhir: parseFloat(r.kredit) - parseFloat(r.debit)
  }));

  const ekuitasData = calcSaldo(ekuitas);
  const totalEkuitas = ekuitasData.reduce((s,r) => s + r.saldo_akhir, 0);

  res.json({ success: true, data: {
    tahun,
    ekuitas: ekuitasData,
    total_ekuitas_akhir: totalEkuitas
  }});
}

/** GET /api/laporan/laba-rugi */
async function labaRugi(req, res) {
  const { tahun = new Date().getFullYear() } = req.query;
  const tenantId = req.user.tenantId;

  const [pendapatanItems, bebanItems] = await Promise.all([
    qByTipe(tenantId, tahun, 'pendapatan'),
    qByTipe(tenantId, tahun, 'beban'),
  ]);

  const pendapatanData = pendapatanItems.map(r => ({ ...r, saldo: parseFloat(r.kredit) - parseFloat(r.debit) }));
  const bebanData      = bebanItems.map(r => ({ ...r, saldo: parseFloat(r.debit) - parseFloat(r.kredit) }));

  const totalPendapatan = pendapatanData.reduce((s,r)=>s+r.saldo,0);
  const totalBeban      = bebanData.reduce((s,r)=>s+r.saldo,0);
  const shu             = totalPendapatan - totalBeban;

  res.json({ success: true, data: {
    tahun, pendapatan: pendapatanData, beban: bebanData,
    total_pendapatan: totalPendapatan, total_beban: totalBeban, shu,
  }});
}

/** GET /api/laporan/arus-kas */
async function arusKas(req, res) {
  const { tahun = new Date().getFullYear() } = req.query;
  const tenantId = req.user.tenantId;

  // Penyederhanaan: arus kas aktual (penerimaan/pengeluaran riil)
  // Operasi: Pemasukan operasional, angsuran pinjaman (bunga & pokok), pengeluaran beban
  // Investasi: Pembelian aset tetap (jika ada kode akun aset>1-002 misal)
  // Pendanaan: Setoran simpanan anggota, penarikan simpanan anggota, pencairan pinjaman

  const kasReks = await sequelize.query(`
    SELECT id FROM rekening WHERE tenant_id = :tenantId AND kode LIKE '1-001%'
  `, { replacements: { tenantId }, type: sequelize.QueryTypes.SELECT });
  const kasIds = kasReks.map(r => r.id);

  if (!kasIds.length) return res.json({ success: true, data: { tahun, operasi:{}, investasi:{}, pendanaan:{} }});

  // Ambil semua transaksi Kas (Debit = Masuk, Kredit = Keluar)
  const mutasiKas = await sequelize.query(`
    SELECT jd.posisi, SUM(jd.nominal) as total, jh.referensi_tipe
    FROM jurnal_detail jd
    JOIN jurnal_header jh ON jd.jurnal_header_id = jh.id
    WHERE jh.tenant_id = :tenantId AND YEAR(jh.tanggal) = :tahun
      AND jd.rekening_id IN (:kasIds)
    GROUP BY jd.posisi, jh.referensi_tipe
  `, { replacements: { tenantId, tahun, kasIds }, type: sequelize.QueryTypes.SELECT });

  let opMasuk = 0, opKeluar = 0;
  let invMasuk = 0, invKeluar = 0;  
  let pendMasuk = 0, pendKeluar = 0;

  for (const m of mutasiKas) {
     const t = parseFloat(m.total);
     const isMasuk = m.posisi === 'D';
     
     if (m.referensi_tipe === 'simpanan_setoran') pendMasuk += t;
     else if (m.referensi_tipe === 'simpanan_penarikan') pendKeluar += t;
     else if (m.referensi_tipe === 'pinjaman_pencairan') pendKeluar += t; // Kredit ke anggota
     else if (m.referensi_tipe === 'pinjaman_angsuran') opMasuk += t; // Operasional utama
     else if (m.referensi_tipe === 'operasional_masuk') opMasuk += t;
     else if (m.referensi_tipe === 'operasional_keluar') opKeluar += t;
     else if (m.referensi_tipe === 'aset_pembelian') invKeluar += t;
     else if (m.referensi_tipe === 'aset_penjualan') invMasuk += t;
  }

  res.json({ success: true, data: {
    tahun,
    operasi: { masuk: opMasuk, keluar: opKeluar, kas_bersih: opMasuk - opKeluar },
    investasi: { masuk: invMasuk, keluar: invKeluar, kas_bersih: invMasuk - invKeluar },
    pendanaan: { masuk: pendMasuk, keluar: pendKeluar, kas_bersih: pendMasuk - pendKeluar },
    kenaikan_penurunan_kas: (opMasuk - opKeluar) + (invMasuk - invKeluar) + (pendMasuk - pendKeluar)
  }});
}

/** GET /api/laporan/calk — Catatan Atas Laporan Keuangan (ringkasan) */
async function calk(req, res) {
  const { tahun = new Date().getFullYear() } = req.query;
  res.json({
    success: true,
    data: {
      tahun,
      kebijakan_akuntansi: [
        '1. Umum: Laporan keuangan disusun berdasarkan SAK EP (Standar Akuntansi Keuangan Entitas Privat) secara Asumsi Dasar Akrual.',
        '2. Kas & Bank: Mencakup uang tunai dan saldo rekening bank yang bebas digunakan.',
        '3. Piutang Pinjaman: Piutang pinjaman disajikan sebesar saldo pokok yang belum dilunasi. Denda keterlambatan diakui saat diterima (Cash basis).',
        '4. Simpanan Anggota: Simpanan Pokok dan Wajib diakui sebagai Ekuitas. Simpanan Sukarela diakui sebagai Kewajiban Jangka Pendek.',
        '5. Aset Tetap: Dicatat sebesar biaya perolehan dan disusutkan menggunakan metode garis lurus.',
        '6. Pengakuan Pendapatan & Beban: Pendapatan bunga dan operasional dicatat menggunakan basis akrual, kecuali denda.',
        '7. Pembagian SHU: SHU = Pendapatan - Beban. Distribusi SHU dilakukan setelah dikurangi pajak dan dialokasikan sesuai AD/ART (Dana Cadangan, Jasa Modal, Jasa Usaha).',
      ],
    },
  });
}

module.exports = { neraca, labaRugi, perubahanEkuitas, arusKas, calk };
