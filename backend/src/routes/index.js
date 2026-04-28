const express = require('express');
const router = express.Router();

router.use('/auth',          require('./auth.routes'));
router.use('/products',      require('./product.routes'));
router.use('/categories',    require('./category.routes'));
router.use('/supermarkets',  require('./supermarket.routes'));
router.use('/prices',        require('./price.routes'));
router.use('/shopping-lists',require('./shoppingList.routes'));
router.use('/invoices',      require('./invoice.routes'));
router.use('/users',         require('./user.routes'));
router.use('/admin',         require('./admin.routes'));
router.use('/brand',         require('./brand.routes'));

module.exports = router;
