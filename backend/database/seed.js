// ============================================================
// SEED — Chart of Accounts (CoA) SAK EP + Default Data
// ============================================================
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { sequelize, Tenant, User, Rekening, SimpananJenis } = require('../src/models');

const TENANT_ID = '00000000-0000-0000-0000-000000000001';

const CoA = [
  // ASET
  { kode:'1-000', nama:'ASET',                       tipe:'aset',       posisi_normal:'D' },
  { kode:'1-001', nama:'Kas',                        tipe:'aset',       posisi_normal:'D' },
  { kode:'1-002', nama:'Bank BRI',                   tipe:'aset',       posisi_normal:'D' },
  { kode:'1-003', nama:'Bank BNI',                   tipe:'aset',       posisi_normal:'D' },
  { kode:'1-101', nama:'Piutang Anggota',            tipe:'aset',       posisi_normal:'D' },
  { kode:'1-102', nama:'Piutang Bunga',              tipe:'aset',       posisi_normal:'D' },
  { kode:'1-201', nama:'Persediaan ATK',             tipe:'aset',       posisi_normal:'D' },
  { kode:'1-301', nama:'Peralatan Kantor',           tipe:'aset',       posisi_normal:'D' },
  { kode:'1-302', nama:'Akm. Penyusutan Peralatan',  tipe:'aset',       posisi_normal:'K' },
  // KEWAJIBAN
  { kode:'2-000', nama:'KEWAJIBAN',                  tipe:'kewajiban',  posisi_normal:'K' },
  { kode:'2-001', nama:'Simpanan Anggota',           tipe:'kewajiban',  posisi_normal:'K' },
  { kode:'2-002', nama:'Simpanan Sukarela',          tipe:'kewajiban',  posisi_normal:'K' },
  { kode:'2-101', nama:'Utang Bank',                 tipe:'kewajiban',  posisi_normal:'K' },
  { kode:'2-201', nama:'Dana SHU Belum Dibagi',      tipe:'kewajiban',  posisi_normal:'K' },
  // EKUITAS
  { kode:'3-000', nama:'EKUITAS',                    tipe:'ekuitas',    posisi_normal:'K' },
  { kode:'3-001', nama:'Simpanan Pokok',             tipe:'ekuitas',    posisi_normal:'K' },
  { kode:'3-002', nama:'SHU Berjalan / Laba Ditahan',tipe:'ekuitas',    posisi_normal:'K' },
  { kode:'3-003', nama:'Dana Cadangan',              tipe:'ekuitas',    posisi_normal:'K' },
  // PENDAPATAN
  { kode:'4-000', nama:'PENDAPATAN',                 tipe:'pendapatan', posisi_normal:'K' },
  { kode:'4-001', nama:'Pendapatan Bunga Pinjaman',  tipe:'pendapatan', posisi_normal:'K' },
  { kode:'4-002', nama:'Pendapatan Jasa Administrasi',tipe:'pendapatan',posisi_normal:'K' },
  { kode:'4-003', nama:'Pendapatan Lain-lain',       tipe:'pendapatan', posisi_normal:'K' },
  // BEBAN
  { kode:'5-000', nama:'BEBAN',                      tipe:'beban',      posisi_normal:'D' },
  { kode:'5-001', nama:'Beban Gaji Pengurus',        tipe:'beban',      posisi_normal:'D' },
  { kode:'5-002', nama:'Beban ATK',                  tipe:'beban',      posisi_normal:'D' },
  { kode:'5-003', nama:'Beban Listrik & Air',        tipe:'beban',      posisi_normal:'D' },
  { kode:'5-004', nama:'Beban Penyusutan',           tipe:'beban',      posisi_normal:'D' },
  { kode:'5-005', nama:'Beban Rapat',                tipe:'beban',      posisi_normal:'D' },
  { kode:'5-006', nama:'Beban Lain-lain',            tipe:'beban',      posisi_normal:'D' },
];

async function seed() {
  try {
    await connectDB();
    await sequelize.sync({ force: false });

    // 1. Tenant
    const [tenant] = await Tenant.findOrCreate({
      where: { id: TENANT_ID },
      defaults: {
        id: TENANT_ID, nama: 'Koperasi Desa Maju Bersama',
        kode: 'KOP-001', alamat: 'Desa Maju, Kec. Sejahtera',
        no_badan_hukum: '001/BH/KOP/2025', aktif: true,
      },
    });
    console.log('✅ Tenant:', tenant.nama);

    // 2. Admin user
    const [admin] = await User.findOrCreate({
      where: { email: 'admin@gmail.com' },
      defaults: {
        id: uuidv4(), tenant_id: TENANT_ID,
        nama: 'Administrator',
        email: 'admin@gmail.com',
        password: await bcrypt.hash('admin123', 12),
        role: 'admin', aktif: true,
      },
    });
    console.log('✅ Admin:', admin.email, '/ password: admin123');

    // 3. Chart of Accounts
    for (const rek of CoA) {
      await Rekening.findOrCreate({
        where: { tenant_id: TENANT_ID, kode: rek.kode },
        defaults: { id: uuidv4(), tenant_id: TENANT_ID, ...rek, aktif: true },
      });
    }
    console.log(`✅ Chart of Accounts: ${CoA.length} rekening seeded`);

    // 4. Jenis Simpanan
    const jenisSimpanan = [
      { nama:'Simpanan Pokok', kode:'SP', wajib:true, nominal_tetap:100000 },
      { nama:'Simpanan Wajib', kode:'SW', wajib:true, nominal_tetap:20000 },
      { nama:'Simpanan Sukarela', kode:'SS', wajib:false, nominal_tetap:null },
    ];
    for (const j of jenisSimpanan) {
      await SimpananJenis.findOrCreate({
        where: { tenant_id: TENANT_ID, kode: j.kode },
        defaults: { id: uuidv4(), tenant_id: TENANT_ID, ...j },
      });
    }
    console.log('✅ Jenis Simpanan seeded');
    console.log('\n🎉 Seed selesai! Jalankan: npm start\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed error:', err.message);
    process.exit(1);
  }
}

const { connectDB } = require('../src/config/database');
seed();
