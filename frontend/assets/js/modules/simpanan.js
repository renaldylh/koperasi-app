document.addEventListener('alpine:init', () => {
  Alpine.data('simpananModule', () => ({
    loading: false,
    rekap: [],
    search: '',
    
    // Anggota Detail State
    selectedAnggota: null,
    loadingTx: false,
    saldoDetail: [],
    riwayatTx: [],

    // Transaction Modal State
    showModal: false,
    txTipe: 'setoran', // setoran | penarikan
    saving: false,
    form: { simpanan_id: '', nominal: '', keterangan: '', tanggal: '' },

    // Excel Mode State
    excelMode: false,
    excelRows: [],

    async init() {
      await this.loadData();
      
      // Auto open detail if id in URL
      const urlParams = new URLSearchParams(window.location.search);
      const openId = urlParams.get('id');
      if (openId) {
        // Find dummy info then load real detail
        const tgt = this.rekap.find(r => r.anggota_id === openId);
        if (tgt) this.loadDetail(tgt);
      }
    },

    async loadData() {
      this.loading = true;
      try {
        const res = await api.simpanan.rekap();
        // Simple client-side search since rekap might not be paginated
        this.rekap = res.data.filter(r => r.nama.toLowerCase().includes(this.search.toLowerCase()) || r.no_anggota.includes(this.search));
      } catch (err) {
        Toast.error(err.message);
      } finally {
        this.loading = false;
      }
    },

    async loadDetail(anggotaBase) {
      this.selectedAnggota = anggotaBase;
      this.loadingTx = true;
      try {
        const [saldoRes, txRes] = await Promise.all([
          api.simpanan.saldo(anggotaBase.anggota_id),
          api.simpanan.riwayat(anggotaBase.anggota_id, { limit: 50 })
        ]);
        this.saldoDetail = saldoRes.data;
        this.riwayatTx = txRes.data;
      } catch (err) {
        Toast.error(err.message);
      } finally {
        this.loadingTx = false;
      }
    },

    closeDetail() {
      this.selectedAnggota = null;
      window.history.replaceState({}, document.title, window.location.pathname);
    },

    openModal(tipe) {
      this.txTipe = tipe;
      this.form = { simpanan_id: '', nominal: '', keterangan: '', tanggal: new Date().toISOString().slice(0,10) };
      this.showModal = true;
    },

    async submitTx() {
      if (!this.form.simpanan_id || !this.form.nominal || this.form.nominal <= 0) return Toast.error('Pilih jenis simpanan dan pastikan nominal > 0');
      
      this.saving = true;
      try {
        if (this.txTipe === 'setoran') {
          await api.simpanan.setoran(this.form);
        } else {
          await api.simpanan.penarikan(this.form);
        }
        Toast.success(`Transaksi ${this.txTipe} berhasil beserta jurnal otomatis!`);
        this.showModal = false;
        await this.loadDetail(this.selectedAnggota); // Refresh detail
        await this.loadData(); // Refresh bg rekap
      } catch (err) {
        Toast.error(err.message);
      } finally {
        this.saving = false;
      }
    },

    async sendWABilling(tipe, item) {
       // tipe: 'wajib' | 'pokok'
       const template = tipe === 'wajib' ? appInstance.settings.template_wa_iuran_wajib : appInstance.settings.template_wa_iuran_pokok;
       if (!template) return Toast.error('Template WA belum dikonfigurasi!');
       
       const nominal = tipe === 'wajib' ? appInstance.settings.iuran_wajib_bulanan : (item.pokok_target || 0);
       const tgl = new Date();
       const bulan = tgl.toLocaleString('id-ID', { month: 'long', year: 'numeric' });

       let msg = template
          .replace(/\{\{nama\}\}/g, item.nama)
          .replace(/\{nama\}/g, item.nama)
          .replace(/\{\{nominal\}\}/g, formatRp(nominal))
          .replace(/\{nominal\}/g, formatRp(nominal))
          .replace(/\{\{bulan\}\}/g, bulan)
          .replace(/\{bulan\}/g, bulan);

       if (!confirm(`Kirim tagihan WA ke ${item.nama}?\n\n"${msg}"`)) return;

       try {
          await api.settings.sendWA({
             phone: item.no_wa || item.telepon,
             message: msg
          });
          Toast.success('Tagihan WA berhasil dikirim.');
       } catch (err) {
          Toast.error('Gagal mengirim WA: ' + err.message);
       }
    },

    toggleExcelMode() {
        this.excelMode = !this.excelMode;
        if (this.excelMode && this.excelRows.length === 0) {
            for(let i=0; i<15; i++) this.addExcelRow();
        }
    },

    addExcelRow() {
        this.excelRows.push({ no_anggota: '', jenis: 'wajib', nominal: 0, keterangan: '', _nominal_formula: '' });
    },

    evaluateCell(row, field, val) {
        if (String(val).startsWith('=')) {
            row[`_${field}_formula`] = val;
            const result = ExcelCore.evaluate(val, this.excelRows, ['no_anggota','jenis','keterangan','nominal']);
            row[field] = result;
        } else {
            row[`_${field}_formula`] = '';
            row[field] = Number(val) || 0;
        }
    },

    handlePaste(e, index) {
        const text = (e.clipboardData || window.clipboardData).getData('text');
        const rows = ExcelCore.parseTSV(text);
        
        rows.forEach((cells, i) => {
            const targetIdx = index + i;
            if (this.excelRows[targetIdx]) {
                this.excelRows[targetIdx].no_anggota = cells[0] || '';
                this.excelRows[targetIdx].jenis = cells[1] || 'wajib';
                this.excelRows[targetIdx].keterangan = cells[2] || '';
                this.excelRows[targetIdx].nominal = cells[3] || '';
            } else if (cells.length > 0) {
                this.excelRows.push({
                    no_anggota: cells[0] || '',
                    jenis: cells[1] || 'wajib',
                    keterangan: cells[2] || '',
                    nominal: cells[3] || ''
                });
            }
        });
        e.preventDefault();
    },

    async saveBulk() {
        const payload = this.excelRows.filter(r => r.no_anggota && r.nominal);
        if (payload.length === 0) return Toast.error('Tidak ada data valid untuk disimpan.');

        this.saving = true;
        try {
            const res = await api.simpanan.setoranBulk({ rows: payload });
            Toast.success(res.message);
            this.excelMode = false;
            this.excelRows = [];
            await this.loadData();
        } catch (err) {
            Toast.error(err.message);
        } finally {
            this.saving = false;
        }
    }
  }));
});
