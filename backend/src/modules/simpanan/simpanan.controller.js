const { jurnalSetoranSimpanan, jurnalPenarikanSimpanan } = require('../../utils/jurnalEngine');
const { logAudit } = require('../../middleware/auditLog');
const { sendWAMessage, parseTemplate } = require('../../utils/wa');
const { v4: uuidv4 } = require('uuid');

/** GET /api/simpanan/:anggotaId — saldo per anggota */
async function getSaldo(req, res) {
  const { anggotaId } = req.params;
  const data = await Simpanan.findAll({
    where: { tenant_id: req.user.tenantId, anggota_id: anggotaId },
    include: [{ model: SimpananJenis, attributes: ['nama', 'kode'] }],
  });
  const total = data.reduce((s, d) => s + parseFloat(d.saldo), 0);
  res.json({ success: true, data, total });
}

/** GET /api/simpanan/:anggotaId/riwayat — riwayat transaksi */
async function getRiwayat(req, res) {
  const { anggotaId } = req.params;
  const { page = 1, limit = 20 } = req.query;
  const simpananIds = await Simpanan.findAll({
    where: { tenant_id: req.user.tenantId, anggota_id: anggotaId },
    attributes: ['id'],
  });
  const ids = simpananIds.map(s => s.id);
  const { count, rows } = await SimpananTransaksi.findAndCountAll({
    where: { simpanan_id: ids },
    include: [{ model: Simpanan, include: [SimpananJenis] }],
    order: [['tanggal', 'DESC']],
    limit: parseInt(limit),
    offset: (parseInt(page) - 1) * parseInt(limit),
  });
  res.json({ success: true, data: rows, meta: { total: count, page: parseInt(page), limit: parseInt(limit) } });
}

/** POST /api/simpanan/setoran */
async function setoran(req, res) {
  const { anggota_id, simpanan_jenis_id, nominal, tanggal, keterangan } = req.body;
  const tenantId = req.user.tenantId;

  const dbTx = await sequelize.transaction();
  try {
    const simpanan = await Simpanan.findOne({
      where: { tenant_id: tenantId, anggota_id, simpanan_jenis_id },
      include: [
         { model: Anggota }, 
         { model: SimpananJenis }
      ],
      lock: dbTx.LOCK.UPDATE, transaction: dbTx,
    });
    if (!simpanan) throw new Error('Rekening simpanan tidak ditemukan.');

    const saldoSebelum = parseFloat(simpanan.saldo);
    const nom = parseFloat(nominal);
    const saldoSesudah = saldoSebelum + nom;

    await simpanan.update({ saldo: saldoSesudah }, { transaction: dbTx });

    const jurnalHeader = await jurnalSetoranSimpanan({
      tenantId, userId: req.user.id, anggotaId: anggota_id,
      nominal: nom, tanggal: tanggal || new Date().toISOString().slice(0,10),
      keterangan: keterangan || 'Setoran simpanan',
    }, dbTx);

    await SimpananTransaksi.create({
      id: uuidv4(), tenant_id: tenantId, simpanan_id: simpanan.id,
      tipe: 'setoran', nominal: nom,
      saldo_sebelum: saldoSebelum, saldo_sesudah: saldoSesudah,
      jurnal_header_id: jurnalHeader.id,
      keterangan, tanggal: tanggal || new Date().toISOString().slice(0,10),
      user_id: req.user.id,
    }, { transaction: dbTx });

    await dbTx.commit();
    await logAudit({ userId: req.user.id, tenantId, aksi: 'SETORAN', tabel: 'simpanan', recordId: simpanan.id, dataBaru: { nominal, saldoSesudah }, req });
    
    // ─── WA NOTIFIKASI DINAMIS ────────────────────────────────
    const minNominal = req.settings?.wa_min_nominal || 50000;
    const isWajibPokok = ['Simpanan Wajib', 'Simpanan Pokok'].includes(simpanan.SimpananJenis?.nama);
    
    if (req.settings?.wa_enabled !== false && simpanan.Anggota?.telepon) {
       if (nom >= minNominal || isWajibPokok) {
          const tpl = req.settings?.template_wa_setoran || 'Setoran {jenis} sebesar {nominal} berhasil. Saldo: {saldo}.';
          const msg = parseTemplate(tpl, {
             nama: simpanan.Anggota.nama,
             jenis: simpanan.SimpananJenis?.nama || 'Simpanan',
             nominal: nom.toLocaleString('id-ID'),
             saldo: saldoSesudah.toLocaleString('id-ID'),
             tanggal: tanggal || new Date().toISOString().slice(0,10)
          });
          
          // USE MEGA GATEWAY CONFIG
          const gatewayUrl = req.settings?.wa_gateway_url || 'https://api.whatsapp.com/send';
          const gatewayKey = req.settings?.wa_gateway_key || req.settings?.wa_token;
          sendWAMessage(simpanan.Anggota.telepon, msg, gatewayKey, gatewayUrl);

          // Notif ke grup jika iuran besar
          if (req.settings?.wa_group_admin && (nom >= 1000000 || isWajibPokok)) {
             sendWAMessage(req.settings.wa_group_admin, `[SETORAN] ${simpanan.Anggota.nama} membayar ${simpanan.SimpananJenis?.nama} Rp${nom.toLocaleString('id-ID')}`, gatewayKey, gatewayUrl);
          }
       }
    }

    res.json({ success: true, message: `Setoran Rp${nom.toLocaleString('id')} berhasil.`, data: { saldo_sesudah: saldoSesudah } });
  } catch (err) {
    await dbTx.rollback();
    throw err;
  }
}

