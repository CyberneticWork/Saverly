const router = require('express').Router();
const userCtrl = require('../controllers/user.controller');
const { authenticate } = require('../middleware/auth');
const { upload, uploadTo } = require('../middleware/upload');
const { body } = require('express-validator');
const { validate } = require('../utils/validate');

router.use(authenticate);

router.get('/me', userCtrl.getProfile);
router.put('/me',
  uploadTo('avatars'),
  upload.single('avatar'),
  [body('name').optional().trim().notEmpty()],
  validate,
  userCtrl.updateProfile
);
router.put('/me/password',
  [
    body('currentPassword').notEmpty(),
    body('newPassword').isLength({ min: 8 }).matches(/[A-Z]/).matches(/[0-9]/),
  ],
  validate,
  userCtrl.changePassword
);
router.put('/me/push-token', userCtrl.updatePushToken);

// Notifications
router.get('/me/notifications', userCtrl.getNotifications);
router.patch('/me/notifications/:id/read', userCtrl.markNotificationRead);
router.post('/me/notifications/read-all', userCtrl.markAllNotificationsRead);

// Price alerts
router.get('/me/alerts', userCtrl.getAlerts);
router.post('/me/alerts',
  [body('productId').notEmpty(), body('targetPrice').isFloat({ min: 0 })],
  validate,
  userCtrl.createAlert
);
router.delete('/me/alerts/:id', userCtrl.deleteAlert);

module.exports = router;
