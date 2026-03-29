document.addEventListener('alpine:init', () => {
  Alpine.data('akuntansiModule', () => ({
    tab: 'jurnal', // jurnal | buku_besar | coa
    
    // Referensi 
    rekening: [],

    // Jurnal State
    loadingJurnal: false,
    jurnal: [],
    filterBulan: new Date().toISOString().slice(0,7),
    searchJurnal: '',
    
    // Buku Besar State
    bbRekeningId: null,
    searchBB: '',
    filterBBulan: new Date().toISOString().slice(0,7),
    bbData: [],
    loadingBB: false,

    // Excel Mode State
    excelMode: false,
    excelRows: [],
    totalDebit: 0,
    totalKredit: 0,
    isBalanced: true,
    saving: false,

    async init() {
      // Auto switch tab if in URL query params
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('tab')) this.tab = urlParams.get('tab');

      await this.loadRekening();
      if(this.tab === 'jurnal') await this.loadJurnal();

      // Listen for global Paste (for Excel-Core experience)
      window.addEventListener('paste', (e) => {
         if (!this.excelMode) return;
         const data = e.clipboardData.getData('text');
         if (data) this.handleExcelPaste(data);
      });
    },

    toggleExcelMode() {
       this.excelMode = !this.excelMode;
       if (this.excelMode && this.excelRows.length === 0) {
          for(let i=0; i<15; i++) this.addExcelRow();
       }
    },

    addExcelRow() {
       this.excelRows.push({
          tanggal: new Date().toISOString().slice(0,10),
          keterangan: '',
          coa: '',
          posisi: 'D',
          debit: 0,
          kredit: 0,
          _debit_formula: '',
          _kredit_formula: ''
       });
       this.calculateExcel();
    },

    evaluateCell(row, field, val) {
       if (String(val).startsWith('=')) {
           row[`_${field}_formula`] = val;
           const result = ExcelCore.evaluate(val, this.excelRows, ['tanggal','keterangan','coa','posisi','debit','kredit']);
           row[field] = result;
       } else {
           row[`_${field}_formula`] = '';
           row[field] = Number(val) || 0;
       }
       this.calculateExcel();
    },

    removeExcelRow(i) {
       this.excelRows.splice(i, 1);
       this.calculateExcel();
    },

    calculateExcel() {
       this.totalDebit = this.excelRows.reduce((acc, row) => acc + (Number(row.debit) || 0), 0);
       this.totalKredit = this.excelRows.reduce((acc, row) => acc + (Number(row.kredit) || 0), 0);
       this.isBalanced = Math.abs(this.totalDebit - this.totalKredit) < 0.1 && (this.totalDebit > 0);
    },

    handleExcelPaste(clipboardText) {
       const rows = ExcelCore.parseTSV(clipboardText);
       rows.forEach(cells => {
          if (cells.length >= 2) {
             this.excelRows.push({
                tanggal: cells[0] || new Date().toISOString().slice(0,10),
                keterangan: cells[1] || '',
                coa: cells[2] || '',
                posisi: cells[3] || 'D',
                debit: Number(cells[4]) || 0,
                kredit: Number(cells[5]) || 0
             });
          }
       });
       this.calculateExcel();
       Toast.success('Data pasted successfully!');
    },

    importExcel(e) {
       const file = e.target.files[0];
       if (!file) return;
       const reader = new FileReader();
       reader.onload = (evt) => {
          const bstr = evt.target.result;
          const wb = XLSX.read(bstr, { type: 'binary' });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
          
          // Skip header, map rows
          data.slice(1).forEach(r => {
             if (r[1]) { // If keterangan exists
                this.excelRows.push({
                   tanggal: r[0] ? new Date((r[0] - (25567 + 1)) * 86400 * 1000).toISOString().slice(0,10) : new Date().toISOString().slice(0,10),
                   keterangan: r[1] || '',
                   coa: String(r[2] || ''),
                   posisi: r[3] || 'D',
                   debit: Number(r[4]) || 0,
                   kredit: Number(r[5]) || 0
                });
             }
          });
          this.calculateExcel();
          Toast.success('Impor Excel Selesai!');
       };
       reader.readAsBinaryString(file);
    },

    async saveExcel() {
       if (!this.isBalanced) return Toast.error('Jurnal belum seimbang (Debit != Kredit)');
       this.saving = true;
       try {
          // Filter rows with data
          const validRows = this.excelRows.filter(r => r.coa && (r.debit > 0 || r.kredit > 0));
          await api.akuntansi.bulkJurnal({ rows: validRows });
          Toast.success('Berhasil menyimpan jurnal massal!');
          this.excelRows = [];
          this.excelMode = false;
          await this.loadJurnal();
       } catch (err) {
          Toast.error('Gagal simpan: ' + err.message);
       } finally {
          this.saving = false;
       }
    },

    async loadRekening() {
      try {
        const res = await api.akuntansi.rekening();
        this.rekening = res.data;
      } catch (err) {}
    },

    async loadJurnal() {
      this.loadingJurnal = true;
      try {
        // [YYYY, MM]
        const [tahun, bulan] = this.filterBulan.split('-');
        const res = await api.akuntansi.jurnal({ tahun, bulan, search: this.searchJurnal, limit: 100 });
        this.jurnal = res.data;
      } catch (err) { Toast.error(err.message); }
      finally { this.loadingJurnal = false; }
    },

    async loadBukuBesar(rekeningId) {
      this.bbRekeningId = rekeningId;
      if (!this.bbRekeningId) return;
      this.loadingBB = true;
      try {
         const [tahun, bulan] = this.filterBBulan.split('-');
         const res = await api.akuntansi.bukuBesar(this.bbRekeningId, { tahun, bulan });
         this.bbData = res.data;
      } catch (err) { Toast.error('Gagal buku besar: '+err.message); }
      finally { this.loadingBB = false; }
    }
  }));
});