/** POST /api/simpanan/penarikan */
async function penarikan(req, res) {
  const { anggota_id, simpanan_jenis_id, nominal, tanggal, keterangan } = req.body;
  const tenantId = req.user.tenantId;

  const dbTx = await sequelize.transaction();
  try {
    const simpanan = await Simpanan.findOne({
      where: { tenant_id: tenantId, anggota_id, simpanan_jenis_id },
      include: [
         { model: Anggota }, 
         { model: SimpananJenis }
      ],
      lock: dbTx.LOCK.UPDATE, transaction: dbTx,
    });
    if (!simpanan) throw new Error('Rekening simpanan tidak ditemukan.');

    const saldoSebelum = parseFloat(simpanan.saldo);
    const nom = parseFloat(nominal);
    
    // USE DYNAMIC MIN BALANCE
    const minSaldo = parseFloat(req.settings?.min_saldo_mengendap || 0);
    if (nom > (saldoSebelum - minSaldo)) {
       throw new Error(`Saldo tidak mencukupi. Minimal saldo mengendap: Rp${minSaldo.toLocaleString('id-ID')}`);
    }

    const saldoSesudah = saldoSebelum - nom;
    await simpanan.update({ saldo: saldoSesudah }, { transaction: dbTx });

    const jurnalHeader = await jurnalPenarikanSimpanan({
      tenantId, userId: req.user.id, anggotaId: anggota_id,
      nominal: nom, tanggal: tanggal || new Date().toISOString().slice(0,10),
      keterangan: keterangan || 'Penarikan simpanan',
    }, dbTx);

    await SimpananTransaksi.create({
      id: uuidv4(), tenant_id: tenantId, simpanan_id: simpanan.id,
      tipe: 'penarikan', nominal: nom,
      saldo_sebelum: saldoSebelum, saldo_sesudah: saldoSesudah,
      jurnal_header_id: jurnalHeader.id,
      keterangan, tanggal: tanggal || new Date().toISOString().slice(0,10),
      user_id: req.user.id,
    }, { transaction: dbTx });

    await dbTx.commit();
    await logAudit({ userId: req.user.id, tenantId, aksi: 'PENARIKAN', tabel: 'simpanan', recordId: simpanan.id, dataBaru: { nominal, saldoSesudah }, req });
    
    // ─── WA NOTIFIKASI DINAMIS ────────────────────────────────
    if (req.settings?.wa_enabled !== false && simpanan.Anggota?.telepon) {
       const tpl = req.settings?.template_wa_penarikan || 'Penarikan {jenis} sebesar {nominal} diproses. Sisa saldo: {saldo}.';
       const msg = parseTemplate(tpl, {
          nama: simpanan.Anggota.nama,
          jenis: simpanan.SimpananJenis?.nama || 'Simpanan',
          nominal: nom.toLocaleString('id-ID'),
          saldo: saldoSesudah.toLocaleString('id-ID'),
          tanggal: tanggal || new Date().toISOString().slice(0,10)
       });
       sendWAMessage(simpanan.Anggota.telepon, msg, req.settings?.wa_token);
    }

    res.json({ success: true, message: `Penarikan Rp${nom.toLocaleString('id')} berhasil.`, data: { saldo_sesudah: saldoSesudah } });
  } catch (err) {
    await dbTx.rollback();
    throw err;
  }
}

