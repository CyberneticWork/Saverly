const router = require('express').Router();
const priceCtrl = require('../controllers/price.controller');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { body } = require('express-validator');
const { validate } = require('../utils/validate');

// Public
router.get('/compare', priceCtrl.compare);

// Admin
router.post('/',
  authenticate, requireAdmin,
  [
    body('productId').notEmpty(),
    body('supermarketId').notEmpty(),
    body('price').isFloat({ min: 0 }),
  ],
  validate,
  priceCtrl.create
);
router.put('/:id', authenticate, requireAdmin, priceCtrl.update);
router.delete('/:id', authenticate, requireAdmin, priceCtrl.remove);
router.post('/bulk', authenticate, requireAdmin, priceCtrl.bulkCreate);

module.exports = router;
