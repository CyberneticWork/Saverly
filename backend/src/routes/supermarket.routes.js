const router = require('express').Router();
const supermarketCtrl = require('../controllers/supermarket.controller');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { body } = require('express-validator');
const { validate } = require('../utils/validate');

router.get('/', supermarketCtrl.list);
router.get('/nearby', supermarketCtrl.getNearby);
router.get('/:id', supermarketCtrl.getById);
router.get('/:id/prices', supermarketCtrl.getPrices);

// Admin
router.post('/', authenticate, requireAdmin,
  [body('name').trim().notEmpty()],
  validate,
  supermarketCtrl.create
);
router.put('/:id', authenticate, requireAdmin, supermarketCtrl.update);
router.delete('/:id', authenticate, requireAdmin, supermarketCtrl.remove);
router.post('/:id/locations', authenticate, requireAdmin, supermarketCtrl.addLocation);
router.put('/:id/locations/:locationId', authenticate, requireAdmin, supermarketCtrl.updateLocation);

module.exports = router;
