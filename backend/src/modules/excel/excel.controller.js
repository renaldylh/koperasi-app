// ============================================================
// EXCEL EXPORT — ExcelJS Multi-Sheet SAK EP
// ============================================================
const ExcelJS = require('exceljs');
const { logAudit } = require('../../middleware/auditLog');
const { neraca, labaRugi } = require('../laporan/laporan.controller');
const { hitungSHU } = require('../../utils/shuCalculator');
const { sequelize, Anggota } = require('../../models');
const { v4: uuidv4 } = require('uuid');

const COLORS = {
  header:    '1E3A5F',
  subHeader: '2E6DA4',
  row1:      'EBF5FF',
  row2:      'FFFFFF',
  accent:    '27AE60',
};

function styleHeader(ws, row, cols, color = COLORS.header) {
  cols.forEach(c => {
    const cell = ws.getCell(`${c}${row}`);
    cell.fill = { type:'pattern', pattern:'solid', fgColor:{ argb: color } };
    cell.font = { bold:true, color:{ argb:'FFFFFF' }, size:11 };
    cell.alignment = { horizontal:'center', vertical:'middle' };
    cell.border = { bottom:{ style:'thin' } };
  });
}

function currency(n) { return parseFloat(n || 0).toLocaleString('id-ID'); }