/** GET /api/simpanan/rekap — rekap total simpanan semua anggota */
async function rekap(req, res) {
  const { sequelize: db } = require('../../models');
  const rows = await db.query(`
    SELECT a.no_anggota, a.nama,
      COALESCE(SUM(s.saldo), 0) AS total_simpanan,
      COUNT(DISTINCT s.simpanan_jenis_id) AS jumlah_jenis
    FROM anggota a
    LEFT JOIN simpanan s ON a.id = s.anggota_id
    WHERE a.tenant_id = :tenantId AND a.status = 'aktif'
    GROUP BY a.id
    ORDER BY a.nama
  `, { replacements: { tenantId: req.user.tenantId }, type: db.QueryTypes.SELECT });
  const grandTotal = rows.reduce((s, r) => s + parseFloat(r.total_simpanan), 0);
  res.json({ success: true, data: rows, grand_total: grandTotal });
}

/** POST /api/simpanan/setoran/bulk */
async function bulkSetoran(req, res) {
  const { rows } = req.body;
  const { tenantId: tenant_id, id: user_id } = req.user;
  const { Anggota, Simpanan, SimpananJenis, SimpananTransaksi, sequelize } = require('../../models');

  const result = await sequelize.transaction(async (t) => {
    let count = 0;
    for (const r of rows) {
      if (!r.no_anggota || !r.nominal) continue;

      const anggota = await Anggota.findOne({ where: { no_anggota: r.no_anggota, tenant_id }, transaction: t });
      if (!anggota) continue;

      const jenis = await SimpananJenis.findOne({ where: { kode: r.jenis, tenant_id }, transaction: t });
      if (!jenis) continue;

      let simpanan = await Simpanan.findOne({ where: { anggota_id: anggota.id, simpanan_jenis_id: jenis.id, tenant_id }, transaction: t });
      if (!simpanan) {
          simpanan = await Simpanan.create({ anggota_id: anggota.id, simpanan_jenis_id: jenis.id, tenant_id, saldo: 0 }, { transaction: t });
      }

      const saldo_sebelum = parseFloat(simpanan.saldo);
      const saldo_sesudah = saldo_sebelum + parseFloat(r.nominal);

      await simpanan.update({ saldo: saldo_sesudah }, { transaction: t });
      await SimpananTransaksi.create({
        tenant_id, simpanan_id: simpanan.id, tipe: 'setoran',
        nominal: r.nominal, saldo_sebelum, saldo_sesudah,
        tanggal: new Date().toISOString().slice(0,10),
        keterangan: r.keterangan || 'Bulk Setoran Excel',
        user_id
      }, { transaction: t });
      count++;
    }
    return { count };
  });

  res.json({ success: true, message: `Berhasil memproses ${result.count} setoran.`, data: result });
}

module.exports = { getSaldo, getRiwayat, setoran, penarikan, rekap, bulkSetoran };
