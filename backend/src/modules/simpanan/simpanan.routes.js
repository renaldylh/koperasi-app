const express = require('express');
const router  = express.Router();
const ctrl    = require('./simpanan.controller');
const { authenticate, authorize } = require('../../middleware/auth');
const { asyncHandler } = require('../../middleware/errorHandler');

router.use(authenticate);
router.get('/rekap',              authorize('admin','pengurus'), asyncHandler(ctrl.rekap));
router.get('/:anggotaId',         asyncHandler(ctrl.getSaldo));
router.get('/:anggotaId/riwayat', asyncHandler(ctrl.getRiwayat));
router.post('/setoran',           authorize('admin','pengurus'), asyncHandler(ctrl.setoran));
router.post('/setoran/bulk',      authorize('admin','pengurus'), asyncHandler(ctrl.bulkSetoran));
router.post('/penarikan',         authorize('admin','pengurus'), asyncHandler(ctrl.penarikan));

module.exports = router;
