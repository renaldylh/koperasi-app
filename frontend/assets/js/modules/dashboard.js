document.addEventListener('alpine:init', () => {
  Alpine.data('dashboardModule', () => ({
    loading: true,
    tahun: new Date().getFullYear(),
    stats: {
      total_anggota: 0,
      total_simpanan: 0,
      total_pinjaman: 0,
      total_piutang: 0,
      shu_berjalan: 0,
      pinjaman_macet: 0,
    },

    async init() {
      await this.loadData();
    },

    async loadData() {
      this.loading = true;
      try {
        const res = await api.dashboard();
        if (res.success) {
          this.stats = res.data;
        }
      } catch (err) {
        Toast.error('Gagal memuat data dashboard: ' + err.message);
      } finally {
        this.loading = false;
      }
    }
  }));
});
