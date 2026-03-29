// ============================================================
// JURNAL ENGINE — SAK EP COMPLIANT (IMMUTABLE — JANGAN DIUBAH)
// ============================================================
const { JurnalHeader, JurnalDetail, Rekening } = require('../models');
const { v4: uuidv4 } = require('uuid');

/**
 * Validasi double-entry: total debit HARUS = total kredit
 * @param {Array} entries
 */
function validateBalance(entries) {
  const totalDebit  = entries.reduce((sum, e) => sum + (e.posisi === 'D' ? parseFloat(e.nominal) : 0), 0);
  const totalKredit = entries.reduce((sum, e) => sum + (e.posisi === 'K' ? parseFloat(e.nominal) : 0), 0);
  if (Math.abs(totalDebit - totalKredit) > 0.01) {
    throw new Error(`Jurnal tidak balance: Debit=${totalDebit.toFixed(2)}, Kredit=${totalKredit.toFixed(2)}`);
  }
  return { totalDebit, totalKredit };
}

/**
 * Buat nomor jurnal otomatis: JRN-YYYYMMDD-XXX
 */
async function generateNoJurnal(tenantId, transaction) {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const count  = await JurnalHeader.count({
    where: { tenant_id: tenantId },
    transaction,
  });
  return `JRN-${today}-${String(count + 1).padStart(4, '0')}`;
}

/**
 * Ambil rekening berdasarkan kode dan tenant
 */
async function getRekening(tenantId, kode, dbTx) {
  const rek = await Rekening.findOne({ where: { tenant_id: tenantId, kode }, transaction: dbTx });
  if (!rek) throw new Error(`Rekening kode="${kode}" tidak ditemukan untuk tenant ini.`);
  return rek;
}

/**
 * Core: Buat jurnal lengkap (header + detail) dalam satu transaksi DB
 */
async function createJurnal({ tenantId, userId, referensiTipe, referensiId, tanggal, keterangan, entries }, dbTx) {
  const { totalDebit, totalKredit } = validateBalance(entries);
  const noJurnal = await generateNoJurnal(tenantId, dbTx);

  const header = await JurnalHeader.create({
    id: uuidv4(),
    tenant_id:      tenantId,
    user_id:        userId,
    no_jurnal:      noJurnal,
    referensi_tipe: referensiTipe,
    referensi_id:   referensiId,
    tanggal,
    keterangan,
    total_debit:    totalDebit,
    total_kredit:   totalKredit,
  }, { transaction: dbTx });

  await JurnalDetail.bulkCreate(
    entries.map(e => ({
      id:               uuidv4(),
      jurnal_header_id: header.id,
      rekening_id:      e.rekeningId,
      posisi:           e.posisi,
      nominal:          parseFloat(e.nominal),
    })),
    { transaction: dbTx }
  );

  return header;
}

// ============================================================
// FLOW: SIMPANAN (FIXED — JANGAN DIUBAH)
// ============================================================

/** Setoran Simpanan: Debit Kas / Kredit Simpanan Anggota */
async function jurnalSetoranSimpanan({ tenantId, userId, anggotaId, nominal, tanggal, keterangan = 'Setoran simpanan anggota', settings }, dbTx) {
  const kasCode = settings?.coa_kas_utama || '1-001';
  const simpCode = settings?.coa_piutang_anggota || '2-001'; // Usually Simpanan is 2-xxx, but using settings key as guide

  const [kas, simpanan] = await Promise.all([
    getRekening(tenantId, kasCode, dbTx),
    getRekening(tenantId, '2-001', dbTx), // Hardcoded fallback for now if no specific simp COA
  ]);
  return createJurnal({
    tenantId, userId,
    referensiTipe: 'simpanan_setoran',
    referensiId:   anggotaId,
    tanggal, keterangan,
    entries: [
      { rekeningId: kas.id,      posisi: 'D', nominal },
      { rekeningId: simpanan.id, posisi: 'K', nominal },
    ],
  }, dbTx);
}

/** Penarikan Simpanan: Debit Simpanan Anggota / Kredit Kas */
async function jurnalPenarikanSimpanan({ tenantId, userId, anggotaId, nominal, tanggal, keterangan = 'Penarikan simpanan anggota', settings }, dbTx) {
  const kasCode = settings?.coa_kas_utama || '1-001';
  const [kas, simpanan] = await Promise.all([
    getRekening(tenantId, kasCode, dbTx),
    getRekening(tenantId, '2-001', dbTx),
  ]);
  return createJurnal({
    tenantId, userId,
    referensiTipe: 'simpanan_penarikan',
    referensiId:   anggotaId,
    tanggal, keterangan,
    entries: [
      { rekeningId: simpanan.id, posisi: 'D', nominal },
      { rekeningId: kas.id,      posisi: 'K', nominal },
    ],
  }, dbTx);
}

// ============================================================
// FLOW: PINJAMAN (FIXED — JANGAN DIUBAH)
// ============================================================

