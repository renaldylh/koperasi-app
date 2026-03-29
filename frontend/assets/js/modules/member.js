document.addEventListener('alpine:init', () => {
   
   // Member Login Logic
   Alpine.data('memberLogin', () => ({
     no_anggota: '',
     nik: '',
     loading: false,
     errorMsg: '',
 
     init() {
       if (Auth.isLoggedIn() && Auth.getUser().role === 'anggota') {
         window.location.href = '/pages/member-dashboard.html';
       }
     },
 
     async submit() {
       this.loading = true;
       this.errorMsg = '';
       try {
         const res = await api.member.login(this.no_anggota, this.nik);
         Auth.setToken(res.data.token);
         Auth.setUser(res.data.anggota); // role === anggota is handled in token
         // override role
         const user = res.data.anggota;
         user.role = 'anggota';
         Auth.setUser(user);
 
         Toast.success('Login anggota berhasil!');
         setTimeout(() => window.location.href = '/pages/member-dashboard.html', 500);
       } catch (err) {
         this.errorMsg = err.message || 'Login gagal. Periksa kembali No Anggota dan NIK.';
       } finally {
         this.loading = false;
       }
     }
   }));
 
   // Member Dashboard Logic
   Alpine.data('memberDashboard', () => ({
     user: null,
     data: {
       total_simpanan: 0,
       total_sisa_pinjaman: 0,
       saldo_simpanan: [],
       pinjaman_aktif: [],
       mutasi: []
     },
     loading: true,
 
     init() {
       this.user = Auth.getUser();
       if (!this.user || this.user.role !== 'anggota') {
          Auth.removeToken();
          window.location.href = '/pages/member-login.html';
          return;
       }
       this.loadDashboard();
     },
 
     async loadDashboard() {
       this.loading = true;
       try {
         const res = await api.member.dashboard();
         this.data = res.data;
       } catch (err) {
         Toast.error('Gagal mengambil data dashboard anggota: ' + err.message);
       } finally {
         this.loading = false;
       }
     },
 
     logout() {
       Auth.removeToken();
       window.location.href = '/pages/member-login.html';
     }
   }));

   // Member Pengajuan Pinjaman Logic
   Alpine.data('memberPengajuan', () => ({
      user: null,
      form: {
         pokok: 0,
         jangka_waktu: 12,
         tujuan: '',
         metode_angsuran: 'flat'
      },
      loading: false,

      init() {
         this.user = Auth.getUser();
         if (!this.user || this.user.role !== 'anggota') {
            window.location.href = '/pages/member-login.html';
         }
      },

      async submit() {
         if (this.form.pokok <= 0) return Toast.error('Nominal harus lebih dari 0');
         this.loading = true;
         try {
            // Suku bunga standar ditetapkan Koperasi, e.g 1.5% - Ideally fetched from settings
            const payload = { ...this.form, suku_bunga: 1.5 };
            const res = await api.member.pengajuan(payload);
            Toast.success(res.message);
            setTimeout(() => {
               window.location.href = '/pages/member-dashboard.html';
            }, 2000);
         } catch (err) {
            Toast.error(err.message);
         } finally {
            this.loading = false;
         }
      }
   }));
 });
