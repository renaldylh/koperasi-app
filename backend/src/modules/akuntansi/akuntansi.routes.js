const express = require('express');
const router  = express.Router();
const ctrl    = require('./akuntansi.controller');
const { authenticate, authorize } = require('../../middleware/auth');
const { asyncHandler } = require('../../middleware/errorHandler');

router.use(authenticate);
router.get('/rekening',           asyncHandler(ctrl.listRekening));
router.get('/jurnal',             asyncHandler(ctrl.listJurnal));
router.post('/jurnal/bulk',        asyncHandler(ctrl.bulkJurnal));
router.get('/buku-besar/:rekeningId', asyncHandler(ctrl.bukuBesar));
router.get('/neraca-saldo',       asyncHandler(ctrl.neracaSaldo));

module.exports = router;
