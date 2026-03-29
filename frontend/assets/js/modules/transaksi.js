document.addEventListener('alpine:init', () => {
  Alpine.data('transaksiModule', () => ({
    loading: false,
    transaksi: [],
    search: '',
    meta: { page: 1, limit: 15, total: 0, totalPages: 1 },
    
    // Modal State
    showModal: false,
    showPettyCashModal: false,
    txTipe: 'pengeluaran',
    saving: false,
    form: { rekening_id: '', nominal: '', tanggal: '', keterangan: '' },
    
    pettyCashCategories: [
       { name: 'Listrik & Air', rekId: '6-001', icon: 'ri-flashlight-line' },
       { name: 'Alat Tulis Kantor', rekId: '6-002', icon: 'ri-pencil-ruler-line' },
       { name: 'Konsumsi Rapat', rekId: '6-003', icon: 'ri-restaurant-line' },
       { name: 'Transportasi', rekId: '6-004', icon: 'ri-car-line' },
       { name: 'Kebersihan', rekId: '6-005', icon: 'ri-brush-line' }
    ],
    
    // Kasir EOD State
    sesiKasir: null,
    showKasirModal: false,
    kasirForm: { nominal: 0 },
    
    // Select ref
    refSemuaRekening: [],
    refRekening: [], 

    async init() {
      // Must be admin or pengurus (handled by app.js RBAC technically, but we protect via API)
      await this.checkSesi();
      await this.loadData();
      this.loadRekening();
    },

    async checkSesi() {
      try {
         const res = await api.get('/transaksi/kasir/sesi');
         this.sesiKasir = res.data;
      } catch (err) {}
    },

    async loadRekening() {
      try {
        const res = await api.akuntansi.rekening();
        this.refSemuaRekening = res.data || [];
      } catch (err) {}
    },

    async loadData(page = 1) {
      if (page < 1 || (this.meta.totalPages > 0 && page > this.meta.totalPages)) return;
      this.loading = true;
      try {
        const res = await api.get(`/transaksi`, { params: { page, limit: this.meta.limit, search: this.search } });
        this.transaksi = res.data;
        this.meta = { ...res.meta, totalPages: Math.ceil(res.meta.total / res.meta.limit) };
      } catch (err) {
        Toast.error(err.message);
      } finally {
        this.loading = false;
      }
    },

    openModal(tipe) {
      this.txTipe = tipe;
      // Filter rekening options based on type
      if (tipe === 'pemasukan') {
         this.refRekening = this.refSemuaRekening.filter(r => r.tipe === 'pendapatan' && r.kode !== '4-001'); // kec. bunga pinjaman krn auto
      } else {
         this.refRekening = this.refSemuaRekening.filter(r => r.tipe === 'beban');
      }
      this.form = { rekening_id: '', nominal: '', tanggal: new Date().toISOString().slice(0,10), keterangan: '' };
      this.showModal = true;
    },

    async submitForm() {
      this.saving = true;
      try {
        const endpoint = this.txTipe === 'pemasukan' ? '/transaksi/pemasukan' : '/transaksi/pengeluaran';
        await api.post(endpoint, this.form);
        Toast.success(`Transaksi ${this.txTipe} berhasil dicatat & masuk buku besar.`);
        this.showModal = false;
        this.loadData(1);
      } catch (err) {
        Toast.error(err.message);
      } finally {
        this.saving = false;
      }
    },

    openKasirModal() {
       this.kasirForm = { nominal: '' };
       this.showKasirModal = true;
    },

    async submitKasir() {
       this.saving = true;
       try {
          if (this.sesiKasir) {
             await api.post('/transaksi/kasir/tutup', { saldo_akhir_fisik: this.kasirForm.nominal });
             Toast.success('Shift kasir berhasil DITUTUP.');
          } else {
             await api.post('/transaksi/kasir/buka', { saldo_awal_fisik: this.kasirForm.nominal });
             Toast.success('Shift kasir berhasil DIBUKA. Selamat bekerja!');
          }
          this.showKasirModal = false;
          await this.checkSesi();
       } catch(err) {
          Toast.error(err.message);
       } finally {
          this.saving = false;
       }
    },

    openPettyCash() {
       this.txTipe = 'pengeluaran';
       this.form = { rekening_id: '', nominal: '', tanggal: new Date().toISOString().slice(0,10), keterangan: '' };
       this.showPettyCashModal = true;
    },

    selectPettyCash(cat) {
       this.form.rekening_id = this.refSemuaRekening.find(r => r.kode === cat.rekId)?.id || '';
       this.form.keterangan = cat.name;
    },

    whatsappReceipt(t) {
       const text = `*STRUK DIGITAL UKOPERASI*%0A%0A` +
                    `No. Ref: ${t.id.slice(0,8)}%0A` +
                    `Tanggal: ${formatDate(t.tanggal)}%0A` +
                    `Jenis: ${t.jenis.toUpperCase()}%0A` +
                    `Keterangan: ${t.keterangan}%0A` +
                    `----------------------------%0A` +
                    `*TOTAL: ${formatRp(t.nominal)}*%0A%0A` +
                    `_Terima kasih telah bertransaksi di Koperasi kami._`;
       
       window.open(`https://wa.me/?text=${text}`, '_blank');
    }
  }));
});
