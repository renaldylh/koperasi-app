document.addEventListener('alpine:init', () => {
    Alpine.data('posModule', () => ({
        products: [],
        cart: [],
        search: '',
        bayar: 0,
        uploading: false,
        user: Auth.getUser() || {},

        async init() {
            await this.loadProducts();
            
            // Keyboard Shortcuts
            window.addEventListener('keydown', (e) => {
                if (e.key === 'F1') { e.preventDefault(); document.querySelector('input').focus(); }
                if (e.key === 'F2') { e.preventDefault(); this.checkout(); }
            });
        },

        async loadProducts() {
            try {
                const res = await api.produk.list({ search: this.search, limit: 12 });
                this.products = res.data;
            } catch (err) { Toast.error(err.message); }
        },

        addToCart(p) {
            const existing = this.cart.find(c => c.id === p.id);
            if (existing) {
                existing.qty++;
            } else {
                this.cart.push({ ...p, qty: 1 });
            }
            this.search = '';
        },

        incQty(idx) { this.cart[idx].qty++; },
        decQty(idx) { 
            if (this.cart[idx].qty > 1) this.cart[idx].qty--; 
            else this.cart.splice(idx, 1);
        },

        get total() {
            return this.cart.reduce((sum, item) => sum + (item.harga_jual * item.qty), 0);
        },

        get kembali() {
            return this.bayar - this.total;
        },

        async checkout() {
            if (this.cart.length === 0 || this.bayar < this.total) return;

            this.uploading = true;
            try {
                const payload = {
                    anggota_id: null, // guest for now
                    items: this.cart.map(c => ({ produk_id: c.id, qty: c.qty })),
                    metode_bayar: 'tunai',
                    bayar: this.bayar
                };
                
                const res = await api.post('/produk/penjualan', payload);
                Toast.success('Transaksi Berhasil! Mencetak Struk...');
                
                // Print Receipt
                SlipPrinter.print(
                    'STRUK BELANJA',
                    res.data.no_faktur,
                    'PELANGGAN UMUM',
                    this.cart.map(c => ({ label: `${c.nama} x${c.qty}`, value: c.harga_jual * c.qty })),
                    this.total,
                    'Terima kasih sudah belanja di Koperasi!'
                );

                this.cart = [];
                this.bayar = 0;
                await this.loadProducts();
            } catch (err) {
                Toast.error(err.message);
            } finally {
                this.uploading = false;
            }
        }
    }));
});
