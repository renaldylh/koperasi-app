const express = require('express');
const router = express.Router();
const ctrl = require('./produk.controller');
const { authenticate, authorize } = require('../../middleware/auth');

router.use(authenticate);

// ─── PRODUK ─────────────────────────────────────────────────
router.get('/', ctrl.listProduk);
router.post('/', authorize('admin', 'superadmin', 'pengurus'), ctrl.createProduk);
router.post('/bulk', authorize('admin', 'superadmin', 'pengurus'), ctrl.bulkUpdateProduk);
router.put('/:id', authorize('admin', 'superadmin', 'pengurus'), ctrl.updateProduk);
router.delete('/:id', authorize('admin', 'superadmin'), ctrl.deleteProduk);

// ─── KATEGORI ───────────────────────────────────────────────
router.get('/kategori', ctrl.listKategori);
router.post('/kategori', authorize('admin', 'superadmin'), ctrl.createKategori);

module.exports = router;
