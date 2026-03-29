document.addEventListener('alpine:init', () => {
  Alpine.data('asetModule', () => ({
    asetList: [],
    loading: false,
    search: '',
    meta: { page: 1, limit: 15, total: 0 },
    
    // Modal state
    showModal: false,
    submitLoading: false,
    
    // Form data
    form: {
      kode: '',
      nama: '',
      kategori: 'Kendaraan',
      tanggal_perolehan: '',
      harga_perolehan: 0,
      umur_ekonomis: 60, // 5 tahun
      nilai_sisa: 0,
      metode_penyusutan: 'garis_lurus',
      beban_rekening_id: '',
      akumulasi_rekening_id: ''
    },

    rekeningBeban: [],
    rekeningAkumulasi: [],

    init() {
      this.loadData();
      this.loadRekening();
    },

    async loadData(page = 1) {
      this.meta.page = page;
      this.loading = true;
      try {
        const res = await api.aset.list({ page: this.meta.page, limit: this.meta.limit });
        this.asetList = res.data;
        this.meta.total = res.meta.total;
        this.meta.totalPages = Math.ceil(res.meta.total / res.meta.limit);
      } catch (err) {
        Toast.error(err.message);
      } finally {
        this.loading = false;
      }
    },

    async loadRekening() {
      try {
        const res = await api.akuntansi.rekening();
        // Beban Penyusutan (Tipe Beban)
        this.rekeningBeban = res.data.filter(r => r.tipe === 'beban');
        // Akumulasi Penyusutan (Tipe Aset, Posisi Normal K)
        this.rekeningAkumulasi = res.data.filter(r => r.tipe === 'aset' && r.posisi_normal === 'K');
      } catch (err) {}
    },

    openModal() {
      this.form = {
        kode: `AST-${new Date().getTime()}`,
        nama: '',
        kategori: 'Kendaraan',
        tanggal_perolehan: new Date().toISOString().slice(0, 10),
        harga_perolehan: 0,
        umur_ekonomis: 60,
        nilai_sisa: 0,
        metode_penyusutan: 'garis_lurus',
        beban_rekening_id: this.rekeningBeban.length ? this.rekeningBeban[0].id : '',
        akumulasi_rekening_id: this.rekeningAkumulasi.length ? this.rekeningAkumulasi[0].id : ''
      };
      this.showModal = true;
    },

    async submitForm() {
      this.submitLoading = true;
      try {
        await api.aset.create({
          ...this.form,
          harga_perolehan: parseFloat(this.form.harga_perolehan),
          umur_ekonomis: parseInt(this.form.umur_ekonomis),
          nilai_sisa: parseFloat(this.form.nilai_sisa)
        });
        Toast.success('Aset Tetap berhasil didaftarkan');
        this.showModal = false;
        this.loadData(1);
      } catch (err) {
        Toast.error(err.message);
      } finally {
        this.submitLoading = false;
      }
    },

    async triggerPenyusutanManual() {
      if(!confirm('Anda yakin ingin memicu penyusutan bulan ini secara manual? Pastikan belum dilakukan.')) return;
      this.loading = true;
      try {
        const tgl = new Date().toISOString().slice(0, 10);
        const res = await api.aset.penyusutan({ tanggal: tgl });
        Toast.success(res.message);
        this.loadData(1);
      } catch (err) {
        Toast.error(err.message);
      } finally {
        this.loading = false;
      }
    }

  }));
});
