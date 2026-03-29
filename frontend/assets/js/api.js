// ============================================================
// UKOPERASI — API Client (Axios-like using Fetch)
// ============================================================
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3000/api'
  : '/api'; // Same-origin in production

const Auth = {
  getToken() { return localStorage.getItem('uk_token'); },
  setToken(t) { localStorage.setItem('uk_token', t); },
  removeToken() { localStorage.removeItem('uk_token'); localStorage.removeItem('uk_user'); },
  getUser() { try { return JSON.parse(localStorage.getItem('uk_user')); } catch { return null; } },
  setUser(u) { localStorage.setItem('uk_user', JSON.stringify(u)); },
  isLoggedIn() { return !!this.getToken(); },
  redirect() { if (!this.isLoggedIn()) window.location.href = '/pages/login.html'; },
};

async function fetchAPI(endpoint, options = {}) {
  const token = Auth.getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 401) {
    Auth.removeToken();
    // Only redirect if not already on login page to prevent loops
    if (!window.location.pathname.includes('/pages/login')) {
      window.location.href = '/pages/login.html';
    }
    return;
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data;
}

const api = {
  get:    (url, params)   => fetchAPI(url + (params ? '?' + new URLSearchParams(params) : '')),
  post:   (url, body)     => fetchAPI(url, { method: 'POST', body }),
  put:    (url, body)     => fetchAPI(url, { method: 'PUT',  body }),
  delete: (url)           => fetchAPI(url, { method: 'DELETE' }),

  // ── Auth ───────────────────────────────────────────────────
  login:    (email, password) => api.post('/auth/login', { email, password }),
  me:       ()                => api.get('/auth/me'),

  // ── Dashboard ──────────────────────────────────────────────
  dashboard: () => api.get('/dashboard'),

  // ── Anggota ────────────────────────────────────────────────
  anggota: {
    list:   (params) => api.get('/anggota', params),
    detail: (id)     => api.get(`/anggota/${id}`),
    ledger: (id, p)  => api.get(`/anggota/${id}/ledger`, p),
    create: (data)   => api.post('/anggota', data),
    update: (id, d)  => api.put(`/anggota/${id}`, d),
    delete: (id)     => api.delete(`/anggota/${id}`),
  },

  // ── Simpanan ───────────────────────────────────────────────
  simpanan: {
    saldo:    (anggotaId) => api.get(`/simpanan/${anggotaId}`),
    riwayat:  (anggotaId, params) => api.get(`/simpanan/${anggotaId}/riwayat`, params),
    rekap:    ()          => api.get('/simpanan/rekap'),
    setoran:  (data)      => api.post('/simpanan/setoran', data),
    setoranBulk: (data)   => api.post('/simpanan/setoran/bulk', data),
    penarikan:(data)      => api.post('/simpanan/penarikan', data),
  },

  // ── Pinjaman ───────────────────────────────────────────────
  pinjaman: {
    list:         (params)  => api.get('/pinjaman', params),
    kolektibilitas:()       => api.get('/pinjaman/kolektibilitas'),
    detail:       (id)      => api.get(`/pinjaman/${id}`),
    create:       (data)    => api.post('/pinjaman', data),
    setujui:      (id)      => api.put(`/pinjaman/${id}/setujui`),
    cairkan:      (id, data)=> api.put(`/pinjaman/${id}/cairkan`, data),
    bayarAngsuran:(id, data)=> api.post(`/pinjaman/${id}/bayar`, data),
    agunan: {
      list:     (pinjamanId)       => api.get(`/pinjaman/${pinjamanId}/agunan`),
      add:      (pinjamanId, data) => api.post(`/pinjaman/${pinjamanId}/agunan`, data),
      kembali:  (pinjamanId, id)   => api.put(`/pinjaman/${pinjamanId}/agunan/${id}/kembali`),
    }
  },

  // ── Akuntansi ──────────────────────────────────────────────
  akuntansi: {
    rekening:    ()           => api.get('/akuntansi/rekening'),
    jurnal:      (params)     => api.get('/akuntansi/jurnal', params),
    bulkJurnal:  (data)       => api.post('/akuntansi/jurnal/bulk', data),
    bukuBesar:   (rekId, p)   => api.get(`/akuntansi/buku-besar/${rekId}`, p),
    neracaSaldo: (params)     => api.get('/akuntansi/neraca-saldo', params),
  },

  // ── Laporan ────────────────────────────────────────────────
  laporan: {
    neraca:    (params) => api.get('/laporan/neraca', params),
    labaRugi:  (params) => api.get('/laporan/laba-rugi', params),
    arusKas:   (params) => api.get('/laporan/arus-kas', params),
    perubahanEkuitas: (params) => api.get('/laporan/perubahan-ekuitas', params),
    calk:      (params) => api.get('/laporan/calk', params),
    exportExcel:(tahun) => `${API_BASE}/laporan/export-excel?tahun=${tahun}&token=${Auth.getToken()}`,
  },

  // ── SHU ────────────────────────────────────────────────────
  shu: {
    hitung:  (data)       => api.post('/shu/hitung', data),
    detail:  (periodeId)  => api.get(`/shu/${periodeId}`),
    closing: (periodeId)  => api.post(`/shu/${periodeId}/closing`),
  },

  // ── Settings & Users ───────────────────────────────────────
  settings: {
    getBMT:     ()          => api.get('/settings/bmt'),
    updateBMT:  (data)      => api.put('/settings/bmt', data),
    listUsers:  ()          => api.get('/settings/users'),
    createUser: (data)      => api.post('/settings/users', data),
    toggleUser: (id)        => api.put(`/settings/users/${id}/toggle`),
    getConfig:  ()          => api.get('/settings/config'),
    updateConfig: (settings) => api.post('/settings/config', { settings }),
    sendWA: (data) => api.post('/settings/wa/send', data),
  },

  // ── Aset Tetap ─────────────────────────────────────────────
  aset: {
    list:       (params) => api.get('/aset', params),
    detail:     (id)     => api.get(`/aset/${id}`),
    create:     (data)   => api.post('/aset', data),
    penyusutan: (data)   => api.post('/aset/penyusutan', data),
  },

  // ── Member Portal (PWA Khusus Anggota) ─────────────────────
  member: {
    login:      (no_anggota, nik) => api.post('/member/login', { no_anggota, nik }),
    dashboard:  () => api.get('/member/dashboard'),
    pengajuan:  (data) => api.post('/member/pengajuan', data),
  },

  // ── Produk & Inventaris ────────────────────────────────────
  produk: {
    list:     (params) => api.get('/produk', params),
    create:   (data)   => api.post('/produk', data),
    update:   (id, d)  => api.put(`/produk/${id}`, d),
    delete:   (id)     => api.delete(`/produk/${id}`),
    bulk:     (data)   => api.post('/produk/bulk', data),
    kategori: {
      list:   ()       => api.get('/produk/kategori'),
      create: (data)   => api.post('/produk/kategori', data),
    }
  }
};

