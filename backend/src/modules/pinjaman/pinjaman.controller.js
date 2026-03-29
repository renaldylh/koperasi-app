const { sequelize, Pinjaman, PinjamanAngsuran, Anggota, PinjamanAgunan } = require('../../models');
const { Op } = require('sequelize');
const { jurnalPencairanPinjaman, jurnalAngsuranPinjaman } = require('../../utils/jurnalEngine');
const { logAudit } = require('../../middleware/auditLog');
const { v4: uuidv4 } = require('uuid');

/**
 * Hitung jadwal angsuran (metode flat)
 */
function hitungAngsuranFlat(pokok, sukuBunga, jangkaWaktu) {
  const bungaPerBulan = (pokok * (sukuBunga / 100));
  const pokokPerBulan = pokok / jangkaWaktu;
  const jadwal = [];
  for (let i = 1; i <= jangkaWaktu; i++) {
    jadwal.push({
      id: uuidv4(), ke: i,
      pokok: Math.round(pokokPerBulan),
      bunga: Math.round(bungaPerBulan),
      total: Math.round(pokokPerBulan + bungaPerBulan),
    });
  }
  return jadwal;
}

/** GET /api/pinjaman */
async function list(req, res) {
  const { page = 1, limit = 20, status } = req.query;
  const where = { tenant_id: req.user.tenantId };
  if (status) where.status = status;
  const { count, rows } = await Pinjaman.findAndCountAll({
    where, include: [{ model: Anggota, attributes: ['nama','no_anggota'] }],
    order: [['created_at','DESC']], limit: parseInt(limit),
    offset: (parseInt(page) - 1) * parseInt(limit),
  });
  res.json({ success: true, data: rows, meta: { total: count, page: parseInt(page), limit: parseInt(limit) } });
}

/** GET /api/pinjaman/:id */
async function detail(req, res) {
  const p = await Pinjaman.findOne({
    where: { id: req.params.id, tenant_id: req.user.tenantId },
    include: [
      { model: Anggota, attributes: ['nama','no_anggota'] },
      { model: PinjamanAngsuran, as: 'angsuran', order: [['ke','ASC']] },
      { model: PinjamanAgunan, as: 'agunan' }
    ],
  });
  if (!p) return res.status(404).json({ success: false, message: 'Pinjaman tidak ditemukan.' });
  res.json({ success: true, data: p });
}

/** POST /api/pinjaman — ajukan pinjaman baru */
async function create(req, res) {
  let { anggota_id, pokok, suku_bunga, jangka_waktu, tujuan, metode_angsuran = 'flat' } = req.body;
  const tenantId = req.user.tenantId;

  // DYNAMIC SETTINGS LOAD
  const maxPlafond = parseFloat(req.settings?.pinjaman_max_plafond || 100000000);
  const maxTenor = parseInt(req.settings?.pinjaman_max_tenor || 60);
  const defaultBunga = parseFloat(req.settings?.bunga_pinjaman_default || 1.5);

  if (parseFloat(pokok) > maxPlafond) throw new Error(`Nominal pinjaman melebihi limit (Maks: Rp${maxPlafond.toLocaleString('id-ID')})`);
  if (parseInt(jangka_waktu) > maxTenor) throw new Error(`Jangka waktu melebihi limit (Maks: ${maxTenor} bulan)`);
  if (!suku_bunga) suku_bunga = defaultBunga;

  const count = await Pinjaman.count({ where: { tenant_id: tenantId } });
  const no_pinjaman = `PJM-${new Date().getFullYear()}-${String(count+1).padStart(5,'0')}`;

  const p = await Pinjaman.create({
    id: uuidv4(), tenant_id: tenantId, anggota_id,
    no_pinjaman, pokok, suku_bunga, jangka_waktu,
    tujuan, metode_angsuran, sisa_pokok: pokok, status: 'diajukan',
  });
  await logAudit({ userId: req.user.id, tenantId, aksi:'CREATE', tabel:'pinjaman', recordId:p.id, dataBaru:req.body, req });
  res.status(201).json({ success: true, message: 'Pinjaman diajukan.', data: { id: p.id, no_pinjaman } });
}

/** PUT /api/pinjaman/:id/setujui */
async function setujui(req, res) {
  const p = await Pinjaman.findOne({ where: { id: req.params.id, tenant_id: req.user.tenantId } });
  if (!p) return res.status(404).json({ success: false, message: 'Pinjaman tidak ditemukan.' });
  if (p.status !== 'diajukan') return res.status(400).json({ success: false, message: 'Hanya pinjaman berstatus "diajukan" yang bisa disetujui.' });
  await p.update({ status: 'disetujui' });
  res.json({ success: true, message: 'Pinjaman disetujui.' });
}