/** Pencairan Pinjaman: Debit Piutang / Kredit Kas */
async function jurnalPencairanPinjaman({ tenantId, userId, pinjamanId, nominal, tanggal, keterangan = 'Pencairan pinjaman', settings, biayaProvisi = 0, biayaAsuransi = 0 }, dbTx) {
  const kasCode = settings?.coa_bank_utama || settings?.coa_kas_utama || '1-001';
  const piutangCode = settings?.coa_piutang_anggota || '1-101';
  
  const [piutang, kas] = await Promise.all([
    getRekening(tenantId, piutangCode, dbTx),
    getRekening(tenantId, kasCode, dbTx),
  ]);
  return createJurnal({
    tenantId, userId,
    referensiTipe: 'pinjaman_pencairan',
    referensiId:   pinjamanId,
    tanggal, keterangan,
    entries: [
      { rekeningId: piutang.id, posisi: 'D', nominal },
      { rekeningId: kas.id,     posisi: 'K', nominal },
    ],
  }, dbTx);
}

/** Angsuran Pinjaman: Debit Kas / Kredit Piutang + Kredit Pendapatan Bunga */
async function jurnalAngsuranPinjaman({ tenantId, userId, angsuranId, pokokNominal, bungaNominal, dendaNominal = 0, tanggal, keterangan = 'Pembayaran angsuran', settings }, dbTx) {
  const kasCode = settings?.coa_kas_utama || '1-001';
  const piutangCode = settings?.coa_piutang_anggota || '1-101';
  const bungaCode = settings?.coa_pendapatan_bunga || '4-001';

  const [kas, piutang, pendBunga] = await Promise.all([
    getRekening(tenantId, kasCode, dbTx),
    getRekening(tenantId, piutangCode, dbTx),
    getRekening(tenantId, bungaCode, dbTx),
  ]);

  const totalBayar = parseFloat(pokokNominal) + parseFloat(bungaNominal) + parseFloat(dendaNominal);
  const entries = [
    { rekeningId: kas.id,     posisi: 'D', nominal: totalBayar },
    { rekeningId: piutang.id, posisi: 'K', nominal: pokokNominal },
  ];
  if (parseFloat(bungaNominal) > 0) {
    entries.push({ rekeningId: pendBunga.id, posisi: 'K', nominal: bungaNominal });
  }

  return createJurnal({
    tenantId, userId,
    referensiTipe: 'pinjaman_angsuran',
    referensiId:   angsuranId,
    tanggal, keterangan,
    entries,
  }, dbTx);
}

// ============================================================
// FLOW: OPERASIONAL (FIXED — JANGAN DIUBAH)
// ============================================================

/** Pemasukan Operasional: Debit Kas / Kredit Pendapatan */
async function jurnalPemasukanOperasional({ tenantId, userId, transaksiId, rekeningPendapatanId, nominal, tanggal, keterangan }, dbTx) {
  const kas = await getRekening(tenantId, '1-001', dbTx);
  return createJurnal({
    tenantId, userId,
    referensiTipe: 'operasional_masuk',
    referensiId:   transaksiId,
    tanggal, keterangan,
    entries: [
      { rekeningId: kas.id,               posisi: 'D', nominal },
      { rekeningId: rekeningPendapatanId, posisi: 'K', nominal },
    ],
  }, dbTx);
}

/** Pengeluaran Operasional: Debit Beban / Kredit Kas */
async function jurnalPengeluaranOperasional({ tenantId, userId, transaksiId, rekeningBebanId, nominal, tanggal, keterangan }, dbTx) {
  const kas = await getRekening(tenantId, '1-001', dbTx);
  return createJurnal({
    tenantId, userId,
    referensiTipe: 'operasional_keluar',
    referensiId:   transaksiId,
    tanggal, keterangan,
    entries: [
      { rekeningId: rekeningBebanId, posisi: 'D', nominal },
      { rekeningId: kas.id,          posisi: 'K', nominal },
    ],
  }, dbTx);
}

// ============================================================
// FLOW: CLOSING SHU (FIXED — JANGAN DIUBAH)
// ============================================================

/** Closing entry: Pendapatan & Beban → SHU → Ekuitas */
async function jurnalClosingSHU({ tenantId, userId, tahun, totalPendapatan, totalBeban }, dbTx) {
  const shu = totalPendapatan - totalBeban;
  const [pendapatan, beban, shuRek] = await Promise.all([
    getRekening(tenantId, '4-000', dbTx), // Akun kontrol Pendapatan
    getRekening(tenantId, '5-000', dbTx), // Akun kontrol Beban
    getRekening(tenantId, '3-002', dbTx), // SHU Berjalan / Ekuitas
  ]);
  const entries = [
    { rekeningId: pendapatan.id, posisi: 'D', nominal: totalPendapatan },
    { rekeningId: beban.id,      posisi: 'K', nominal: totalBeban },
    ...(shu >= 0
      ? [{ rekeningId: shuRek.id, posisi: 'K', nominal: shu }]
      : [{ rekeningId: shuRek.id, posisi: 'D', nominal: Math.abs(shu) }]
    ),
  ];
  return createJurnal({
    tenantId, userId,
    referensiTipe: 'closing_shu',
    referensiId:   null,
    tanggal: `${tahun}-12-31`,
    keterangan: `Closing Entry SHU Tahun ${tahun}`,
    entries,
  }, dbTx);
}

module.exports = {
  validateBalance,
  createJurnal,
  jurnalSetoranSimpanan,
  jurnalPenarikanSimpanan,
  jurnalPencairanPinjaman,
  jurnalAngsuranPinjaman,
  jurnalPemasukanOperasional,
  jurnalPengeluaranOperasional,
  jurnalClosingSHU,
};
