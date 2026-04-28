const router = require('express').Router();
const categoryCtrl = require('../controllers/category.controller');

router.get('/', categoryCtrl.list);
router.get('/:id', categoryCtrl.getById);

module.exports = router;
