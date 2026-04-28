const router = require('express').Router();
const adminCtrl = require('../controllers/admin.controller');
const categoryCtrl = require('../controllers/category.controller');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.use(authenticate, requireAdmin);

// Dashboard analytics
router.get('/dashboard', adminCtrl.getDashboard);
router.get('/analytics/prices', adminCtrl.priceAnalytics);
router.get('/analytics/users', adminCtrl.userAnalytics);
router.get('/analytics/products', adminCtrl.productAnalytics);

// Users management
router.get('/users', adminCtrl.listUsers);
router.get('/users/:id', adminCtrl.getUser);
router.put('/users/:id', adminCtrl.updateUser);
router.delete('/users/:id', adminCtrl.deleteUser);
router.post('/users/:id/toggle-active', adminCtrl.toggleUserActive);

// Price records
router.get('/prices', adminCtrl.listPrices);
router.get('/reports/export', adminCtrl.exportReport);

// Categories
router.get('/categories', categoryCtrl.list);
router.post('/categories', categoryCtrl.create);
router.put('/categories/:id', categoryCtrl.update);
router.delete('/categories/:id', categoryCtrl.remove);

module.exports = router;