/** PUT /api/pinjaman/:id/cairkan */
async function cairkan(req, res) {
  const { tanggal_cair } = req.body;
  const tenantId = req.user.tenantId;
  const p = await Pinjaman.findOne({ where: { id: req.params.id, tenant_id: tenantId } });
  if (!p) return res.status(404).json({ success: false, message: 'Pinjaman tidak ditemukan.' });
  if (p.status !== 'disetujui') return res.status(400).json({ success: false, message: 'Pinjaman belum disetujui.' });

  const dbTx = await sequelize.transaction();
  try {
    const tglCair = tanggal_cair || new Date().toISOString().slice(0,10);
    const tglJatuhTempo = new Date(tglCair);
    tglJatuhTempo.setMonth(tglJatuhTempo.getMonth() + p.jangka_waktu);

    // DYNAMIC FEES
    const provisiPersen = parseFloat(req.settings?.provisi_pinjaman_persen || 0);
    const asuransiPersen = parseFloat(req.settings?.asuransi_pinjaman_persen || 0);
    const biayaProvisi = (provisiPersen / 100) * parseFloat(p.pokok);
    const biayaAsuransi = (asuransiPersen / 100) * parseFloat(p.pokok);

    const jurnalHeader = await jurnalPencairanPinjaman({
      tenantId, userId: req.user.id, pinjamanId: p.id,
      nominal: parseFloat(p.pokok), tanggal: tglCair,
      biayaProvisi, biayaAsuransi, // Pass fees to journal engine
    }, dbTx);

    // Buat jadwal angsuran
    const jadwal = hitungAngsuranFlat(parseFloat(p.pokok), parseFloat(p.suku_bunga), p.jangka_waktu);
    const angsuranData = jadwal.map((j, idx) => {
      const tglAngsuran = new Date(tglCair);
      tglAngsuran.setMonth(tglAngsuran.getMonth() + idx + 1);
      return {
        ...j, pinjaman_id: p.id,
        jatuh_tempo: tglAngsuran.toISOString().slice(0,10),
        status: 'belum',
      };
    });
    await PinjamanAngsuran.bulkCreate(angsuranData, { transaction: dbTx });

    await p.update({
      status: 'cair', tanggal_cair: tglCair,
      tanggal_jatuh_tempo: tglJatuhTempo.toISOString().slice(0,10),
      jurnal_cair_id: jurnalHeader.id,
    }, { transaction: dbTx });

    await dbTx.commit();
    await logAudit({ userId: req.user.id, tenantId, aksi:'CAIRKAN', tabel:'pinjaman', recordId:p.id, dataBaru:{ tglCair }, req });
    res.json({ success: true, message: 'Pinjaman dicairkan. Jadwal angsuran dibuat.', data: { jurnal_id: jurnalHeader.id } });
  } catch (err) {
    await dbTx.rollback();
    throw err;
  }
}

/** POST /api/pinjaman/:id/bayar — bayar angsuran */
async function bayarAngsuran(req, res) {
  const { angsuran_ke, tgl_bayar, bayar_denda = 0 } = req.body;
  const tenantId = req.user.tenantId;

  const p = await Pinjaman.findOne({ where: { id: req.params.id, tenant_id: tenantId } });
  if (!p) return res.status(404).json({ success: false, message: 'Pinjaman tidak ditemukan.' });

  const angsuran = await PinjamanAngsuran.findOne({ where: { pinjaman_id: p.id, ke: angsuran_ke, status: 'belum' } });
  if (!angsuran) return res.status(404).json({ success: false, message: 'Angsuran tidak ditemukan atau sudah lunas.' });

  const dbTx = await sequelize.transaction();
  try {
    const tanggal = tgl_bayar || new Date().toISOString().slice(0,10);
    
    // DYNAMIC DENDA LOGIC
    let dendaNominal = parseFloat(bayar_denda);
    const dendaRate = parseFloat(req.settings?.denda_telat_persen || 0);
    const isLate = new Date(tanggal) > new Date(angsuran.jatuh_tempo);
    
    if (isLate && dendaNominal === 0 && dendaRate > 0) {
       const diffTime = Math.abs(new Date(tanggal) - new Date(angsuran.jatuh_tempo));
       const daysLate = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
       dendaNominal = (dendaRate / 100) * parseFloat(angsuran.total) * daysLate;
    }

    const jurnalHeader = await jurnalAngsuranPinjaman({
      tenantId, userId: req.user.id, angsuranId: angsuran.id,
      pokokNominal: parseFloat(angsuran.pokok),
      bungaNominal: parseFloat(angsuran.bunga),
      dendaNominal,
      tanggal,
    }, dbTx);

    const sisaPokok = parseFloat(p.sisa_pokok) - parseFloat(angsuran.pokok);
    const allLunas = sisaPokok <= 0;

    await angsuran.update({
      tgl_bayar: tanggal, status: 'lunas',
      bayar_pokok: angsuran.pokok, bayar_bunga: angsuran.bunga, 
      bayar_denda: dendaNominal,
      jurnal_header_id: jurnalHeader.id,
    }, { transaction: dbTx });

    await p.update({
      sisa_pokok: Math.max(0, sisaPokok),
      status: allLunas ? 'lunas' : 'cair',
    }, { transaction: dbTx });

    await dbTx.commit();
    res.json({ success: true, message: `Angsuran ke-${angsuran_ke} berhasil dibayar.`, data: { sisa_pokok: Math.max(0, sisaPokok), lunas: allLunas } });
  } catch (err) {
    await dbTx.rollback();
    throw err;
  }
}

