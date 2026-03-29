const express = require('express');
const router  = express.Router();
const ctrl    = require('./laporan.controller');
const excelCtrl = require('../excel/excel.controller');
const { authenticate, authorize } = require('../../middleware/auth');
const { asyncHandler } = require('../../middleware/errorHandler');

router.use(authenticate);
router.get('/neraca',             asyncHandler(ctrl.neraca));
router.get('/laba-rugi',          asyncHandler(ctrl.labaRugi));
router.get('/perubahan-ekuitas',  asyncHandler(ctrl.perubahanEkuitas));
router.get('/arus-kas',           asyncHandler(ctrl.arusKas));
router.get('/calk',               asyncHandler(ctrl.calk));
router.get('/export-excel',       authorize('admin','pengurus'), asyncHandler(excelCtrl.exportRAT));

module.exports = router;
