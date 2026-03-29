const express = require('express');
const router  = express.Router();
const ctrl    = require('./penjualan.controller');
const { authenticate } = require('../../middleware/auth');
const { asyncHandler } = require('../../middleware/errorHandler');

router.use(authenticate);
router.get('/',       asyncHandler(ctrl.list));
router.post('/',      asyncHandler(ctrl.checkout));
router.post('/bulk',  asyncHandler(ctrl.bulkInsert));

module.exports = router;
