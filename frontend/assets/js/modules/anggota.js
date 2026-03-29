document.addEventListener('alpine:init', () => {
  Alpine.data('anggotaModule', () => ({
    loading: false,
    anggota: [],
    search: '',
    meta: { page: 1, limit: 15, total: 0, totalPages: 1 },
    
    // Modal state
    showModal: false,
    isEdit: false,
    saving: false,
    form: {},

    // Import State
    showImportModal: false,
    importFile: null,

    async init() {
      await this.loadData();
    },

    async loadData(page = 1) {
      if (page < 1 || (this.meta.totalPages > 0 && page > this.meta.totalPages)) return;
      this.loading = true;
      try {
        const res = await api.anggota.list({ page, limit: this.meta.limit, search: this.search });
        this.anggota = res.data;
        this.meta = { ...res.meta, totalPages: Math.ceil(res.meta.total / res.meta.limit) };
      } catch (err) {
        Toast.error(err.message);
      } finally {
        this.loading = false;
      }
    },

    openModal(data = null) {
      this.isEdit = !!data;
      if (data) {
        this.form = { ...data };
      } else {
        this.form = {
          no_anggota: `AGT${new Date().getFullYear()}${String(Math.floor(Math.random()*1000)).padStart(4,'0')}`,
          nik: '', nama: '', tempat_lahir: '', tanggal_lahir: '',
          jenis_kelamin: 'L', alamat: '', telepon: '', pekerjaan: '',
          tanggal_masuk: new Date().toISOString().slice(0,10),
        };
      }
      this.showModal = true;
    },

    async submitForm() {
      this.saving = true;
      try {
        if (this.isEdit) {
          await api.anggota.update(this.form.id, this.form);
          Toast.success('Anggota diperbarui!');
        } else {
          await api.anggota.create(this.form);
          Toast.success('Anggota didaftarkan. Rekening simpanan wajib otomatis dibuat.');
        }
        this.showModal = false;
        this.loadData(this.isEdit ? this.meta.page : 1);
      } catch (err) {
        Toast.error(err.message);
      } finally {
        this.saving = false;
      }
    },

    handleFile(e) {
       const file = e.target.files[0];
       if (!file) return;
       // Limit to 5MB
       if (file.size > 5 * 1024 * 1024) {
          Toast.error('Ukuran file maksimal 5MB');
          this.$refs.fileInput.value = '';
          this.importFile = null;
          return;
       }
       this.importFile = file;
    },

    async submitImport() {
       if (!this.importFile) return;
       this.saving = true;
       try {
          const formData = new FormData();
          formData.append('file', this.importFile);

          const res = await fetch(`${API_BASE}/excel/import/anggota`, {
             method: 'POST',
             headers: { 'Authorization': `Bearer ${Auth.getToken()}` },
             body: formData
          });

          const data = await res.json();
          if (!res.ok) throw new Error(data.message || 'Gagal import excel');

          Toast.success(data.message);
          this.showImportModal = false;
          this.importFile = null;
          this.$refs.fileInput.value = '';
          this.loadData();
       } catch (err) {
          Toast.error(err.message);
       } finally {
          this.saving = false;
       }
    }
  }));
});
