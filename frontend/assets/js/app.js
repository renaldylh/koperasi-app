// ============================================================
// UKOPERASI — Alpine.js Root App
// ============================================================
document.addEventListener('alpine:init', () => {
  // Global App Data
  Alpine.data('app', () => ({
    user: Auth.getUser(),
    sidebarOpen: false,
    navItems: [
      { moduleId: 'dashboard', name: 'Dashboard', url: '/pages/dashboard.html', icon: 'ri-dashboard-line', roles: ['superadmin','admin','pengurus','anggota'] },
      { moduleId: 'anggota', name: 'Anggota', url: '/pages/anggota.html', icon: 'ri-team-line', roles: ['superadmin','admin','pengurus'] },
      { moduleId: 'simpanan', name: 'Simpanan', url: '/pages/simpanan.html', icon: 'ri-wallet-3-line', roles: ['superadmin','admin','pengurus'] },
      { moduleId: 'produk', name: 'Buku Produk', url: '/pages/produk.html', icon: 'ri-shopping-bag-3-line', roles: ['superadmin','admin','pengurus'] },
      { moduleId: 'transaksi', name: 'Transaksi Kasir', url: '/pages/kasir.html', icon: 'ri-exchange-dollar-line', roles: ['superadmin','admin','pengurus'] },
      { moduleId: 'aset', name: 'Aset Tetap', url: '/pages/aset.html', icon: 'ri-building-line', roles: ['superadmin','admin','pengurus'] },
      { moduleId: 'akuntansi', name: 'Akuntansi & Jurnal', url: '/pages/akuntansi.html', icon: 'ri-book-read-line', roles: ['superadmin','admin','pengurus'] },
      { moduleId: 'laporan', name: 'Laporan SAK EP', url: '/pages/laporan.html', icon: 'ri-file-chart-line', roles: ['superadmin','admin','pengurus'] },
      { moduleId: 'settings', name: 'Pengaturan', url: '/pages/settings.html', icon: 'ri-settings-3-line', roles: ['superadmin','admin'] },
    ],
     settings: {
        nama_koperasi: 'Ukoperasi',
        app_name_alias: 'Ukoperasi',
        theme_color: '#3b82f6',
        sidebar_bg_color: '#ffffff',
        sidebar_text_color: '#475569',
        topbar_bg_color: '#ffffff',
        app_footer_text: '© 2026 Institutional Management System',
        sidebar_logo_subtext: 'Smart Management',
        primary_font_family: 'Inter',
        dashboard_welcome_msg: 'Selamat Datang!',
        logo_url: '',
        active_modules: 'all',
        currency_symbol: 'Rp',
        decimal_places: 0
     },
    
    init() {
       window.appInstance = this; 
       if (window.location.pathname.includes('login.html')) return;
       Auth.redirect(); 
       this.loadGlobalSettings();
    },

    async loadGlobalSettings() {
       try {
          const res = await api.get('/settings/config/public');
          const map = {};
          res.data.forEach(s => { map[s.key] = s.value; });
          this.settings = { ...this.settings, ...map };
          this.applyBranding();
       } catch (err) {
          try {
             const res = await api.get('/settings/config');
             const map = {};
             res.data.forEach(s => { map[s.key] = s.value; });
             this.settings = { ...this.settings, ...map };
          } catch(e) {}
       }
       this.applyBranding();
    },

    // Helper: brightness detector
    getContrastYIQ(hexcolor){
        if (!hexcolor || hexcolor.length < 6) return 'light';
        hexcolor = hexcolor.replace("#", "");
        var r = parseInt(hexcolor.substr(0,2),16);
        var g = parseInt(hexcolor.substr(2,2),16);
        var b = parseInt(hexcolor.substr(4,2),16);
        var yiq = ((r*299)+(g*587)+(b*114))/1000;
        return (yiq >= 128) ? 'dark' : 'light';
    },

    applyBranding() {
       const s = this.settings;
       const root = document.documentElement.style;

       if (s.theme_color) {
          root.setProperty('--primary', s.theme_color);
          const hex = s.theme_color.replace('#','');
          const r = parseInt(hex.substring(0,2), 16);
          const g = parseInt(hex.substring(2,4), 16);
          const b = parseInt(hex.substring(4,6), 16);
          root.setProperty('--primary-rgb', `${r}, ${g}, ${b}`);
       }
       
       if (s.primary_hover_color) root.setProperty('--primary-hover', s.primary_hover_color);
       if (s.button_radius) root.setProperty('--radius-btn', s.button_radius);
       if (s.card_radius) root.setProperty('--radius-card', s.card_radius);
       if (s.sidebar_width_px) root.setProperty('--sidebar-w', `${s.sidebar_width_px}px`);
       
       if (s.sidebar_bg_color) {
          root.setProperty('--sidebar-bg', s.sidebar_bg_color);
          const contrast = this.getContrastYIQ(s.sidebar_bg_color);
          const textColor = (contrast === 'light') ? '#ffffff' : '#475569';
          root.setProperty('--sidebar-text', textColor);
       }
       
       if (s.topbar_bg_color) root.setProperty('--topbar-bg', s.topbar_bg_color);
       if (s.primary_font_family) root.setProperty('--font-main', `'${s.primary_font_family}', sans-serif`);
       
       // Handle Glassmorphism & Density
       const body = document.body;
       if (s.enable_glassmorphism === 'true') {
          body.classList.add('glass-enabled');
          document.querySelectorAll('.card').forEach(c => c.classList.add('glass'));
       } else {
          body.classList.remove('glass-enabled');
          document.querySelectorAll('.card').forEach(c => c.classList.remove('glass'));
       }
       
       body.classList.remove('density-compact', 'density-normal');
       body.classList.add(`density-${s.table_density || 'normal'}`);

       // Handle maintenance mode
       if (s.maintenance_mode === 'true' && this.user && this.user.role !== 'admin' && this.user.role !== 'superadmin') {
          Auth.removeToken();
          window.location.href = '/pages/maintenance.html';
       }
    },

    formatCurrency(val) {
       if (val === undefined || val === null) return '0';
       const s = this.settings;
       const dec = s.decimal_places || 0;
       const ds = s.decimal_separator || ',';
       const ts = s.thousand_separator || '.';
       const sym = s.currency_symbol || 'Rp';

       let parts = Number(val).toFixed(dec).split('.');
       parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ts);
       return sym + ' ' + (parts.length > 1 ? parts.join(ds) : parts[0]);
    },

    get filteredNav() {
      if (!this.user) return [];
      
      let activeMap = {};
      try { 
         if (this.settings.active_modules === 'all') {
            this.navItems.forEach(n => activeMap[n.moduleId] = true);
         } else {
            activeMap = JSON.parse(this.settings.active_modules || '{}');
         }
      } catch(e) { activeMap = {}; }

      return this.navItems.filter(item => {
        // 1. Check Global Module Switch
        if (activeMap[item.moduleId] === false) return false;
        
        // 2. Check Role permissions
        const hasRole = item.roles.includes(this.user.role);
        if (!hasRole) return false;

        // 3. Check specific User Permissions (if any)
        if (this.user.permissions && typeof this.user.permissions === 'object') {
           if (this.user.permissions[item.moduleId] === false) return false;
        }

        return true;
      });
    },

    isActive(url) {
      const target = url.replace(/\.html$/, '');
      const current = window.location.pathname.replace(/\.html$/, '');
      return current.includes(target);
    },

    logout() {
      Auth.removeToken();
      window.location.href = '/pages/login.html';
    }
  }));

  // Login Page Logic
  Alpine.data('loginForm', () => ({
    email: '',
    password: '',
    loading: false,
    errorMsg: '',

    init() {
      if (Auth.isLoggedIn()) window.location.href = '/pages/dashboard.html';
      this.loadBranding();
    },

    async loadBranding() {
       try {
          const res = await api.get('/settings/config/public');
          const map = {};
          res.data.forEach(s => { map[s.key] = s.value; });
          Object.assign(this.branding, map);
       } catch (err) {}
    },

    branding: {
       nama_koperasi: 'Ukoperasi',
       app_name_alias: 'Ukoperasi',
       logo_url: '',
       theme_color: '#3b82f6',
       app_footer_text: '© 2026 Institutional Management System'
    },

    async submit() {
      this.loading = true;
      this.errorMsg = '';
      try {
        const res = await api.login(this.email, this.password);
        Auth.setToken(res.data.token);
        Auth.setUser(res.data.user);
        Toast.success('Login berhasil!');
        setTimeout(() => window.location.href = '/pages/dashboard.html', 500);
      } catch (err) {
        this.errorMsg = err.message || 'Login gagal. Periksa kembali email dan password.';
      } finally {
        this.loading = false;
      }
    }
  }));
});
