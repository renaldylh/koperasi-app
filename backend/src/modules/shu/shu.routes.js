const express = require('express');
const router  = express.Router();
const ctrl    = require('./shu.controller');
const { authenticate, authorize } = require('../../middleware/auth');
const { asyncHandler } = require('../../middleware/errorHandler');

router.use(authenticate, authorize('admin','pengurus'));
router.post('/hitung',               asyncHandler(ctrl.hitung));
router.get('/:periodeId',            asyncHandler(ctrl.detail));
router.post('/:periodeId/closing',   asyncHandler(ctrl.closing));

module.exports = router;
