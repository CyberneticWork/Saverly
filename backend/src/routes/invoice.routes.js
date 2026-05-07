const router = require('express').Router();
const invoiceCtrl = require('../controllers/invoice.controller');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { upload, uploadTo } = require('../middleware/upload');

router.use(authenticate);

// User routes
router.post('/scan',
  uploadTo('invoices'),
  upload.single('invoice'),
  invoiceCtrl.scan
);
// New: receive raw OCR text from mobile device (no image upload)
router.post('/scan-text', invoiceCtrl.scanFromText);
// Best: receive pre-parsed structured JSON from Gemini Vision on mobile (no server OCR)
router.post('/scan-structured', invoiceCtrl.scanStructured);
// Scan a plain shopping list image (no user invoice record created)
router.post('/scan-list',
  uploadTo('invoices'),
  upload.single('invoice'),
  invoiceCtrl.scanList
);
// Voice search transcription
router.post('/voice-search',
  upload.single('audio'),
  invoiceCtrl.voiceSearch
);
router.get('/', invoiceCtrl.list);
router.get('/:id', invoiceCtrl.getById);
router.put('/:id/confirm', invoiceCtrl.confirm);
router.delete('/:id', invoiceCtrl.remove);

// Admin routes
router.get('/admin/all', requireAdmin, invoiceCtrl.adminList);
router.put('/admin/:id/verify', requireAdmin, invoiceCtrl.verify);
router.put('/admin/:id/reject', requireAdmin, invoiceCtrl.reject);
router.put('/admin/:id/items/:itemId', requireAdmin, invoiceCtrl.updateInvoiceItem);

module.exports = router;
