document.addEventListener('alpine:init', () => {
  Alpine.data('laporanModule', () => ({
    tahun: new Date().getFullYear(),
    tab: 'neraca',
    
    // Neraca
    loadingNeraca: false,
    neraca: { aset: [], kewajiban: [], ekuitas: [], totalAset: 0, totalKewajiban: 0, totalEkuitas: 0, totalKewajibanEkuitas: 0 },
    
    // Laba Rugi
    loadingLR: false,
    labaRugi: { pendapatan: [], beban: [], totalPendapatan: 0, totalBeban: 0, shuBersih: 0 },

    // Arus Kas, Ekuitas, CALK
    arusKas: {},
    ekuitas: { items: [], total: 0 },
    calkText: [],

    async init() {
      // Auto switch tab if in URL query params
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('tab')) this.tab = urlParams.get('tab');

      await this.loadAll();
    },

    async loadAll() {
      this.loadNeraca();
      this.loadLabaRugi();
      this.loadArusKas();
      this.loadEkuitas();
      this.loadCalk();
    },

    async loadNeraca() {
      this.loadingNeraca = true;
      try {
        const res = await api.laporan.neraca({ tahun: this.tahun });
        this.neraca = res.data;
      } catch (err) { Toast.error('Gagal memuat neraca: '+err.message); }
      finally { this.loadingNeraca = false; }
    },

    async loadLabaRugi() {
      this.loadingLR = true;
      try {
        const res = await api.laporan.labaRugi({ tahun: this.tahun });
        this.labaRugi = res.data;
      } catch (err) { Toast.error('Gagal memuat SHU: '+err.message); }
      finally { this.loadingLR = false; }
    },

    async loadArusKas() {
      try {
        const res = await api.laporan.arusKas({ tahun: this.tahun });
        this.arusKas = res.data;
      } catch (err) { console.error('ArusKas', err); }
    },

    async loadEkuitas() {
      try {
        const res = await api.laporan.perubahanEkuitas({ tahun: this.tahun });
        this.ekuitas = { items: res.data.ekuitas, total: res.data.total_ekuitas_akhir };
      } catch (err) { console.error('Ekuitas', err); }
    },

    async loadCalk() {
      try {
        const res = await api.laporan.calk({ tahun: this.tahun });
        this.calkText = res.data.kebijakan_akuntansi;
      } catch (err) { console.error('Calk', err); }
    }
  }));
});
