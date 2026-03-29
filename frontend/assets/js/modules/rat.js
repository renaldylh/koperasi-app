document.addEventListener('alpine:init', () => {
  Alpine.data('ratModule', () => ({
    tahun: new Date().getFullYear(),
    loadingCalc: false,
    loadingClose: false,
    
    // Result State
    shuResult: null,
    distribusi: [],

    async init() {
       // Cek apakah untuk tahun berjalan sudah ada hitungan (draft/final)
       await this.checkExistingCalculation();
    },

    async checkExistingCalculation() {
      try {
        const res = await api.get('/shu/check', { params: { tahun: this.tahun } });
        if (res.data && res.data.id) {
           await this.loadDetailSHU(res.data.id);
        } else {
           this.shuResult = null;
           this.distribusi = [];
        }
      } catch(err) { /* silent fail if route check doesn't exist */ }
    },

    async loadDetailSHU(periodeId) {
       try {
          const detailRes = await api.shu.detail(periodeId);
          this.shuResult = detailRes.data.periode;
          this.distribusi = detailRes.data.distribusi;
       } catch (err) { Toast.error(err.message); }
    },

    async hitungSHU() {
      if(!confirm(`Mulai analisis omzet dan aset tahun ${this.tahun}? Proses kalkulasi bisa membutuhkan waktu bergantung jumlah data.`)) return;
      this.loadingCalc = true;
      try {
        const payload = {
           tahun: this.tahun,
           persentase_jasa_modal: 30, // default MVP config (bisa ditarik dari settings)
           persentase_jasa_usaha: 40,
           persentase_dana_cadangan: 20,
           persentase_dana_sosial: 10
        };
        const res = await api.shu.hitung(payload);
        Toast.success('Kalkulasi Selesai!');
        await this.loadDetailSHU(res.data.id); // load hasil hitungan baru
      } catch (err) {
        Toast.error('Gagal hitung SHU: ' + err.message);
      } finally {
        this.loadingCalc = false;
      }
    },

    async tutupBuku() {
      if(!this.shuResult) return;
      if(!confirm('PERINGATAN: Tutup Buku akan menjurnal seluruh beban & pendapatan tahun ini (Closing Entry) dan mengunci periode. Aksi ini tidak bisa dibatalkan! Lanjutkan?')) return;
      
      this.loadingClose = true;
      try {
         await api.shu.closing(this.shuResult.id);
         Toast.success('TUTUP BUKU BERHASIL. Jurnal penutup (Closing Entry) telah di-posting ke Buku Besar SAK EP. 🏆');
         await this.loadDetailSHU(this.shuResult.id); // load status final
      } catch (err) {
         Toast.error('Gagal closing: ' + err.message);
      } finally {
         this.loadingClose = false;
      }
    }
  }));
});
