const router = require('express').Router();
const productCtrl = require('../controllers/product.controller');
const { authenticate, requireAdmin, optionalAuth } = require('../middleware/auth');
const { upload, uploadTo } = require('../middleware/upload');
const { body, query } = require('express-validator');
const { validate } = require('../utils/validate');

// Public
router.get('/', optionalAuth, productCtrl.list);
router.get('/search', productCtrl.search);
router.get('/:id', optionalAuth, productCtrl.getById);
router.get('/:id/prices', productCtrl.getPrices);
router.get('/:id/history', productCtrl.getPriceHistory);
router.get('/:id/cheapest', productCtrl.getCheapest);

// Authenticated
router.post('/:id/favourite', authenticate, productCtrl.toggleFavourite);
router.get('/me/favourites', authenticate, productCtrl.getFavourites);

// Admin
router.post('/', authenticate, requireAdmin, uploadTo('products'), upload.single('image'),
  [
    body('name').trim().notEmpty(),
    body('categoryId').notEmpty(),
    body('defaultUnit').notEmpty(),
  ],
  validate,
  productCtrl.create
);
router.put('/:id', authenticate, requireAdmin, uploadTo('products'), upload.single('image'), productCtrl.update);
router.delete('/:id', authenticate, requireAdmin, productCtrl.remove);

module.exports = router;
