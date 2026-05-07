const { PrismaClient } = require('@prisma/client');
const { createError } = require('../middleware/errorHandler');
const ocrService = require('../services/ocr.service');
const path = require('path');

const prisma = new PrismaClient();

function withOcrProvider(invoice) {
  if (!invoice) return invoice;
  const provider = invoice.parsedData?._ocrProvider || null;
  return { ...invoice, ocrProvider: provider };
}

exports.scan = async (req, res, next) => {
  try {
    if (!req.file) return next(createError(400, 'Invoice image is required.'));

    const imageUrl = `/uploads/invoices/${req.file.filename}`;
    const imagePath = req.file.path;

    // Create invoice record
    const invoice = await prisma.invoice.create({
      data: {
        userId: req.user.id,
        imageUrl,
        status: 'PROCESSING',
      },
    });

    // Run OCR asynchronously (update DB when done)
    processOCR(invoice.id, imagePath).catch(err => {
      console.error('OCR processing error:', err);
    });

    res.status(202).json({
      success: true,
      message: 'Invoice uploaded and being processed. Please wait.',
      data: { invoiceId: invoice.id },
    });
  } catch (err) { next(err); }
};

/**
 * Run OCR, parse results, update the invoice record.
 */
async function processOCR(invoiceId, imagePath) {
  try {
    const { rawText, parsed, provider } = await ocrService.extractInvoiceData(imagePath);
    const parsedData = { ...parsed, _ocrProvider: provider || null };

    // MySQL contains is case-insensitive by default; no `mode` needed
    const supermarket = parsed.storeName
      ? await prisma.supermarket.findFirst({
          where: { name: { contains: parsed.storeName } },
        })
      : null;

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        rawOcrText: rawText,
        parsedData,
        status: 'REVIEW',
        supermarketId: supermarket?.id || null,
        invoiceDate: parsed.date ? new Date(parsed.date) : null,
        totalAmount: parsed.total || null,
        processedAt: new Date(),
      },
    });

    // Create invoice items
    if (parsed.items && parsed.items.length > 0) {
      await prisma.invoiceItem.createMany({
        data: parsed.items.map(item => ({
          invoiceId,
          productName: item.name,
          quantity: item.quantity || 1,
          unitPrice: item.unitPrice || 0,
          totalPrice: item.totalPrice || item.unitPrice || 0,
          unit: item.unit || null,
        })),
      });
    }
  } catch (err) {
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: 'REVIEW', processedAt: new Date() },
    }).catch(() => {});
    throw err;
  }
}

/**
 * POST /invoices/scan-text
 * Accepts raw OCR text extracted on the mobile device (no image upload).
 * Parses the text server-side with Gemini, saves to DB, returns invoiceId.
 */
exports.scanFromText = async (req, res, next) => {
  try {
    const { ocrText } = req.body;
    if (!ocrText || typeof ocrText !== 'string' || ocrText.trim().length < 10) {
      return next(createError(400, 'ocrText is required and must be a non-empty string.'));
    }

    const invoice = await prisma.invoice.create({
      data: { userId: req.user.id, imageUrl: '', status: 'PROCESSING' },
    });

    processTextOCR(invoice.id, ocrText.trim()).catch(err => {
      console.error('Text OCR processing error:', err);
    });

    res.status(202).json({
      success: true,
      message: 'Receipt text received and being processed.',
      data: { invoiceId: invoice.id },
    });
  } catch (err) { next(err); }
};

async function processTextOCR(invoiceId, rawText) {
  try {
    const parsed = await ocrService.extractItemsFromText(rawText);

    const supermarket = parsed.storeName
      ? await prisma.supermarket.findFirst({
          where: { name: { contains: parsed.storeName } },
        })
      : null;

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        rawOcrText: rawText,
        parsedData: { ...parsed, _ocrProvider: 'gemini-text' },
        status: 'REVIEW',
        supermarketId: supermarket?.id || null,
        invoiceDate: parsed.date ? new Date(parsed.date) : null,
        totalAmount: parsed.total || null,
        processedAt: new Date(),
      },
    });

    if (parsed.items && parsed.items.length > 0) {
      await prisma.invoiceItem.createMany({
        data: parsed.items.map(item => ({
          invoiceId,
          productName: item.name,
          quantity: item.quantity || 1,
          unitPrice: item.unitPrice || 0,
          totalPrice: item.totalPrice || item.unitPrice || 0,
          unit: item.unit || null,
        })),
      });
    }
  } catch (err) {
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: 'REVIEW', processedAt: new Date() },
    }).catch(() => {});
    throw err;
  }
}

