const express = require('express');
const router = express.Router();
const multer = require('multer');
const ctrl = require('./excel.controller');
const { authenticate, authorize } = require('../../middleware/auth');
const { asyncHandler } = require('../../middleware/errorHandler');

const upload = multer({ storage: multer.memoryStorage() });

router.use(authenticate);
router.post('/import/anggota', authorize('admin', 'pengurus'), upload.single('file'), asyncHandler(ctrl.importAnggota));

module.exports = router;
