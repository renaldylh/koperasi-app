require('dotenv').config();
const { v4: uuidv4 } = require('uuid');
const { sequelize, Setting } = require('../src/models');
const { connectDB } = require('../src/config/database');

const TENANT_ID = '00000000-0000-0000-0000-000000000001';

const MEGA_SETTINGS = [
  // A. Business Rules & Financial
  { key: 'iuran_pokok_nominal', value: '100000', group: 'keuangan', type: 'number', description: 'Besar iuran pokok anggota baru' },
  { key: 'iuran_wajib_nominal', value: '20000', group: 'keuangan', type: 'number', description: 'Besar iuran wajib bulanan' },
  { key: 'biaya_admin_pendaftaran', value: '50000', group: 'keuangan', type: 'number', description: 'Biaya pendaftaran anggota' },
  { key: 'bunga_pinjaman_default', value: '1.5', group: 'keuangan', type: 'number', description: 'Bunga pinjaman default (%)' },
  { key: 'denda_telat_persen', value: '0.1', group: 'keuangan', type: 'number', description: 'Denda keterlambatan (%) per hari' },
  { key: 'min_simpanan_awal', value: '50000', group: 'keuangan', type: 'number', description: 'Minimal simpanan awal' },
  { key: 'min_saldo_mengendap', value: '20000', group: 'keuangan', type: 'number', description: 'Saldo minimal mengendap' },
  { key: 'pajak_shu_persen', value: '10', group: 'keuangan', type: 'number', description: 'Pajak SHU (%)' },
  { key: 'pinjaman_max_plafond', value: '50000000', group: 'keuangan', type: 'number', description: 'Limit maksimal pinjaman' },
  { key: 'pinjaman_max_tenor', value: '36', group: 'keuangan', type: 'number', description: 'Tenor maksimal (bulan)' },
  { key: 'provisi_pinjaman_persen', value: '1', group: 'keuangan', type: 'number', description: 'Biaya provisi (%)' },
  { key: 'asuransi_pinjaman_persen', value: '0.5', group: 'keuangan', type: 'number', description: 'Biaya asuransi (%)' },

  // B. Accounting & COA Mapping
  { key: 'coa_kas_utama', value: '1-001', group: 'akuntansi', type: 'string', description: 'Kode akun Kas Utama' },
  { key: 'coa_bank_utama', value: '1-002', group: 'akuntansi', type: 'string', description: 'Kode akun Bank Utama' },
  { key: 'coa_piutang_anggota', value: '1-101', group: 'akuntansi', type: 'string', description: 'Kode akun Piutang Anggota' },
  { key: 'coa_pendapatan_bunga', value: '4-001', group: 'akuntansi', type: 'string', description: 'Kode akun Pendapatan Bunga' },
  { key: 'coa_beban_umum', value: '5-006', group: 'akuntansi', type: 'string', description: 'Kode akun Beban Lain-lain' },
  { key: 'coa_labarugi_ditahan', value: '3-002', group: 'akuntansi', type: 'string', description: 'Kode akun Laba Ditahan' },
  { key: 'enable_auto_jurnal', value: 'true', group: 'akuntansi', type: 'boolean', description: 'Toggle penjurnalan otomatis' },
  { key: 'fiscal_year_start', value: '1', group: 'akuntansi', type: 'number', description: 'Bulan awal tahun buku' },

  // C. Institusi & Compliance
  { key: 'nama_ketua', value: 'H. Ahmad Dahlan', group: 'institusi', type: 'string', description: 'Nama Ketua Koperasi' },
  { key: 'nama_bendahara', value: 'Siti Aminah', group: 'institusi', type: 'string', description: 'Nama Bendahara' },
  { key: 'nama_sekretaris', value: 'Budi Santoso', group: 'institusi', type: 'string', description: 'Nama Sekretaris' },
  { key: 'kota_pelaporan', value: 'Jakarta Pusat', group: 'institusi', type: 'string', description: 'Lokasi penandatanganan' },
  { key: 'teks_syarat_ketentuan', value: 'Semua anggota wajib mematuhi AD/ART Koperasi.', group: 'institusi', type: 'string', description: 'Syarat & Ketentuan' },
  { key: 'currency_symbol', value: 'Rp', group: 'institusi', type: 'string', description: 'Simbol Mata Uang' },
  { key: 'decimal_places', value: '0', group: 'institusi', type: 'number', description: 'Jumlah desimal' },
  { key: 'timezone_default', value: 'Asia/Jakarta', group: 'institusi', type: 'string', description: 'Timezone Sistem' },

  // D. Keamanan & System
  { key: 'max_login_attempts', value: '5', group: 'keamanan', type: 'number', description: 'Batas salah password' },
  { key: 'session_timeout_min', value: '60', group: 'keamanan', type: 'number', description: 'Durasi sesi (menit)' },
  { key: 'min_password_length', value: '8', group: 'keamanan', type: 'number', description: 'Panjang minimal password' },
  { key: 'maintenance_mode', value: 'false', group: 'keamanan', type: 'boolean', description: 'Mode Pemeliharaan' },
  { key: 'allow_self_register', value: 'true', group: 'keamanan', type: 'boolean', description: 'Izinkan Daftar Mandiri' },
  { key: 'audit_log_retention', value: '90', group: 'keamanan', type: 'number', description: 'Retensi Audit Log (hari)' },
  { key: 'debug_mode', value: 'false', group: 'keamanan', type: 'boolean', description: 'Mode Debug Sistem' },

  // E. Visual & Notifikasi
  { key: 'dashboard_welcome_msg', value: 'Selamat Datang di Portal Ukoperasi!', group: 'visual', type: 'string', description: 'Pesan Dashboard' },
  { key: 'dashboard_subtitle_msg', value: 'Pembaruan data keuangan koperasi secara real-time.', group: 'visual', type: 'string', description: 'Sub-pesan Dashboard' },
  { key: 'primary_font_family', value: 'Inter', group: 'visual', type: 'string', description: 'Font Utama Sistem' },
  { key: 'primary_hover_color', value: '#1d4ed8', group: 'visual', type: 'string', description: 'Warna Hover Button' },
  { key: 'button_radius', value: '12px', group: 'visual', type: 'string', description: 'Sudut Lengkung Tombol' },
  { key: 'card_radius', value: '16px', group: 'visual', type: 'string', description: 'Sudut Lengkung Kontainer' },
  { key: 'sidebar_width_px', value: '260', group: 'visual', type: 'number', description: 'Lebar Sidebar (px)' },
  { key: 'table_density', value: 'normal', group: 'visual', type: 'string', description: 'Kepadatan Tabel (compact/normal)' },
  { key: 'enable_glassmorphism', value: 'true', group: 'visual', type: 'boolean', description: 'Efek Glassmorphism' },
  { key: 'wa_gateway_url', value: 'https://api.whatsapp.com/send', group: 'visual', type: 'string', description: 'URL WA Gateway' },
  { key: 'wa_gateway_key', value: 'SECRET-KEY-123', group: 'visual', type: 'string', description: 'API Key WA' },
  { key: 'enable_auto_wa_billing', value: 'true', group: 'visual', type: 'boolean', description: 'Tagih WA Otomatis' },
  { key: 'billing_day_of_month', value: '25', group: 'visual', type: 'number', description: 'Tanggal Tagihan' },
  { key: 'sidebar_logo_subtext', value: 'Smart Management', group: 'visual', type: 'string', description: 'Sub-teks Logo' },
  { key: 'app_footer_text', value: '© 2026 Institutional Management System', group: 'visual', type: 'string', description: 'Teks Footer' },
  { key: 'enable_help_widget', value: 'true', group: 'visual', type: 'boolean', description: 'Tampilkan Bantuan' },

  // F. Localization & Format
  { key: 'date_format', value: 'DD/MM/YYYY', group: 'format', type: 'string', description: 'Format Tanggal' },
  { key: 'decimal_separator', value: ',', group: 'format', type: 'string', description: 'Pemisah Desimal' },
  { key: 'thousand_separator', value: '.', group: 'format', type: 'string', description: 'Pemisah Ribuan' },
  { key: 'report_header_text', value: 'LAPORAN KEUANGAN KOPERASI', group: 'format', type: 'string', description: 'Header Laporan PDF' },
];

async function seedMega() {
  try {
    await connectDB();
    console.log('🚀 Starting Mega Seeding...');

    for (const item of MEGA_SETTINGS) {
      await Setting.findOrCreate({
        where: { tenant_id: TENANT_ID, key: item.key },
        defaults: { id: uuidv4(), tenant_id: TENANT_ID, ...item }
      });
    }

    console.log(`✅ Success! ${MEGA_SETTINGS.length} mega settings seeded/verified.`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Mega Seed error:', err);
    process.exit(1);
  }
}

seedMega();
