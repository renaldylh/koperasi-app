document.addEventListener('alpine:init', () => {
  Alpine.data('produkModule', () => ({
    produk: [],
    kategori: [],
    loading: false,
    saving: false,
    showModal: false,
    showKategoriModal: false,
    isEdit: false,
    
    search: '',
    filterKategori: '',
    meta: { page: 1, totalPages: 1, total: 0 },

    // Excel Mode State
    excelMode: false,
    excelRows: [],
    
    form: {
      id: null,
      kategori_id: '',
      kode: '',
      barcode: '',
      nama: '',
      deskripsi: '',
      satuan: 'Pcs',
      harga_beli: 0,
      harga_jual: 0,
      stok_minimal: 5,
      tipe: 'barang',
      metode_stok: 'fifo'
    },
    
    formKategori: { nama: '', deskripsi: '' },

    async init() {
      await this.loadKategori();
      await this.loadData();
    },

    async loadData(page = 1) {
      this.loading = true;
      try {
        const res = await api.produk.list({
          page,
          search: this.search,
          kategori_id: this.filterKategori,
          limit: 10
        });
        this.produk = res.data;
        this.meta = res.meta;
      } catch (err) { Toast.error(err.message); }
      finally { this.loading = false; }
    },

    async loadKategori() {
      try {
        const res = await api.produk.kategori.list();
        this.kategori = res.data;
      } catch (err) { console.error(err); }
    },

    openModal(item = null) {
      this.isEdit = !!item;
      if (item) {
        this.form = { ...item };
      } else {
        this.form = {
          id: null,
          kategori_id: this.kategori.length > 0 ? this.kategori[0].id : '',
          kode: '',
          barcode: '',
          nama: '',
          deskripsi: '',
          satuan: 'Pcs',
          harga_beli: 0,
          harga_jual: 0,
          stok_minimal: 5,
          tipe: 'barang',
          metode_stok: 'fifo'
        };
      }
      this.showModal = true;
    },

    async submitForm() {
      this.saving = true;
      try {
        if (this.isEdit) {
          await api.produk.update(this.form.id, this.form);
          Toast.success('Produk berhasil diperbarui');
        } else {
          await api.produk.create(this.form);
          Toast.success('Produk baru berhasil ditambahkan');
        }
        this.showModal = false;
        this.loadData(this.meta.page);
      } catch (err) { Toast.error(err.message); }
      finally { this.saving = false; }
    },

    async deleteProduk(id) {
       if(!confirm('Yakin ingin menghapus produk ini?')) return;
       try {
          await api.produk.delete(id);
          Toast.success('Produk dihapus');
          this.loadData(this.meta.page);
       } catch (err) { Toast.error(err.message); }
    },

    async submitKategori() {
       this.saving = true;
       try {
          await api.produk.kategori.create(this.formKategori);
          Toast.success('Kategori baru ditambahkan');
          this.showKategoriModal = false;
          this.formKategori = { nama: '', deskripsi: '' };
          await this.loadKategori();
       } catch (err) { Toast.error(err.message); }
       finally { this.saving = false; }
    },

    async saveInline(item) {
       try {
          await api.produk.update(item.id, {
             harga_jual: item.harga_jual,
             stok_minimal: item.stok_minimal
          });
          Toast.show('Perubahan disimpan', 'info', 1000);
       } catch (err) { Toast.error(err.message); }
    },

    exportExcel() {
       const data = this.produk.map(p => ({
          'Kode': p.kode,
          'Nama Produk': p.nama,
          'Kategori': p.kategori?.nama || '-',
          'Harga Beli': p.harga_beli,
          'Harga Jual': p.harga_jual,
          'Stok Saat Ini': p.stok_saat_ini,
          'Satuan': p.satuan,
          'Stok Minimal': p.stok_minimal,
          'Tipe': p.tipe.toUpperCase()
       }));

       const ws = XLSX.utils.json_to_sheet(data);
       const wb = XLSX.utils.book_new();
       XLSX.utils.book_append_sheet(wb, ws, "Daftar Produk");
       XLSX.writeFile(wb, `Daftar_Produk_Ukoperasi_${new Date().toISOString().split('T')[0]}.xlsx`);
       Toast.success('File Excel berhasil diekspor');
    },

    toggleExcelMode() {
        this.excelMode = !this.excelMode;
        if (this.excelMode && this.excelRows.length === 0) {
            for(let i=0; i<15; i++) this.addExcelRow();
        }
    },

    addExcelRow() {
        this.excelRows.push({ kode: '', barcode: '', nama: '', kategori_id: '', harga_jual: 0, stok_saat_ini: 0, _harga_jual_formula: '', _stok_saat_ini_formula: '' });
    },

    evaluateCell(row, field, val) {
        if (String(val).startsWith('=')) {
            row[`_${field}_formula`] = val;
            const result = ExcelCore.evaluate(val, this.excelRows, ['kode','barcode','nama','kategori_id','harga_jual','stok_saat_ini']);
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
                this.excelRows[targetIdx].kode = cells[0] || '';
                this.excelRows[targetIdx].barcode = cells[1] || '';
                this.excelRows[targetIdx].nama = cells[2] || '';
                this.excelRows[targetIdx].kategori_id = cells[3] || '';
                this.excelRows[targetIdx].harga_jual = cells[4] || '';
                this.excelRows[targetIdx].stok_saat_ini = cells[5] || '';
            } else if (cells.length > 0) {
                this.excelRows.push({
                    kode: cells[0] || '',
                    barcode: cells[1] || '',
                    nama: cells[2] || '',
                    kategori_id: cells[3] || '',
                    harga_jual: cells[4] || '',
                    stok_saat_ini: cells[5] || ''
                });
            }
        });
        e.preventDefault();
    },

    async saveBulk() {
        const payload = this.excelRows.filter(r => r.nama);
        if (payload.length === 0) return Toast.error('Tidak ada data valid untuk disimpan.');

        this.saving = true;
        try {
            const res = await api.produk.bulk({ rows: payload });
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
