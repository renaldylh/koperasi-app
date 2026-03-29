const express = require('express');
const router  = express.Router();
const ctrl    = require('./pinjaman.controller');
const { authenticate, authorize } = require('../../middleware/auth');
const { asyncHandler } = require('../../middleware/errorHandler');

router.use(authenticate);
router.get('/',                 asyncHandler(ctrl.list));
router.get('/kolektibilitas',   authorize('admin','pengurus'), asyncHandler(ctrl.kolektibilitas));
router.get('/:id',              asyncHandler(ctrl.detail));
router.post('/',                authorize('admin','pengurus'), asyncHandler(ctrl.create));
router.put('/:id/setujui',      authorize('admin','pengurus'), asyncHandler(ctrl.setujui));
router.put('/:id/cairkan',      authorize('admin','pengurus'), asyncHandler(ctrl.cairkan));
router.post('/:id/bayar',       authorize('admin','pengurus'), asyncHandler(ctrl.bayarAngsuran));

// Agunan
router.get('/:id/agunan',       asyncHandler(ctrl.getAgunan));
router.post('/:id/agunan',      authorize('admin','pengurus'), asyncHandler(ctrl.addAgunan));
router.put('/:id/agunan/:agunanId/kembali', authorize('admin','pengurus'), asyncHandler(ctrl.kembalikanAgunan));

module.exports = router;