exports.list = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where: {
          userId: req.user.id,
          ...(status && { status }),
        },
        include: {
          supermarket: { select: { id: true, name: true, logoUrl: true } },
          _count: { select: { items: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.invoice.count({ where: { userId: req.user.id, ...(status && { status }) } }),
    ]);

    res.json({
      success: true,
      data: invoices.map(withOcrProvider),
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (err) { next(err); }
};

exports.getById = async (req, res, next) => {
  try {
    const invoice = await prisma.invoice.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      include: {
        supermarket: { select: { id: true, name: true, logoUrl: true } },
        items: {
          include: { product: { select: { id: true, name: true } } },
        },
      },
    });
    if (!invoice) return next(createError(404, 'Invoice not found.'));
    res.json({ success: true, data: withOcrProvider(invoice) });
  } catch (err) { next(err); }
};

/**
 * User confirms extracted data (after review).
 */
exports.confirm = async (req, res, next) => {
  try {
    const { supermarketId, invoiceDate, items } = req.body;

    const invoice = await prisma.invoice.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!invoice) return next(createError(404, 'Invoice not found.'));
    if (invoice.status === 'VERIFIED') {
      return next(createError(409, 'Invoice already verified.'));
    }

    // Update invoice
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        supermarketId,
        invoiceDate: invoiceDate ? new Date(invoiceDate) : invoice.invoiceDate,
        status: 'REVIEW', // Goes to admin for final verification
      },
    });

    // Update invoice items with user corrections + link products
    if (Array.isArray(items)) {
      for (const item of items) {
        if (item.id) {
          await prisma.invoiceItem.update({
            where: { id: item.id },
            data: {
              productName: item.productName,
              quantity: parseFloat(item.quantity) || 1,
              unitPrice: parseFloat(item.unitPrice) || 0,
              totalPrice: parseFloat(item.totalPrice) || 0,
              unit: item.unit,
              productId: item.productId || null,
              isConfirmed: true,
            },
          });
        }
      }
    }

    res.json({ success: true, message: 'Invoice confirmed and submitted for verification.' });
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    const invoice = await prisma.invoice.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!invoice) return next(createError(404, 'Invoice not found.'));
    if (invoice.status === 'VERIFIED') {
      return next(createError(409, 'Cannot delete a verified invoice.'));
    }

    await prisma.invoice.delete({ where: { id: invoice.id } });
    res.json({ success: true, message: 'Invoice deleted.' });
  } catch (err) { next(err); }
};

exports.adminList = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where: { ...(status && { status }) },
        include: {
          user: { select: { id: true, name: true, email: true } },
          supermarket: { select: { id: true, name: true } },
          items: {
            take: 40,
            orderBy: { id: 'asc' },
            select: {
              id: true,
              productName: true,
              quantity: true,
              unitPrice: true,
              totalPrice: true,
              unit: true,
            },
          },
          _count: { select: { items: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.invoice.count({ where: { ...(status && { status }) } }),
    ]);

    res.json({
      success: true,
      data: invoices.map(withOcrProvider),
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (err) { next(err); }
};

exports.verify = async (req, res, next) => {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      include: { items: { where: { isConfirmed: true, productId: { not: null } } } },
    });
    if (!invoice) return next(createError(404, 'Invoice not found.'));

    // Create price records from verified invoice items
    if (invoice.supermarketId && invoice.items.length > 0) {
      const priceRecords = invoice.items
        .filter(item => item.productId && item.unitPrice > 0)
        .map(item => ({
          productId: item.productId,
          supermarketId: invoice.supermarketId,
          price: item.unitPrice,
          unit: item.unit || 'unit',
          source: 'invoice',
          invoiceId: invoice.id,
          isVerified: true,
          recordedAt: invoice.invoiceDate || new Date(),
        }));

      if (priceRecords.length > 0) {
        await prisma.price.createMany({ data: priceRecords });
      }
    }

    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status: 'VERIFIED',
        verifiedAt: new Date(),
        verifiedBy: req.user.id,
      },
    });

    // Notify submitting user
    await prisma.notification.create({
      data: {
        userId: invoice.userId,
        title: 'âœ… Invoice Verified',
        body: 'Your invoice has been verified and price data has been updated. Thank you!',
        type: 'INVOICE_VERIFIED',
        data: { invoiceId: invoice.id },
      },
    });

    res.json({ success: true, message: 'Invoice verified and prices updated.' });
  } catch (err) { next(err); }
};

