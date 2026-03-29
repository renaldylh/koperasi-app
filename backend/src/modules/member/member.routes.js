const express = require('express');
const router  = express.Router();
const ctrl    = require('./member.controller');
const { authenticate } = require('../../middleware/auth');
const { asyncHandler } = require('../../middleware/errorHandler');

// Login open endpoint
router.post('/login',      asyncHandler(ctrl.login));

// Protected member endpoints
router.use(authenticate);
router.get('/dashboard',   asyncHandler(ctrl.dashboard));
router.post('/pengajuan',  asyncHandler(ctrl.pengajuanPinjaman));

module.exports = router;
