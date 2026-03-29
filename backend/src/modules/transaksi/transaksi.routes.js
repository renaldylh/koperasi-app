const express = require('express');
const router = express.Router();
const ctrl = require('./transaksi.controller');
const { authorize, authenticate } = require('../../middleware/auth');

router.use(authenticate);

// Hanya admin atau pengurus yang boleh catat trx. Kalo anggota gak butuh.
router.get('/', authorize('admin', 'pengurus'), ctrl.list);
router.post('/pemasukan', authorize('admin', 'pengurus'), ctrl.catatPemasukan);
router.post('/pengeluaran', authorize('admin', 'pengurus'), ctrl.catatPengeluaran);

router.get('/kasir/sesi', authorize('admin', 'pengurus'), ctrl.checkSesiKasir);
router.post('/kasir/buka', authorize('admin', 'pengurus'), ctrl.bukaKasir);
router.post('/kasir/tutup', authorize('admin', 'pengurus'), ctrl.tutupKasir);

module.exports = router;
