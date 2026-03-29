document.addEventListener('alpine:init', () => {
  Alpine.data('pinjamanModule', () => ({
    loading: false,
    pinjaman: [],
    search: '',
    meta: { page: 1, limit: 15, total: 0, totalPages: 1 },
    viewMode: 'list', // 'list' or 'npl'

    // NPL Dashboard State
    nplSummary: [],
    nplList: [],
    loadingNPL: false,
    
    // Add form Reference
    refAnggota: [],

    // Detail Panel View
    showDetail: false,
    selectedPinjaman: null,
    loadingAngs: false,
    jadwalAngsuran: [],
    agunanList: [],
    
    // Form Modal

    showModal: false,
    saving: false,
    form: { anggota_id: '', pokok: null, jangka_waktu: 12, suku_bunga: 1.5, tujuan: '' },

    // Agunan Form
    showAgunanModal: false,
    formAgunan: { jenis: 'bpkb', nilai_taksiran: 0, deskripsi: '' },

    async init() {
      this.loadData();
      this.loadAnggotaRef();
    },

    async loadAnggotaRef() {
      try {
        const res = await api.anggota.list({ limit: 1000 }); // MVP load
        this.refAnggota = res.data;
      } catch (err) {}
    },

    async loadData(page = 1) {
      if (page < 1 || (this.meta.totalPages > 0 && page > this.meta.totalPages)) return;
      this.loading = true;
      try {
        const res = await api.pinjaman.list({ page, limit: this.meta.limit, search: this.search });
        this.pinjaman = res.data;
        this.meta = { ...res.meta, totalPages: Math.ceil(res.meta.total / res.meta.limit) };
      } catch (err) {
        Toast.error(err.message);
      } finally {
        this.loading = false;
      }
    },

    async loadNPL() {
      this.viewMode = 'npl';
      this.loadingNPL = true;
      try {
        const res = await api.pinjaman.kolektibilitas();
        this.nplSummary = res.data.summary;
        this.nplList = res.data.list;
      } catch (err) { Toast.error(err.message); }
      finally { this.loadingNPL = false; }
    },

    async openDetail(p) {
      this.selectedPinjaman = p;
      this.showDetail = true;
      this.loadingAngs = true;
      this.jadwalAngsuran = [];
      this.agunanList = [];
      try {
        const [resAngs, resAgunan] = await Promise.all([
           api.get(`/pinjaman/${p.id}/angsuran`).catch(() => ({ data: [] })),
           api.pinjaman.agunan.list(p.id).catch(() => ({ data: [] }))
        ]);
        this.jadwalAngsuran = resAngs.data || [];
        this.agunanList = resAgunan.data || [];
      } catch (err) {
        console.error(err);
      } finally {
        this.loadingAngs = false;
      }
    },

    get angsuranAktif() {
      if (!this.jadwalAngsuran?.length) return null;
      return this.jadwalAngsuran.find(a => a.status === 'belum');
    },

    statusColor(s) {
      return { 'diajukan': 'badge-gray', 'disetujui': 'badge-blue', 'cair': 'badge-amber', 'lunas': 'badge-green', 'macet': 'badge-red' }[s] || 'badge-gray';
    },

    openModal() {
      this.form = { anggota_id: '', pokok: null, jangka_waktu: 12, suku_bunga: 1.5, tujuan: '' };
      this.showModal = true;
    },

    async submitForm() {
      this.saving = true;
      try {
        await api.pinjaman.create(this.form);
        Toast.success('Pengajuan pinjaman berhasil dibuat.');
        this.showModal = false;
        this.loadData(1);
      } catch (err) { Toast.error(err.message); } finally { this.saving = false; }
    },

    async action(type, id) {
       try {
          if (type === 'setujui') {
             await api.pinjaman.setujui(id);
             Toast.success('Pinjaman disetujui, siap dicairkan.');
          }
          await this.loadData(this.meta.page);
          this.showDetail = false;
       } catch (err) { Toast.error(err.message); }
    },

    async pencairan(p) {
       const tgl = prompt('Masukkan tanggal pencairan (YYYY-MM-DD)', new Date().toISOString().slice(0,10));
       if (!tgl) return;
       try {
          await api.pinjaman.cairkan(p.id, { tanggal: tgl });
          Toast.success(`Pencairan berhasil dicatat dan sistem menjurnal: D (Piutang) ${formatRp(p.pokok)} | K (Kas) ${formatRp(p.pokok)}`);
          this.showDetail = false;
          this.loadData(this.meta.page);
       } catch (err) { Toast.error(err.message); }
    },

    async bayarAngsuran() {
       const currentA = this.angsuranAktif;
       if (!currentA) return;
       const tgl = prompt('Tanggal Bayar (YYYY-MM-DD)', new Date().toISOString().slice(0,10));
       if (!tgl) return;
       try {
          await api.pinjaman.bayarAngsuran(this.selectedPinjaman.id, { angsuran_id: currentA.id, tanggal: tgl });
          Toast.success(`Angsuran ke-${currentA.ke} sebesar ${formatRp(currentA.total)} berhasil dibayar & dijurnal!`);
          await this.openDetail(this.selectedPinjaman); // reload detail
          await this.loadData(this.meta.page);
       } catch (err) { Toast.error(err.message); }
    },

    openAgunanModal() {
       this.formAgunan = { jenis: 'bpkb', nilai_taksiran: 0, deskripsi: '' };
       this.showAgunanModal = true;
    },

    async submitAgunan() {
       this.saving = true;
       try {
          await api.pinjaman.agunan.add(this.selectedPinjaman.id, this.formAgunan);
          Toast.success('Agunan berhasil ditambahkan');
          this.showAgunanModal = false;
          await this.openDetail(this.selectedPinjaman);
       } catch (err) { Toast.error(err.message); } finally { this.saving = false; }
    },

    async kembalikanAgunan(id) {
       if (!confirm('Tandai agunan ini sebagai sudah dikembalikan?')) return;
       try {
          await api.pinjaman.agunan.kembali(this.selectedPinjaman.id, id);
          Toast.success('Agunan dikembalikan');
          await this.openDetail(this.selectedPinjaman);
       } catch (err) { Toast.error(err.message); }
    }
  }));
});
