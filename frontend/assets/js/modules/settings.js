document.addEventListener('alpine:init', () => {
  Alpine.data('settingsModule', () => ({
    tab: 'profil',
    loadingProfil: false,
    loadingUsers: false,
    loadingConfig: false,
    saving: false,
    searchQuery: '',
    
    configMap: {
       // Identitas & Branding
       nama_koperasi: '',
       app_name_alias: 'Ukoperasi',
       logo_url: '',
       sidebar_bg_color: '#ffffff',
       sidebar_text_color: '#475569',
       topbar_bg_color: '#ffffff',
       app_footer_text: '© 2026 Institutional Management System',
       sidebar_logo_subtext: 'Smart Management',
       primary_font_family: 'Inter',
       
       // Keuangan (Business Rules)
       iuran_pokok_nominal: 0,
       iuran_wajib_nominal: 0,
       biaya_admin_pendaftaran: 0,
       bunga_pinjaman_default: 0,
       denda_telat_persen: 0,
       min_simpanan_awal: 0,
       min_saldo_mengendap: 0,
       pajak_shu_persen: 0,
       pinjaman_max_plafond: 0,
       pinjaman_max_tenor: 0,
       provisi_pinjaman_persen: 0,
       asuransi_pinjaman_persen: 0,

       // Akuntansi (COA Mapping)
       coa_kas_utama: '',
       coa_bank_utama: '',
       coa_piutang_anggota: '',
       coa_pendapatan_bunga: '',
       coa_beban_umum: '',
       coa_labarugi_ditahan: '',
       enable_auto_jurnal: true,
       fiscal_year_start: 1,

       // Keamanan & System
       max_login_attempts: 5,
       session_timeout_min: 60,
       min_password_length: 8,
       maintenance_mode: false,
       allow_self_register: true,
       audit_log_retention: 90,
       debug_mode: false,
       
       // Integrasi & Laporan
       wa_gateway_url: '',
       wa_gateway_key: '',
       template_wa_welcome: '',
       template_wa_setoran: '',
       template_wa_penarikan: '',
       template_wa_iuran_wajib: '',
       template_wa_iuran_pokok: '',
       nama_ketua: '',
       nama_bendahara: '',
       nama_sekretaris: '',
       kota_pelaporan: '',
       currency_symbol: 'Rp',
       decimal_places: 0,
       
       active_modules: 'all'
    },
    
    profilForm: { nama: '', kode: '', alamat: '', no_badan_hukum: '' },
    
    configs: [], // { key, value, group, description }
    
    users: [],
    showUserModal: false,
    userForm: { nama: '', email: '', password: '', role: 'pengurus' },

    async init() {
       // Hanya admin yang bisa mengatur settings secara penuh
       const me = Auth.getUser();
       if(me && me.role !== 'admin' && me.role !== 'superadmin') {
          Toast.error('Akses ditolak! Anda tidak memiliki hak Admin.');
          setTimeout(() => window.location.href='/pages/dashboard.html', 1500);
          return;
       }
       
       this.loadProfil();
       this.loadUsers();
       this.loadConfigs();
    },

    async loadProfil() {
       this.loadingProfil = true;
       try {
          const res = await api.settings.getBMT();
          this.profilForm = { ...res.data };
       } catch (err) { Toast.error(err.message); }
       finally { this.loadingProfil = false; }
    },

    async saveProfil() {
       this.saving = true;
       try {
          const res = await api.settings.updateBMT({
             nama: this.profilForm.nama,
             alamat: this.profilForm.alamat,
             no_badan_hukum: this.profilForm.no_badan_hukum
          });
          this.profilForm = { ...res.data };
          
          // AUTO SAVE BRANDING TOO
          await this.saveSettings(true); 
          
          Toast.success('Profil Koperasi & Branding berhasil diperbarui.');
       } catch (err) { Toast.error(err.message); }
       finally { this.saving = false; }
    },

    async loadUsers() {
       this.loadingUsers = true;
       try {
          const res = await api.settings.listUsers();
          this.users = res.data;
       } catch (err) { Toast.error(err.message); }
       finally { this.loadingUsers = false; }
    },

    async createUser() {
       this.saving = true;
       try {
          await api.settings.createUser(this.userForm);
          Toast.success('Akun pegawai berhasil dibuat.');
          this.showUserModal = false;
          this.userForm = { nama: '', email: '', password: '', role: 'pengurus' };
          this.loadUsers();
       } catch(err) { Toast.error(err.message); }
       finally { this.saving = false; }
    },

    async loadConfigs() {
       this.loadingConfig = true;
       try {
          const res = await api.get('/settings/config');
          this.configs = res.data;
          // Map to configMap for easy UI binding
          this.configs.forEach(c => {
             let val = c.value;
             if (c.type === 'number') val = parseFloat(val);
             if (c.type === 'boolean') val = val === 'true' || val === '1';
             this.configMap[c.key] = val;
          });
       } catch (err) { Toast.error(err.message); }
       finally { this.loadingConfig = false; }
    },

    async saveSettings(silent = false) {
      this.saving = true;
      try {
        // Convert configMap back to array for API
        const payload = Object.keys(this.configMap).map(key => ({
           key,
           value: String(this.configMap[key]),
           type: typeof this.configMap[key] === 'number' ? 'number' : 
                 typeof this.configMap[key] === 'boolean' ? 'boolean' : 'string'
        }));

        await api.post('/settings/config', { settings: payload });
        if(!silent) Toast.success('Konfigurasi sistem berhasil diperbarui.');
        await this.loadConfigs();
        
        // APPLY GLOBALLY
        if(window.appInstance && window.appInstance.applyBranding) {
           window.appInstance.applyBranding();
        }
      } catch (err) { Toast.error(err.message); }
      finally { this.saving = false; }
    },

    isModuleActive(m) {
       if (this.configMap.active_modules === 'all') return true;
       try {
          const map = JSON.parse(this.configMap.active_modules || '{}');
          return map[m] !== false;
       } catch(e) { return true; }
    },

    toggleModule(m) {
       let map = {};
       try {
          if (this.configMap.active_modules !== 'all') {
             map = JSON.parse(this.configMap.active_modules || '{}');
          } else {
             // Initialize with all true
             ['anggota', 'simpanan', 'produk', 'transaksi', 'aset', 'akuntansi', 'laporan'].forEach(mod => map[mod] = true);
          }
       } catch(e) { map = {}; }
       
       map[m] = !this.isModuleActive(m);
       this.configMap.active_modules = JSON.stringify(map);
    },

    hasUserPermission(u, m) {
       if (u.role === 'admin' || u.role === 'superadmin') return true;
       if (!u.permissions) return true; // Default allow if not set
       return u.permissions[m] !== false;
    },

    async toggleUserPermission(userId, m) {
       const user = this.users.find(u => u.id === userId);
       if (!user) return;
       
       let p = user.permissions || {};
       if (typeof p === 'string') {
          try { p = JSON.parse(p); } catch(e) { p = {}; }
       }
       
       p[m] = !this.hasUserPermission(user, m);
       
       try {
          await api.put(`/settings/users/${userId}/permissions`, { permissions: p });
          user.permissions = p;
          Toast.success(`Izin modul ${m} diperbarui.`);
       } catch(err) { Toast.error(err.message); }
    },

    addConfigRow() {
       this.configs.push({ key: '', value: '', group: 'umum', description: '' });
    },

    removeConfigRow(index) {
       this.configs.splice(index, 1);
    },

    async toggleUser(id, act) {
       if(!confirm(`Yakin ingin men-${act ? 'blokir' : 'aktifkan'} operator ini?`)) return;
       try {
          await api.settings.toggleUser(id);
          Toast.success('Setting akun tersimpan.');
          this.loadUsers();
       } catch (err) { Toast.error(err.message); }
    },

    get filteredConfigs() {
       if (!this.searchQuery) return this.configs;
       const q = this.searchQuery.toLowerCase();
       return this.configs.filter(c => 
          c.key.toLowerCase().includes(q) || 
          (c.description && c.description.toLowerCase().includes(q))
       );
    },

    async uploadLogo(event) {
       const file = event.target.files[0];
       if (!file) return;

       const formData = new FormData();
       formData.append('logo', file);

       this.saving = true;
       try {
          const res = await api.post('/settings/logo', formData, {
             headers: { 'Content-Type': 'multipart/form-data' }
           });
          this.configMap.logo_url = res.logoUrl;
          this.settings.logo_url = res.logoUrl; 
          Toast.success('Logo berhasil diunggah.');
       } catch (err) {
          Toast.error(err.message || 'Gagal mengunggah logo.');
       } finally {
          this.saving = false;
       }
    }
  }));
});
