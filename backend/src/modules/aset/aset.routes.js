const express = require('express');
const router  = express.Router();
const ctrl    = require('./aset.controller');
const { authenticate, authorize } = require('../../middleware/auth');
const { asyncHandler } = require('../../middleware/errorHandler');

router.use(authenticate);

router.get('/',                 asyncHandler(ctrl.list));
router.get('/:id',              asyncHandler(ctrl.detail));
router.post('/',                authorize('admin','pengurus'), asyncHandler(ctrl.create));
router.post('/penyusutan',      authorize('admin','pengurus'), asyncHandler(ctrl.runPenyusutan));

module.exports = router;
