const express  = require('express');
const router   = express.Router();
const ctrl     = require('./auth.controller');
const { authenticate, authorize } = require('../../middleware/auth');
const { asyncHandler } = require('../../middleware/errorHandler');

router.post('/login',    asyncHandler(ctrl.login));
router.get('/me',        authenticate, asyncHandler(ctrl.me));
router.post('/register', authenticate, authorize('superadmin','admin'), asyncHandler(ctrl.register));

module.exports = router;
