const express  = require('express');
const router   = express.Router();
const ctrl     = require('./anggota.controller');
const { authenticate, authorize } = require('../../middleware/auth');
const { asyncHandler } = require('../../middleware/errorHandler');

router.use(authenticate);
router.get('/',     asyncHandler(ctrl.list));
router.get('/:id',  asyncHandler(ctrl.detail));
router.get('/:id/ledger', asyncHandler(ctrl.ledger));
router.post('/',    authorize('admin','pengurus'), asyncHandler(ctrl.create));
router.put('/:id',  authorize('admin','pengurus'), asyncHandler(ctrl.update));
router.delete('/:id', authorize('admin'), asyncHandler(ctrl.remove));

module.exports = router;
