const { sequelize, Anggota, Simpanan, SimpananJenis, SimpananTransaksi, Pinjaman, PinjamanAngsuran, Tenant } = require('../../models');
const { generateToken } = require('../../middleware/auth');
const { randomUUID } = require('crypto');
const uuidv4 = randomUUID;
const { Op } = require('sequelize');

/** POST /api/member/login — Login Khusus Anggota via NIK & No Anggota */
async function login(req, res) {
  const { no_anggota, nik } = req.body;
  if (!no_anggota || !nik) {
    return res.status(400).json({ success: false, message: 'No Anggota dan NIK wajib diisi.' });
  }

  const anggota = await Anggota.findOne({
    where: { no_anggota, nik },
    include: [{ model: Tenant, attributes: ['nama', 'aktif'] }]
  });

  if (!anggota) {
    return res.status(401).json({ success: false, message: 'No Anggota atau NIK tidak valid.' });
  }
  
  if (anggota.status !== 'aktif') {
    return res.status(403).json({ success: false, message: 'Status keanggotaan Anda tidak aktif.' });
  }

  if (!anggota.Tenant.aktif) {
    return res.status(403).json({ success: false, message: 'Sistem Koperasi sedang dinonaktifkan.' });
  }

  // Generate Token (Role: anggota is hardcoded because it's the Member Portal)
  // We mock a user payload for JWT matching the same structure as operators
  const mockUserPayload = {
    id: anggota.id, // we map anggota.id to user.id internally for the JWT
    tenantId: anggota.tenant_id,
    role: 'anggota'
  };

  const token = generateToken(mockUserPayload);

  res.json({
    success: true,
    message: 'Login berhasil.',
    data: {
      token,
      anggota: {
        id: anggota.id,
        nama: anggota.nama,
        no_anggota: anggota.no_anggota,
        koperasi: anggota.Tenant.nama
      }
    }
  });
}

/** GET /api/member/dashboard — Saldo, Mutasi, Pinjaman */
async function dashboard(req, res) {
  const anggotaId = req.user.id; // comes from the JWT payload
  const tenantId  = req.user.tenantId;

  // 1. Simpanan Balances & History
  const simpananList = await Simpanan.findAll({
    where: { anggota_id: anggotaId, tenant_id: tenantId },
    include: [{ model: SimpananJenis, attributes: ['nama'] }]
  });
  
  const simpananIds = simpananList.map(s => s.id);
  const totalSimpanan = simpananList.reduce((acc, curr) => acc + parseFloat(curr.saldo || 0), 0);

  // Recent 5 transactions
  const mutasi = await SimpananTransaksi.findAll({
    where: { simpanan_id: { [Op.in]: simpananIds } },
    order: [['created_at', 'DESC']],
    limit: 10,
    include: [{ model: Simpanan, include: [SimpananJenis] }]
  });

  // 2. Pinjaman Aktif
  const pinjamanAktif = await Pinjaman.findAll({
    where: { anggota_id: anggotaId, tenant_id: tenantId, status: { [Op.in]: ['cair', 'diajukan', 'disetujui'] } },
    order: [['created_at', 'DESC']]
  });

  const totalSisaPokokPinjaman = pinjamanAktif.reduce((acc, curr) => acc + parseFloat(curr.sisa_pokok || 0), 0);

  res.json({
    success: true,
    data: {
      total_simpanan: totalSimpanan,
      total_sisa_pinjaman: totalSisaPokokPinjaman,
      saldo_simpanan: simpananList,
      pinjaman_aktif: pinjamanAktif,
      mutasi: mutasi.map(m => ({
        id: m.id,
        tanggal: m.tanggal,
        tipe: m.tipe,
        nominal: m.nominal,
        saldo_sesudah: m.saldo_sesudah,
        jenis: m.Simpanan.SimpananJenis.nama,
        keterangan: m.keterangan
      }))
    }
  });
}

/** POST /api/member/pengajuan — Pengajuan Pinjaman Online */
async function pengajuanPinjaman(req, res) {
  const { pokok, suku_bunga, jangka_waktu, tujuan, metode_angsuran = 'flat' } = req.body;
  const anggotaId = req.user.id;
  const tenantId  = req.user.tenantId;

  const count = await Pinjaman.count({ where: { tenant_id: tenantId } });
  const no_pinjaman = `PJM-OL-${new Date().getFullYear()}-${String(count+1).padStart(5,'0')}`;

  const p = await Pinjaman.create({
    id: uuidv4(),
    tenant_id: tenantId,
    anggota_id: anggotaId,
    no_pinjaman,
    pokok,
    suku_bunga,
    jangka_waktu,
    tujuan,
    metode_angsuran,
    sisa_pokok: pokok,
    status: 'diajukan'
  });

  res.status(201).json({
    success: true,
    message: 'Pengajuan pinjaman online berhasil dikirim dan menunggu persetujuan pengurus.',
    data: p
  });
}

module.exports = { login, dashboard, pengajuanPinjaman };