// ── Toast Notification ──────────────────────────────────────
const Toast = {
  container: null,
  init() {
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.className = 'toast-container';
      document.body.appendChild(this.container);
    }
  },
  show(msg, type = 'info', duration = 3500) {
    this.init();
    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<span>${icons[type]}</span><span class="msg">${msg}</span><span class="close" onclick="this.parentElement.remove()">×</span>`;
    this.container.appendChild(el);
    setTimeout(() => el.style.opacity = '0', duration - 300);
    setTimeout(() => el.remove(), duration);
  },
  success: (msg) => Toast.show(msg, 'success'),
  error:   (msg) => Toast.show(msg, 'error'),
  info:    (msg) => Toast.show(msg, 'info'),
};

// ── Currency Formatter ──────────────────────────────────────
function formatRp(n) {
  return 'Rp ' + (parseFloat(n) || 0).toLocaleString('id-ID', { minimumFractionDigits: 0 });
}
function formatDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' });
}

// ── PWA: Emergency Unregister Service Worker ─────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.getRegistrations().then(function(registrations) {
      for(let registration of registrations) {
        registration.unregister().then(() => {
          console.log('SW Unregistered to fix ERR_FAILED');
        });
      }
    });
  });
}

// ── Thermal Slip Printer Helper ─────────────────────────────
const SlipPrinter = {
  print(title, noRef, anggotaName, items, total, footerNote = 'Terima kasih atas kepercayaan Anda.') {
    // Inject CSS dynamically if not present
    if (!document.getElementById('uk-print-style')) {
      const link = document.createElement('link');
      link.id = 'uk-print-style';
      link.rel = 'stylesheet';
      link.href = '/assets/css/print.css';
      document.head.appendChild(link);
    }

    let pCont = document.getElementById('print-container');
    if (!pCont) {
      pCont = document.createElement('div');
      pCont.id = 'print-container';
      document.body.appendChild(pCont);
    }
    
    // Build receipt HTML
    const dateStr = new Date().toLocaleString('id-ID', {day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit'});
    let itemsHtml = items.map(i => `
      <div class="print-row"><span>${i.label}</span><span>${formatRp(i.value)}</span></div>
    `).join('');

    pCont.innerHTML = `
      <div class="print-header">
        <div class="print-logo-text">UKOPERASI</div>
        <div class="print-sub">Sistem Koperasi SAK EP</div>
      </div>
      <div style="font-size:10px; margin-bottom:5px;">
        Tgl: ${dateStr}<br>
        Ref: ${noRef}<br>
        Nama: ${anggotaName}
      </div>
      <div style="font-weight:bold; font-size:11px; margin: 5px 0;">[ ${title.toUpperCase()} ]</div>
      <div class="print-divider"></div>
      ${itemsHtml}
      <div class="print-divider"></div>
      <div class="print-row" style="font-size:12px; margin-top:5px;">
        <span>TOTAL</span>
        <span>${formatRp(total)}</span>
      </div>
      <div class="print-footer">
        *** ${footerNote} ***<br>
        Dicetak oleh: ${Auth.getUser()?.nama || 'Sistem'}
      </div>
    `;

    setTimeout(() => {
      window.print();
    }, 500); // Give CSS time to load if first time
  }
};

window.api  = api;
window.Auth = Auth;
window.Toast = Toast;
window.formatRp = formatRp;
window.formatDate = formatDate;
window.SlipPrinter = SlipPrinter;