/** GET /api/pinjaman/:id/agunan */
async function getAgunan(req, res) {
  const agunan = await PinjamanAgunan.findAll({
    where: { pinjaman_id: req.params.id },
    order: [['created_at', 'DESC']]
  });
  res.json({ success: true, data: agunan });
}

/** POST /api/pinjaman/:id/agunan */
async function addAgunan(req, res) {
  const { jenis, nilai_taksiran, deskripsi, foto_url } = req.body;
  const p = await Pinjaman.findOne({ where: { id: req.params.id, tenant_id: req.user.tenantId } });
  if (!p) return res.status(404).json({ success: false, message: 'Pinjaman tidak ditemukan.' });

  const ag = await PinjamanAgunan.create({
    id: uuidv4(),
    pinjaman_id: p.id,
    jenis, nilai_taksiran, deskripsi, foto_url
  });
  
  await logAudit({ userId: req.user.id, tenantId: req.user.tenantId, aksi:'CREATE', tabel:'pinjaman_agunan', recordId:ag.id, dataBaru:req.body, req });
  res.status(201).json({ success: true, message: 'Data agunan berhasil ditambahkan.', data: ag });
}

/** PUT /api/pinjaman/:id/agunan/:agunanId/kembali */
async function kembalikanAgunan(req, res) {
  const ag = await PinjamanAgunan.findOne({ where: { id: req.params.agunanId, pinjaman_id: req.params.id } });
  if (!ag) return res.status(404).json({ success: false, message: 'Agunan tidak ditemukan.' });

  await ag.update({ status_kembali: true });
  await logAudit({ userId: req.user.id, tenantId: req.user.tenantId, aksi:'UPDATE', tabel:'pinjaman_agunan', recordId:ag.id, dataBaru:{ status_kembali: true }, req });
  
  res.json({ success: true, message: 'Agunan ditandai sudah dikembalikan ke anggota.' });
}

/** GET /api/pinjaman/kolektibilitas — NPL Dashboard */
async function kolektibilitas(req, res) {
  const pinjamanAktif = await Pinjaman.findAll({
    where: { tenant_id: req.user.tenantId, status: { [Op.in]: ['cair', 'macet'] } },
    include: [
      { model: Anggota, attributes: ['nama', 'no_anggota'] },
      { model: PinjamanAngsuran, as: 'angsuran', where: { status: { [Op.in]: ['belum', 'telat'] } }, required: false }
    ]
  });

  const today = new Date();
  const summary = {
    1: { label: 'Lancar', jml: 0, sisa_pokok: 0 },
    2: { label: 'DPK (1-90)', jml: 0, sisa_pokok: 0 },
    3: { label: 'Kurang Lancar (91-120)', jml: 0, sisa_pokok: 0 },
    4: { label: 'Diragukan (121-180)', jml: 0, sisa_pokok: 0 },
    5: { label: 'Macet (>180)', jml: 0, sisa_pokok: 0 }
  };

  const list = pinjamanAktif.map(p => {
    let hariTelat = 0;
    const angsuranTelat = p.angsuran.filter(a => new Date(a.jatuh_tempo) < today);
    if (angsuranTelat.length > 0) {
      // Find oldest angsuran telat
      const tertua = angsuranTelat.reduce((min, a) => new Date(a.jatuh_tempo) < new Date(min.jatuh_tempo) ? a : min, angsuranTelat[0]);
      const diffTime = Math.abs(today - new Date(tertua.jatuh_tempo));
      hariTelat = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    }

    let kol = 1;
    if (hariTelat > 180) kol = 5;
    else if (hariTelat > 120) kol = 4;
    else if (hariTelat > 90) kol = 3;
    else if (hariTelat > 0) kol = 2;

    const pokok = parseFloat(p.sisa_pokok);
    summary[kol].jml += 1;
    summary[kol].sisa_pokok += pokok;

    return {
      id: p.id,
      no_pinjaman: p.no_pinjaman,
      anggota: p.Anggota?.nama,
      sisa_pokok: pokok,
      hari_telat: hariTelat,
      kolektibilitas: kol,
      label: summary[kol].label
    };
  });

  list.sort((a, b) => b.hari_telat - a.hari_telat);

  res.json({ success: true, data: { summary: Object.values(summary), list } });
}

module.exports = { list, detail, create, setujui, cairkan, bayarAngsuran, getAgunan, addAgunan, kembalikanAgunan, kolektibilitas };