exports.reject = async (req, res, next) => {
  try {
    const { reason } = req.body;
    await prisma.invoice.update({
      where: { id: req.params.id },
      data: {
        status: 'REJECTED',
        rejectedReason: reason || 'Invoice could not be verified.',
        verifiedAt: new Date(),
        verifiedBy: req.user.id,
      },
    });

    const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id } });
    await prisma.notification.create({
      data: {
        userId: invoice.userId,
        title: 'âŒ Invoice Rejected',
        body: `Your invoice was rejected: ${reason || 'Could not be verified.'}`,
        type: 'SYSTEM',
        data: { invoiceId: invoice.id },
      },
    });

    res.json({ success: true, message: 'Invoice rejected.' });
  } catch (err) { next(err); }
};

/**
 * Admin: Update a single invoice item (e.g. correct OCR product name, price).
 */
exports.updateInvoiceItem = async (req, res, next) => {
  try {
    const { id: invoiceId, itemId } = req.params;
    const { productName, quantity, unitPrice, totalPrice, unit } = req.body;

    const item = await prisma.invoiceItem.findFirst({
      where: { id: itemId, invoiceId },
    });
    if (!item) return next(createError(404, 'Invoice item not found.'));

    const updated = await prisma.invoiceItem.update({
      where: { id: itemId },
      data: {
        ...(productName !== undefined && { productName: String(productName).trim() }),
        ...(quantity !== undefined && { quantity: parseFloat(quantity) || item.quantity }),
        ...(unitPrice !== undefined && { unitPrice: parseFloat(unitPrice) || item.unitPrice }),
        ...(totalPrice !== undefined && { totalPrice: parseFloat(totalPrice) || item.totalPrice }),
        ...(unit !== undefined && { unit: String(unit).trim() || null }),
      },
    });

    res.json({ success: true, data: updated, message: 'Item updated.' });
  } catch (err) { next(err); }
};

/**
 * Scan a plain shopping list image using OCR and return extracted text/items
 * WITHOUT creating an invoice record.  Used by the mobile ShoppingListScanScreen.
 */
exports.scanList = async (req, res, next) => {
  try {
    if (!req.file) return next(createError(400, 'Image is required.'));

    const { rawText, parsed, provider } = await ocrService.extractInvoiceData(req.file.path);

    // Also include raw lines so the mobile client can do its own parsing
    const rawLines = rawText
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length >= 2 && /[a-zA-Z]{2,}/.test(l));

    res.json({
      success: true,
      data: {
        rawText,
        ocrProvider: provider || null,
        rawLines,
        items: (parsed.items || []).map(i => ({ name: i.name })),
      },
    });
  } catch (err) { next(err); }
};

/**
 * Transcribe an audio file to text for voice search.
 * Uses Google Cloud Speech-to-Text if configured; otherwise returns empty.
 */
exports.voiceSearch = async (req, res, next) => {
  try {
    if (!req.file) return next(createError(400, 'Audio file is required.'));

    let transcript = '';

    if (process.env.GOOGLE_CLOUD_VISION_KEY) {
      // Reuse the Google Cloud Vision key for Speech-to-Text API
      try {
        const fs = require('fs');
        const axios = require('axios');
        const audioContent = fs.readFileSync(req.file.path).toString('base64');
        const response = await axios.post(
          `https://speech.googleapis.com/v1/speech:recognize?key=${process.env.GOOGLE_CLOUD_VISION_KEY}`,
          {
            config: {
              encoding: 'MP4', sampleRateHertz: 44100, languageCode: 'en-LK',
              alternativeLanguageCodes: ['en-IN', 'en-US', 'si-LK'],
              enableAutomaticPunctuation: false,
            },
            audio: { content: audioContent },
          },
          { timeout: 10000 }
        );
        transcript = response.data?.results?.[0]?.alternatives?.[0]?.transcript || '';
      } catch (speechErr) {
        console.warn('Speech-to-text failed:', speechErr.message);
      }
    }

    // Clean up temp audio file
    try { require('fs').unlinkSync(req.file.path); } catch (_) {}

    res.json({ success: true, text: transcript });
  } catch (err) { next(err); }
};
