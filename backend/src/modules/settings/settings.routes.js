const express = require('express');
const router = express.Router();
const ctrl = require('./settings.controller');
const { authenticate, authorize } = require('../../middleware/auth');

router.get('/config/public', ctrl.getSettingsPublic);

router.use(authenticate);

router.get('/bmt', ctrl.getTenant);
router.put('/bmt', authorize('admin', 'superadmin'), ctrl.updateTenant);

router.get('/users', authorize('admin', 'superadmin'), ctrl.listUsers);
router.post('/users', authorize('admin', 'superadmin'), ctrl.createUser);
router.put('/users/:id/toggle', authorize('admin', 'superadmin'), ctrl.toggleUserStatus);
router.put('/users/:id/permissions', authorize('admin', 'superadmin'), ctrl.updateUserPermissions);

router.get('/config', authorize('admin', 'superadmin'), ctrl.getSettings);
router.post('/config', authorize('admin', 'superadmin'), ctrl.updateSettings);
router.post('/logo', authorize('admin', 'superadmin'), ctrl.uploadMiddleware, ctrl.uploadLogo);

module.exports = router;
