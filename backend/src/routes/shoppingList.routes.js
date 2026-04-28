const router = require('express').Router();
const listCtrl = require('../controllers/shoppingList.controller');
const { authenticate } = require('../middleware/auth');
const { body } = require('express-validator');
const { validate } = require('../utils/validate');

router.use(authenticate);

router.get('/', listCtrl.list);
router.post('/', [body('name').trim().notEmpty()], validate, listCtrl.create);
router.get('/:id', listCtrl.getById);
router.put('/:id', listCtrl.update);
router.delete('/:id', listCtrl.remove);

// Items
router.post('/:id/items',
  [body('productId').notEmpty(), body('quantity').isFloat({ min: 0.01 })],
  validate,
  listCtrl.addItem
);
router.put('/:id/items/:itemId', listCtrl.updateItem);
router.delete('/:id/items/:itemId', listCtrl.removeItem);
router.patch('/:id/items/:itemId/check', listCtrl.toggleCheck);

// Optimise — find cheapest store combination
router.get('/:id/optimize', listCtrl.optimize);

module.exports = router;