/** GET /api/laporan/export-excel */
async function exportRAT(req, res) {
  const tahun = parseInt(req.query.tahun) || new Date().getFullYear();
  const tenantId = req.user.tenantId;

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Ukoperasi';
  wb.created = new Date();
  wb.properties.date1904 = false;

  // ── Sheet 1: NERACA ──────────────────────────────────────
  const wsN = wb.addWorksheet('Neraca');
  wsN.columns = [
    { header: '', key: 'kode', width: 12 },
    { header: '', key: 'nama', width: 40 },
    { header: '', key: 'saldo', width: 25 },
  ];
  wsN.mergeCells('A1:C1');
  wsN.getCell('A1').value = `NERACA — ${tahun}`;
  wsN.getCell('A1').font = { bold:true, size:14, color:{ argb: COLORS.header } };
  wsN.getCell('A1').alignment = { horizontal:'center' };

  const neracaData = await sequelize.query(`
    SELECT r.kode, r.nama, r.tipe, r.posisi_normal,
      COALESCE(SUM(CASE WHEN jd.posisi='D' THEN jd.nominal ELSE 0 END),0) AS d,
      COALESCE(SUM(CASE WHEN jd.posisi='K' THEN jd.nominal ELSE 0 END),0) AS k
    FROM rekening r
    LEFT JOIN jurnal_detail jd ON r.id = jd.rekening_id
    LEFT JOIN jurnal_header jh ON jd.jurnal_header_id = jh.id
      AND jh.tenant_id='${tenantId}' AND YEAR(jh.tanggal)=${tahun}
    WHERE r.tenant_id='${tenantId}' AND r.aktif=1
    GROUP BY r.id ORDER BY r.kode
  `, { type: sequelize.QueryTypes.SELECT });

  const calcSaldo = (r) => r.posisi_normal === 'D' ? parseFloat(r.d)-parseFloat(r.k) : parseFloat(r.k)-parseFloat(r.d);

  let row = 3;
  ['aset','kewajiban','ekuitas'].forEach(tipe => {
    const label = tipe.charAt(0).toUpperCase() + tipe.slice(1);
    wsN.mergeCells(`A${row}:C${row}`);
    wsN.getCell(`A${row}`).value = label.toUpperCase();
    styleHeader(wsN, row, ['A'], COLORS.subHeader);
    row++;
    const items = neracaData.filter(r => r.tipe === tipe);
    let subtotal = 0;
    items.forEach(item => {
      const saldo = calcSaldo(item);
      subtotal += saldo;
      wsN.addRow([item.kode, item.nama, currency(saldo)]);
      row++;
    });
    wsN.addRow(['', `Total ${label}`, currency(subtotal)]);
    wsN.getRow(row).font = { bold:true };
    row++;
  });

  // ── Sheet 2: LABA RUGI (SHU) ─────────────────────────────
  const wsLR = wb.addWorksheet('Laba Rugi (SHU)');
  wsLR.columns = [{ key:'kode', width:12 }, { key:'nama', width:40 }, { key:'nominal', width:25 }];
  wsLR.mergeCells('A1:C1');
  wsLR.getCell('A1').value = `LAPORAN LABA RUGI (SHU) — ${tahun}`;
  wsLR.getCell('A1').font = { bold:true, size:14 };
  wsLR.getCell('A1').alignment = { horizontal:'center' };

  const lrData = await sequelize.query(`
    SELECT r.kode, r.nama, r.tipe, r.posisi_normal,
      COALESCE(SUM(CASE WHEN jd.posisi='D' THEN jd.nominal ELSE 0 END),0) AS d,
      COALESCE(SUM(CASE WHEN jd.posisi='K' THEN jd.nominal ELSE 0 END),0) AS k
    FROM rekening r
    LEFT JOIN jurnal_detail jd ON r.id = jd.rekening_id
    LEFT JOIN jurnal_header jh ON jd.jurnal_header_id = jh.id
      AND jh.tenant_id='${tenantId}' AND YEAR(jh.tanggal)=${tahun}
    WHERE r.tenant_id='${tenantId}' AND r.tipe IN ('pendapatan','beban') AND r.aktif=1
    GROUP BY r.id ORDER BY r.kode
  `, { type: sequelize.QueryTypes.SELECT });

  let r2 = 3;
  let totalP = 0, totalB = 0;
  ['pendapatan','beban'].forEach(tipe => {
    wsLR.mergeCells(`A${r2}:C${r2}`);
    wsLR.getCell(`A${r2}`).value = tipe.toUpperCase();
    styleHeader(wsLR, r2, ['A'], COLORS.subHeader);
    r2++;
    lrData.filter(x=>x.tipe===tipe).forEach(item => {
      const saldo = tipe==='pendapatan' ? parseFloat(item.k)-parseFloat(item.d) : parseFloat(item.d)-parseFloat(item.k);
      if (tipe==='pendapatan') totalP += saldo; else totalB += saldo;
      wsLR.addRow([item.kode, item.nama, currency(saldo)]);
      r2++;
    });
  });
  wsLR.addRow(['','','']);
  wsLR.addRow(['','SHU (Sisa Hasil Usaha)', currency(totalP - totalB)]);
  wsLR.lastRow.font = { bold:true, size:12, color:{ argb: COLORS.accent } };

  // ── Sheet 3: DISTRIBUSI SHU ──────────────────────────────
  const wsSHU = wb.addWorksheet('Distribusi SHU');
  wsSHU.columns = [
    { header:'No. Anggota', key:'no_anggota', width:15 },
    { header:'Nama', key:'nama', width:30 },
    { header:'Total Simpanan', key:'simpanan', width:20 },
    { header:'Total Transaksi', key:'transaksi', width:20 },
    { header:'Jasa Modal', key:'modal', width:18 },
    { header:'Jasa Usaha', key:'usaha', width:18 },
    { header:'Total SHU Diterima', key:'total', width:22 },
  ];
  styleHeader(wsSHU, 1, ['A','B','C','D','E','F','G']);

  const shuResult = await hitungSHU(tenantId, tahun);
  shuResult.distribusi.forEach(d => {
    wsSHU.addRow([d.no_anggota, d.nama, currency(d.total_simpanan), currency(d.total_transaksi), currency(d.jasa_modal), currency(d.jasa_usaha), currency(d.total_shu_diterima)]);
  });
  // Total row
  const td = shuResult.distribusi;
  wsSHU.addRow(['','TOTAL','','',
    currency(td.reduce((s,d)=>s+d.jasa_modal,0)),
    currency(td.reduce((s,d)=>s+d.jasa_usaha,0)),
    currency(td.reduce((s,d)=>s+d.total_shu_diterima,0)),
  ]);
  wsSHU.lastRow.font = { bold:true };

  // ── Sheet 4: JURNAL / BUKU BESAR ─────────────────────────
  const wsBB = wb.addWorksheet('Buku Besar');
  wsBB.columns = [
    { header:'Tanggal', key:'tanggal', width:14 },
    { header:'No Jurnal', key:'no_jurnal', width:20 },
    { header:'Keterangan', key:'ket', width:40 },
    { header:'Rekening', key:'rek', width:30 },
    { header:'D/K', key:'posisi', width:8 },
    { header:'Nominal', key:'nominal', width:20 },
  ];
  styleHeader(wsBB, 1, ['A','B','C','D','E','F']);
  const jurnal = await sequelize.query(`
    SELECT jh.tanggal, jh.no_jurnal, jh.keterangan, r.nama AS rekening, jd.posisi,
      FORMAT(jd.nominal, 0) AS nominal
    FROM jurnal_header jh
    JOIN jurnal_detail jd ON jh.id = jd.jurnal_header_id
    JOIN rekening r ON jd.rekening_id = r.id
    WHERE jh.tenant_id='${tenantId}' AND YEAR(jh.tanggal)=${tahun}
    ORDER BY jh.tanggal, jh.created_at, jd.posisi DESC
  `, { type: sequelize.QueryTypes.SELECT });
  jurnal.forEach(j => wsBB.addRow([j.tanggal, j.no_jurnal, j.keterangan, j.rekening, j.posisi, j.nominal]));

  // ── SEND RESPONSE ─────────────────────────────────────────
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=RAT_Ukoperasi_${tahun}.xlsx`);
  await wb.xlsx.write(res);
  res.end();
}

/** POST /api/excel/import/anggota */
async function importAnggota(req, res) {
  if (!req.file) throw new Error('File excel wajib diupload.');

  const tenantId = req.user.tenantId;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(req.file.buffer);

  const ws = wb.worksheets[0]; // Ambil sheet pertama
  if (!ws) throw new Error('Format file Excel tidak valid (sheet kosong).');

  const list = [];
  // Asumsi header di row 1: No Anggota | NIK | Nama | Tanggal Lahir | Telepon | Alamat | Tanggal Masuk
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // Skip header

    const no_anggota = row.getCell(1).text?.trim();
    const nik = row.getCell(2).text?.trim();
    const nama = row.getCell(3).text?.trim();
    
    // Skip baris kosong
    if (!no_anggota || !nama) return;

    let tanggal_lahir = row.getCell(4).value;
    if (tanggal_lahir instanceof Date) { tanggal_lahir = tanggal_lahir.toISOString().split('T')[0]; }
    else { tanggal_lahir = null; }

    const telepon = row.getCell(5).text?.trim() || null;
    const alamat = row.getCell(6).text?.trim() || null;
    
    let tanggal_masuk = row.getCell(7).value;
    if (tanggal_masuk instanceof Date) { tanggal_masuk = tanggal_masuk.toISOString().split('T')[0]; }
    else { tanggal_masuk = new Date().toISOString().split('T')[0]; } // Default hari ini jika kosong

    list.push({
      id: uuidv4(),
      tenant_id: tenantId,
      no_anggota,
      nik: nik || '-',
      nama,
      tanggal_lahir,
      telepon,
      alamat,
      tanggal_masuk,
      status: 'aktif'
    });
  });

  if (list.length === 0) throw new Error('Tidak ada data anggota valid yang dapat diimpor.');

  // Ignore duplicates based on no_anggota
  await Anggota.bulkCreate(list, { ignoreDuplicates: true });
  
  await logAudit({ userId: req.user.id, tenantId, aksi: 'CREATE', tabel: 'anggota', recordId: null, dataBaru: { action: 'bulk_import_excel', count: list.length }, req });
  res.json({ success: true, message: `Berhasil memproses ${list.length} baris data anggota riil.` });
}

module.exports = { exportRAT, importAnggota };
