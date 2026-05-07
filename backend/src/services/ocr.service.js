/**
 * OCR Service — Sri Lanka Invoice / Bill Parser
 * ==============================================
 * Handles a wide range of real Sri Lankan invoice formats:
 *
 *  Format A  — Cargills / Keells two-line:
 *              Line 1: [rowNum] PRODUCT NAME
 *              Line 2: [*] BARCODE  qty.000  unitPrice  totalPrice
 *
 *  Format B  — Single-line with code prefix:
 *              DY40928  NEWDALE YOGHURT  1.000  560.00  560.00
 *
 *  Format C  — Columnar (QTY first):
 *              [prefix]  QTY  UNIT_PRICE  [DISC]  TOTAL
 *              Name is found on the preceding line
 *
 *  Format D  — Compact single-line (row# + name + qty + price + amount):
 *              1  RICE 5KG  1  2500.00  2500.00
 *
 *  Format E  — Two-line split:
 *              GARLIC 1KG
 *                4  820.00  820.00
 *
 *  Format F  — Simple trailing price (pharmacy / hardware):
 *              AMOXICILLIN 500MG     45.00
 *
 *  Format G  — Invoice with detected header row, column-guided parsing.
 */

const Tesseract = require('tesseract.js');
const path = require('path');
const sharp = require('sharp');
const fs = require('fs');
const os = require('os');
const axios = require('axios');
const { logger } = require('../utils/logger');

// ─────────────────────────────────────────────────────────────────────────────
// ENTRY POINT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract grocery invoice data using OCR.
 * Returns: { rawText, parsed: { storeName, date, items, subtotal, tax, total }, provider }
 */
async function extractInvoiceData(imagePath) {
  logger.info(`OCR processing: ${imagePath}`);

  let rawText = '';
  let provider = 'tesseract';

  try {
    if (process.env.CROMP_OCR_API_URL) {
      provider = 'external-api';
      rawText = await extractWithCrompApi(imagePath);
    } else if (process.env.GEMINI_API_KEY) {
      provider = 'gemini';
      rawText = await extractWithGemini(imagePath);
    } else if (process.env.GOOGLE_CLOUD_VISION_KEY) {
      provider = 'google-vision';
      rawText = await extractWithGoogleVision(imagePath);
    } else {
      provider = 'tesseract';
      rawText = await extractWithTesseract(imagePath);
    }
  } catch (err) {
    logger.warn('Primary OCR failed, falling back to Tesseract:', err.message);
    provider = 'tesseract';
    rawText = await extractWithTesseract(imagePath);
  }

  // If Gemini returned structured JSON, use it directly without regex parsing
  if (provider === 'gemini') {
    try {
      const jsonStr = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
      const structured = JSON.parse(jsonStr);
      if (structured._geminiStructured && Array.isArray(structured.items)) {
        logger.info(`Gemini structured parse: ${structured.items.length} items`);
        const parsed = {
          storeName: structured.storeName || null,
          date: structured.date || null,
          items: structured.items.map(item => ({
            name: String(item.name || '').trim(),
            quantity: Number(item.quantity) || 1,
            unitPrice: Number(item.unitPrice) || 0,
            totalPrice: Number(item.totalPrice) || Number(item.unitPrice) || 0,
            unit: item.unit || null,
          })).filter(item => item.name.length >= 2), // keep all named items; user can fix prices
          subtotal: Number(structured.subtotal) || null,
          tax: Number(structured.tax) || null,
          total: Number(structured.total) || null,
        };
        return { rawText: jsonStr, parsed, provider };
      }
    } catch (_) {
      // Not valid JSON — fall through to regex parser below
    }
  }

  logger.info(`OCR raw text (${rawText.length} chars):\n${rawText}`);
  const parsed = parseReceiptText(rawText);
  logger.info(`OCR provider ${provider}, parsed ${parsed.items.length} items`);
  return { rawText, parsed, provider };
}

/**
 * Gemini OCR via Google Generative Language API.
 * Returns structured JSON with store info and line items directly — avoids
 * fragile regex parsing on noisy receipt text.
 */
async function extractWithGemini(imagePath) {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash-lite';
  const timeoutMs = parseInt(process.env.GEMINI_TIMEOUT_MS || '45000', 10);

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is required for Gemini OCR');
  }

  // ── Resize image before encoding ──────────────────────────────────────────
  // Phone camera photos can be 10-15 MB. Loading them fully into RAM as base64
  // (~20 MB string) causes OOM on small VPS instances and crashes the server.
  // Gemini only needs ~1600 px on the long edge to read receipt text accurately.
  let imageBase64;
  let mimeType = 'image/jpeg';
  const tmpResized = path.join(os.tmpdir(), `gemini_resize_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`);
  let usedTmp = false;

  try {
    await sharp(imagePath)
      .rotate()                          // auto-rotate from EXIF
      .resize({ width: 1600, height: 2400, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 88 })
      .toFile(tmpResized);
    imageBase64 = fs.readFileSync(tmpResized).toString('base64');
    mimeType = 'image/jpeg';
    usedTmp = true;
  } catch (resizeErr) {
    logger.warn('Gemini image resize failed, using original:', resizeErr.message);
    imageBase64 = fs.readFileSync(imagePath).toString('base64');
    // Detect MIME from original
    try {
      const meta = await sharp(imagePath).metadata();
      if (meta.format === 'png') mimeType = 'image/png';
      else if (meta.format === 'webp') mimeType = 'image/webp';
    } catch (_) { /* keep jpeg */ }
  } finally {
    if (usedTmp) { try { fs.unlinkSync(tmpResized); } catch (_) {} }
  }

  const prompt = `You are an expert parser for Sri Lankan bills, invoices and receipts of ANY format — thermal receipts, A4/B5 printed invoices, handwritten bills, supermarket printouts, pharmacy bills, hardware store receipts, restaurant bills, utility bills, or any other purchase document.
Analyse the document image and extract all purchased items/services, store details, date and totals.

Return ONLY valid JSON in this exact format (no markdown, no extra text, no code fences):
{
  "storeName": "shop/company name or null",
  "date": "YYYY-MM-DD or null",
  "items": [
    { "name": "product or service name", "quantity": 1, "unitPrice": 0.00, "totalPrice": 0.00, "unit": "unit or null" }
  ],
  "subtotal": 0.00,
  "tax": 0.00,
  "total": 0.00
}

Rules:
- Include EVERY purchased item or service line visible on the document.
- Skip non-item lines only: grand total, subtotal, VAT/NBT/tax summary, discount summary, cash tendered, change, rounding, loyalty points.
- NEVER use null for numeric fields — always use 0 if unknown.
- Use null only for string fields (storeName, date, unit) when not visible.
- quantity defaults to 1 if not shown.
- unitPrice: price per single unit. totalPrice: quantity x unitPrice. If only one price shown, use it for both.
- All prices are plain numbers in LKR without currency symbol.
- Item names in English; transliterate or translate Sinhala/Tamil names.
- For service invoices (repairs, medical, etc.), treat each service line as an item.
- If a price is partially visible or unclear, make your best estimate rather than returning 0.`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  // ── Call Gemini with retry on 503 / 429 ────────────────────────────────────
  let response;
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      response = await axios.post(
        url,
        {
          contents: [
            {
              parts: [
                { text: prompt },
                { inline_data: { mime_type: mimeType, data: imageBase64 } },
              ],
            },
          ],
          generationConfig: { temperature: 0, topP: 1 },
        },
        {
          timeout: Number.isFinite(timeoutMs) ? timeoutMs : 45000,
          headers: { 'Content-Type': 'application/json' },
        }
      );
      break; // success
    } catch (err) {
      const status = err?.response?.status;
      if ((status === 503 || status === 429) && attempt < maxAttempts) {
        const delay = attempt * 3000; // 3s, 6s
        logger.warn(`Gemini returned ${status}, retrying in ${delay}ms (attempt ${attempt}/${maxAttempts})`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw err; // rethrow after max retries or non-retriable error
    }
  }

  const parts = response?.data?.candidates?.[0]?.content?.parts || [];
  const raw = parts
    .map(p => (typeof p?.text === 'string' ? p.text : ''))
    .join('\n')
    .trim();

  if (!raw) throw new Error('Gemini OCR returned empty response');

  // Strip markdown code fences if model wraps output anyway
  const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();

  let parsed;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    // Gemini returned plain text rather than JSON — fall back to text path
    logger.warn('Gemini did not return valid JSON, using raw text for regex parsing');
    return raw;
  }

  // Attach structured data for direct use in processOCR so regex parser is bypassed
  parsed._geminiStructured = true;
  return JSON.stringify(parsed);
}

/**
 * Optional external OCR provider (Cromp/API-compatible endpoint).
 * Expected response can contain OCR text in one of these locations:
 *   - response.data.rawText
 *   - response.data.text
 *   - response.data.ocrText
 *   - custom path via CROMP_OCR_TEXT_PATH (dot notation)
 */
async function extractWithCrompApi(imagePath) {
  const endpoint = process.env.CROMP_OCR_API_URL;
  const timeoutMs = parseInt(process.env.CROMP_OCR_TIMEOUT_MS || '30000', 10);
  const imageField = process.env.CROMP_OCR_IMAGE_FIELD || 'imageBase64';
  const textPath = process.env.CROMP_OCR_TEXT_PATH || '';

  if (!endpoint) {
    throw new Error('CROMP_OCR_API_URL is required for external OCR provider');
  }

  const headers = { 'Content-Type': 'application/json' };

  if (process.env.CROMP_OCR_API_KEY) {
    headers['x-api-key'] = process.env.CROMP_OCR_API_KEY;
  }
  if (process.env.CROMP_OCR_BEARER_TOKEN) {
    headers.Authorization = `Bearer ${process.env.CROMP_OCR_BEARER_TOKEN}`;
  }

  const imageBase64 = fs.readFileSync(imagePath).toString('base64');
  const body = {
    fileName: path.basename(imagePath),
    mimeType: 'image/jpeg',
    [imageField]: imageBase64,
  };

  const response = await axios.post(endpoint, body, {
    headers,
    timeout: Number.isFinite(timeoutMs) ? timeoutMs : 30000,
  });

  const payload = response?.data;
  const fromKnownKeys = payload?.rawText || payload?.text || payload?.ocrText;
  const fromCustomPath = textPath ? getByPath(payload, textPath) : null;
  const rawText = String(fromCustomPath || fromKnownKeys || '').trim();

  if (!rawText) {
    throw new Error('External OCR returned no text in response');
  }

  return rawText;
}

function getByPath(obj, dotPath) {
  if (!obj || !dotPath) return null;
  return dotPath.split('.').reduce((acc, part) => {
    if (acc && Object.prototype.hasOwnProperty.call(acc, part)) return acc[part];
    return null;
  }, obj);
}

/**
 * Run Tesseract OCR optimised for receipts.
 * Preprocesses the image: grayscale + sharpen + high contrast for better accuracy.
 * Also upscales small images so Tesseract has enough detail.
 */
async function extractWithTesseract(imagePath) {
  // Determine if upscaling is needed
  let needsUpscale = false;
  try {
    const meta = await sharp(imagePath).metadata();
    const minDim = Math.min(meta.width || 0, meta.height || 0);
    needsUpscale = minDim < 1000; // upscale if smaller than 1000px on shortest side
  } catch (_) {}

  const upscale = img => needsUpscale ? img.resize({ width: 1600, withoutEnlargement: false }) : img;

  // Multi-pass OCR: try multiple preprocess profiles and choose the best parse score.
  const variants = [
    {
      name: 'balanced',
      psm: '6',
      preprocess: img => upscale(img)
        .rotate()
        .grayscale()
        .normalize()
        .sharpen({ sigma: 1.5, m1: 0.5, m2: 2 }),
    },
    {
      name: 'high-contrast',
      psm: '4',
      preprocess: img => upscale(img)
        .rotate()
        .grayscale()
        .normalize()
        .linear(1.4, -30)
        .sharpen({ sigma: 2.0, m1: 0.8, m2: 2.5 }),
    },
    {
      name: 'binarized',
      psm: '11',
      preprocess: img => upscale(img)
        .rotate()
        .grayscale()
        .threshold(140)
        .median(1),
    },
  ];

  const attempts = [];

  for (const variant of variants) {
    const tmpPath = path.join(os.tmpdir(), `ocr_${variant.name}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`);
    try {
      await variant.preprocess(sharp(imagePath))
        .png({ compressionLevel: 1 })
        .toFile(tmpPath);
    } catch (e) {
      logger.warn(`OCR preprocess failed (${variant.name}), using original image:`, e.message);
      try {
        fs.copyFileSync(imagePath, tmpPath);
      } catch (copyErr) {
        logger.warn(`OCR fallback copy failed (${variant.name}):`, copyErr.message);
        continue;
      }
    }

    try {
      const { data: { text } } = await Tesseract.recognize(tmpPath, 'eng+sin', {
        logger: m => {
          if (m.status === 'recognizing text') {
            logger.debug(`OCR progress (${variant.name}): ${Math.round(m.progress * 100)}%`);
          }
        },
        langPath: path.join(__dirname, '../../'), // use bundled eng.traineddata + sin.traineddata
        tessedit_pageseg_mode: variant.psm,
        preserve_interword_spaces: '1',
      });

      const parsed = parseReceiptText(text);
      const score = scoreParsedCandidate(parsed);
      attempts.push({ name: variant.name, text, parsed, score });
      logger.info(`OCR variant ${variant.name}: ${parsed.items.length} items, score ${score}`);
    } catch (ocrErr) {
      logger.warn(`OCR recognize failed (${variant.name}):`, ocrErr.message);
    } finally {
      try { fs.unlinkSync(tmpPath); } catch (_) {}
    }
  }

  if (attempts.length === 0) {
    throw new Error('All OCR variants failed to produce text');
  }

  attempts.sort((a, b) => b.score - a.score);
  const best = attempts[0];
  logger.info(`OCR selected variant: ${best.name} (score ${best.score})`);
  return best.text;
}

/**
 * Google Cloud Vision OCR (optional, more accurate).
 */
async function extractWithGoogleVision(imagePath) {
  const imageContent = fs.readFileSync(imagePath).toString('base64');
  const response = await axios.post(
    `https://vision.googleapis.com/v1/images:annotate?key=${process.env.GOOGLE_CLOUD_VISION_KEY}`,
    {
      requests: [{
        image: { content: imageContent },
        features: [{ type: 'TEXT_DETECTION' }],
      }],
    }
  );

  return response.data.responses[0]?.fullTextAnnotation?.text || '';
}

// ─────────────────────────────────────────────────────────────────────────────
// GLOBAL CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lines that are summary/footer — not product items.
 * Matched case-insensitively at the start of the trimmed line.
 */
const SUMMARY_RE = /^\s*(?:grand\s*)?(?:total|amount\s*(?:due|payable)|net\s*(?:total|amount|payable)|sub[\s-]?total|balance(?:\s*due)?|tax(?:\s*amount)?|gst|vat|cess|nbt|service\s*charge|change(?:\s*due)?|cash(?:\s*tender(?:ed)?)?|card(?:\s*payment)?|saving[s]?(?:\s*total)?|discount(?:\s*total)?|member\s*sav|rounding|thank|cashier|serv(?:ed\s*by|ice)|op(?:erator)?\s*(?:no|#)|tran(?:saction)?\s*(?:no|#|ref)?|receipt\s*(?:no|#)?|invoice\s*(?:no|#)?|bill\s*(?:no|#)?|store|branch|contact|phone(?:\s*no)?|tel[.:\s]|fax|e?-?mail|www\.|http|page\s*\d|payment\s*method|paid\s*by)\b/i;

/**
 * Lines that are column headers — not product lines.
 * Also used to detect which parsing strategy to prefer.
 */
const HEADER_RE = /\b(?:description|product\s*name|item\s*name|item\s*code|qty|quantity|unit\s*price|sell\s*price|per\s*unit|rate|amount|value|disc(?:ount)?|free\s*issue|batch)\b/i;
const HEADER_TOKEN_RE = /\b(?:description|product|item|code|qty|quantity|unit|price|sell|per|rate|amount|value|discount|disc|free|issue|batch)\b/ig;

/** Lines that are pure visual separators (dashes, equals, underscores, stars). */
const SEPARATOR_RE = /^[\s\-=_*|#.]{3,}$/;

/**
 * Token that looks like an alphanumeric product/barcode code:
 *   BV11530, DY40928, VG01088, CSE0472, AMOX500, 0123456789012 (EAN-13)
 */
const CODE_TOKEN_RE = /^(?:[A-Z]{1,5}\d{3,10}|\d{6,13})$/i;

// ─────────────────────────────────────────────────────────────────────────────
// NUMBER HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse a raw string token to a number.
 * Handles:  "1,234.56"  "1234.56"  "1,234"  "Rs.350.00"  "LKR 350"  "3,49" (European)
 */
function parseNum(str) {
  if (!str && str !== 0) return null;
  const s = String(str)
    .trim()
    .replace(/^(?:rs\.?|lkr\.?)\s*/i, '')  // strip currency prefix
    .replace(/\s/g, '');

  // European decimal comma: "3,49" (2-digit after comma at end) → "3.49"
  // But "1,234" is thousands separator → "1234"
  // Heuristic: if comma is followed by exactly 1-2 digits at end → decimal
  const europeanDec = s.replace(/,(\d{1,2})$/, '.$1');
  const noThousands = europeanDec.replace(/,/g, '');
  const v = parseFloat(noThousands);
  return isNaN(v) ? null : v;
}

/**
 * Parse a price value. Returns null if ≤ 0 or unreasonably large (≥ 1,000,000).
 */
function parsePrice(str) {
  const v = parseNum(str);
  return v === null || v <= 0 || v >= 1_000_000 ? null : v;
}

/**
 * Extract every numeric token from a string, left-to-right.
 * Tokens like "2.000" (qty), "560.00" (price) are both captured.
 */
function extractAllNumbers(str) {
  const tokens = str.match(/[\d,]+(?:\.\d{1,3})?/g) || [];
  return tokens.map(t => parseNum(t)).filter(n => n !== null);
}

/**
 * Given an array of numbers on a receipt line, try every permutation to find
 * a (qty, unitPrice, totalPrice) triple where qty × unitPrice ≈ totalPrice.
 * Tolerance: 5% or Rs 1 (for rounding).
 *
 * Also handles:
 *  - discount: qty × unitPrice - discount ≈ totalPrice
 *  - qty implied = 1: unitPrice ≈ totalPrice
 *
 * Returns the best match or null.
 */
function resolvePriceSet(nums) {
  if (!nums || nums.length === 0) return null;

  // Deduplicate and filter junk
  const candidates = [...new Set(nums)].filter(n => n > 0);
  if (candidates.length === 0) return null;

  // Tolerance checker
  const approxEq = (a, b) => Math.abs(a - b) <= Math.max(1, b * 0.05);

  // Try all ordered triples (qi, ui, ti) — qty, unitPrice, total
  for (let q = 0; q < candidates.length; q++) {
    for (let u = 0; u < candidates.length; u++) {
      if (u === q) continue;
      for (let t = 0; t < candidates.length; t++) {
        if (t === q || t === u) continue;
        const qty = candidates[q];
        const unit = candidates[u];
        const total = candidates[t];
        // Reasonable ranges
        if (qty < 0.001 || qty > 9999) continue;
        if (unit < 0.01 || unit > 500_000) continue;
        if (total < 0.01) continue;
        if (approxEq(qty * unit, total)) {
          return { quantity: qty, unitPrice: unit, totalPrice: total };
        }
      }
    }
  }

  // Try (qty, unitPrice, discount, total) quadruples
  for (let q = 0; q < candidates.length; q++) {
    for (let u = 0; u < candidates.length; u++) {
      if (u === q) continue;
      for (let d = 0; d < candidates.length; d++) {
        if (d === q || d === u) continue;
        for (let t = 0; t < candidates.length; t++) {
          if (t === q || t === u || t === d) continue;
          const qty = candidates[q];
          const unit = candidates[u];
          const disc = candidates[d];
          const total = candidates[t];
          if (qty < 0.001 || qty > 9999) continue;
          if (unit < 0.01) continue;
          if (disc < 0 || disc > unit * qty) continue;
          if (total < 0.01) continue;
          if (approxEq(qty * unit - disc, total)) {
            return { quantity: qty, unitPrice: unit, discount: disc, totalPrice: total };
          }
        }
      }
    }
  }

  // Fallback: find any pair where unitPrice ≈ totalPrice (qty = 1)
  for (let u = 0; u < candidates.length; u++) {
    for (let t = 0; t < candidates.length; t++) {
      if (u === t) continue;
      if (approxEq(candidates[u], candidates[t])) {
        const unit = Math.min(candidates[u], candidates[t]);
        const total = Math.max(candidates[u], candidates[t]);
        return { quantity: 1, unitPrice: unit, totalPrice: total };
      }
    }
  }

  // Last resort: use largest number as total, second-largest as unit price
  const sorted = [...candidates].sort((a, b) => b - a);
  if (sorted.length >= 2) {
    return { quantity: 1, unitPrice: sorted[1], totalPrice: sorted[0] };
  }
  if (sorted.length === 1) {
    return { quantity: 1, unitPrice: sorted[0], totalPrice: sorted[0] };
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// NAME HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Clean a raw text fragment into a product name.
 *  - Strip OCR noise characters
 *  - Strip leading row numbers, leading codes
 *  - Strip trailing punctuation
 *  - Limit to 80 characters
 *  - Reject names that are clearly OCR noise (single letters, codes, etc.)
 */
function cleanName(raw) {
  if (!raw) return '';
  let name = raw
    .replace(/[|\\*#@$%^&\[\](){}]/g, ' ')   // noise chars → space
    .replace(/\s{2,}/g, ' ')
    .trim()
    .replace(/^[\d]+\s+/, '')                  // strip leading row number (e.g. "3 RICE" → "RICE")
    .replace(/^(?:[A-Za-z]{1,2}\s+){1,3}(?=[A-Za-z]{3,})/, '') // strip noisy short prefixes like "Sa " / "L " / "K T "
    .replace(/^[A-Z]{1,5}\d{3,10}\s+/i, '')   // strip leading barcode/code token
    .replace(/^[\s.,:;/\-_]+/, '')             // strip other leading punctuation
    .replace(/[\s.,:;/\-_]+$/, '')             // strip trailing punctuation
    .replace(/\s+[A-Za-z]$/, '')               // strip noisy trailing single letter
    .replace(/\b([A-Za-z])\s+([A-Za-z])\s+([A-Za-z])\b/g, '')  // remove isolated letter sequences "A B C"
    .replace(/\s{2,}/g, ' ')
    .trim()
    .substring(0, 80)
    .trim();

  // Post-validation: reject name if it has fewer than 3 real alphabetic characters total
  // U+0D80–U+0DFF covers the full Sinhala Unicode block
  const alphaCount = (name.match(/[a-zA-Z\u0D80-\u0DFF]/g) || []).length;
  if (alphaCount < 3) return '';

  // Reject if the longest word has fewer than 2 alphabetic chars
  const words = name.split(/\s+/).filter(Boolean);
  const longestWordAlpha = Math.max(...words.map(w => (w.match(/[a-zA-Z\u0D80-\u0DFF]/g) || []).length));
  if (longestWordAlpha < 2) return '';

  // Normalize: if entirely uppercase and 3+ words, keep as-is (receipt style)
  // Fix common OCR character substitutions in names
  name = name
    .replace(/\b0([A-Z]{2,})/g, 'O$1')  // "0IL" → "OIL"
    .replace(/([A-Z]{2,})0\b/g, '$1O')  // "COCO0" → "COCOO" (edge case)
    .replace(/\bI([A-Z]{2,})/g, 'I$1'); // keep proper "I" starts

  return name;
}

/**
 * Post-process an extracted product name for better readability.
 * Normalizes common Sri Lankan product OCR issues.
 */
function postProcessProductName(name) {
  if (!name) return name;
  // Fix spacing issues common in thermal receipt OCR
  let n = name
    .replace(/([A-Z]{2,})([0-9]+)([A-Z]{2,})/g, '$1 $2$3') // "RICE5KG" → "RICE 5KG"
    .replace(/([a-zA-Z])(\d+)(g|kg|ml|l|mg)\b/gi, '$1 $2$3')  // "Milk400g" → "Milk 400g"
    .replace(/\s{2,}/g, ' ')
    .trim();

  // Title case if all-caps and more than one word
  const words = n.split(/\s+/);
  if (words.length > 1 && n === n.toUpperCase()) {
    // Keep common uppercase abbreviations, title-case words > 3 chars
    const KEEP_UPPER = new Set(['UHT', 'LKR', 'KG', 'ML', 'MG', 'GM', 'PK', 'PKT', 'BTL', 'CAN', 'JAR',
      'BOX', 'BAG', 'LTR', 'LT', 'NO', 'XX', 'XL', 'XS', 'SM', 'MD', 'LG']);
    n = words.map(w => {
      const up = w.toUpperCase();
      if (KEEP_UPPER.has(up) || up.length <= 2) return up;
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    }).join(' ');
  }
  return n;
}

/**
 * Return true if str looks like just a product/barcode code and not a description.
 * e.g. "BV11530", "DY40928", "0123456789012"
 */
function isCodeOnly(str) {
  const s = str.trim();
  return CODE_TOKEN_RE.test(s) || /^\d{4,}$/.test(s);
}

/**
 * Return true if a line is definitely noise / separator / summary.
 */
function isSkippable(line) {
  return !line
    || line.length < 2
    || SEPARATOR_RE.test(line)
    || SUMMARY_RE.test(line);
}

function isLikelyHeaderLine(line) {
  if (!line) return false;
  const tokens = line.match(HEADER_TOKEN_RE) || [];
  if (tokens.length < 2) return false;
  const hasMeasureToken = /\b(?:qty|quantity|price|amount|rate|value|discount|unit)\b/i.test(line);
  return hasMeasureToken && HEADER_RE.test(line);
}

// ─────────────────────────────────────────────────────────────────────────────
// LINE-GROUPING: merge continuation lines before parsing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Some OCR outputs split a single invoice row across two lines.
 * This function groups lines into "logical rows" using heuristics:
 *
 *  1. If a line has NO numbers and the next line has numbers → they belong together.
 *  2. If a line ends mid-word (very short with letters, ≤ 10 chars) and next continues → merge.
 *
 * Returns an array of { text: string, srcLines: string[] }.
 */
function groupLines(lines) {
  const groups = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isSkippable(line)) continue;

    const hasNumbers = /\d{2,}/.test(line);
    const hasLetters = /[a-zA-Z\u0D80-\u0DFF]{2,}/.test(line);

    // Look-ahead: if this line is text-only and next line is numbers-heavy → merge
    if (hasLetters && !hasNumbers && i + 1 < lines.length) {
      const next = lines[i + 1];
      if (!isSkippable(next) && /\d{2,}/.test(next) && !/[a-zA-Z\u0D80-\u0DFF]{4,}/.test(next)) {
        groups.push({ text: line + ' ' + next, srcLines: [line, next] });
        i++; // consumed next
        continue;
      }
    }

    groups.push({ text: line, srcLines: [line] });
  }

  return groups;
}

// ─────────────────────────────────────────────────────────────────────────────
// OCR TEXT PREPROCESSING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pre-process raw OCR text to reduce noise before parsing.
 * Tuned for Sri Lankan thermal receipts photographed on mobile cameras.
 *
 * Fixes:
 *  - Pipe characters `|` (OCR reads vertical ruled lines as pipes)
 *  - Trailing letter on prices:  "560.0C" → "560.00",  "820.0c" → "820.00"
 *  - Stray letter suffix on integers: "36C" → "36",  "490B" → "490"
 *  - Qty mis-read: "l.000" / "I.000" → "1.000"
 *  - Zero mis-read as O between digits: "56O.00" → "560.00"
 *  - Pure noise lines (< 20% alphanumeric chars) removed
 */
function cleanOcrText(text) {
  return text
    .split('\n')
    .map(line => {
      let l = line.trim();
      // Remove pipe characters (receipt border / ruled-line artifact)
      l = l.replace(/\|/g, ' ');
      // Fix decimal price with trailing letter: "560.0C" → "560.00"
      l = l.replace(/(\d+\.\d)[A-Za-z]/g, '$10');
      // Fix integer with stray trailing letter (not a unit abbreviation).
      // Keep: G(gram), K(kg), L(litre), M(milli), g, k, l, m
      // Remove: C, B, S, R, etc. (common OCR mis-reads of digits 0/8/5)
      const KEEP_UNITS = new Set(['G','K','L','M','g','k','l','m']);
      l = l.replace(/\b(\d{2,})([A-Za-z])\b/g, (_, num, letter) =>
        KEEP_UNITS.has(letter) ? `${num}${letter}` : num
      );
      // Fix qty mis-read: "l.000" / "I.000" → "1.000"
      l = l.replace(/\b[lI]\.(\d{3})\b/g, '1.$1');
      // Fix digit-O-digit: "56O.00" → "560.00" (zero read as letter O)
      l = l.replace(/(\d)[Oo](\d)/g, '$10$2');
      // Collapse extra spaces
      l = l.replace(/\s{2,}/g, ' ').trim();
      return l;
    })
    .filter(line => {
      if (!line || line.length < 2) return false;
      // Drop lines that are mostly symbol noise (less than 20% alphanumeric or Sinhala)
      const alnum = (line.match(/[a-zA-Z0-9\u0D80-\u0DFF]/g) || []).length;
      return alnum / line.length >= 0.2;
    })
    .join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// PARSING STRATEGIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Strategy A — Cargills / Keells two-line format (robust version).
 *
 * Two-line pattern:
 *   Line 1: [rowNum] PRODUCT DESCRIPTION
 *   Line 2: [*] CODE_TOKEN  qty.000  unitPrice  [totalPrice]
 *
 * Key improvements over previous version:
 *  - Code token detection: any 5-14 char alphanumeric string with ≥1 letter AND ≥1 digit
 *    → catches garbled codes like "VGOL0SE" (was "VG01088")
 *  - No end-of-line anchor: pipes and trailing garbage are tolerated
 *  - If total is garbled/missing: totalPrice = round(qty × unitPrice, 2)
 *  - Fallback within A: if pendingName is set and next line has a decimal price but
 *    no recognizable code token, create the item anyway
 */
function strategyA_Cargills(lines) {
  const items = [];

  /**
   * A "code token" is any word-boundary token that:
   *   - is 5–14 chars long
   *   - contains at least one letter AND at least one digit
   *   - contains only alphanumeric characters
   * This is broad enough to catch garbled barcodes from noisy OCR.
   */
  const looksLikeCode = token =>
    token.length >= 5 &&
    token.length <= 14 &&
    /^[A-Za-z0-9]+$/.test(token) &&
    ((/[A-Za-z]/.test(token) && /\d/.test(token)) || /^\d{6,13}$/.test(token));

  const getCodeToken = line => {
    const tokens = line.split(/\s+/);
    return tokens.find(t => looksLikeCode(t)) || null;
  };

  const parseCompactMoney = raw => {
    const digits = String(raw || '').replace(/[^\d]/g, '');
    if (!digits) return null;
    if (digits.length <= 2) return parseFloat(digits);
    return parseFloat(`${digits.slice(0, -2)}.${digits.slice(-2)}`);
  };

  const parseCompactQty = raw => {
    const digits = String(raw || '').replace(/[^\d]/g, '');
    if (!digits) return null;
    if (digits.length >= 4) {
      // Common in produce lines: 0598 -> 0.598, 1035 -> 1.035
      return parseFloat(`${digits.slice(0, -3)}.${digits.slice(-3)}`);
    }
    return parseFloat(digits);
  };

  let pendingName = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.length < 2) continue;
    if (SUMMARY_RE.test(line)) break;

    const codeToken = getCodeToken(line);

    if (codeToken) {
      // ── Barcode / detail line ──────────────────────────────────────────────
      const withoutCode = line.replace(codeToken, '').replace(/\s{2,}/g, ' ').trim();
      const nums = extractAllNumbers(withoutCode).filter(n => n > 0);
      const rawNumTokens = (withoutCode.match(/\d+(?:[.,]\d+)?/g) || []).map(t => String(t));

      if (nums.length < 1) {
        // No numbers at all — could be a name line that contains an item-code word
        if (/[a-zA-Z\u0D80-\u0DFF]{3,}/.test(line) && !isLikelyHeaderLine(line)) pendingName = line;
        continue;
      }

      let qty = 1, unitPrice = null, totalPrice = null;

      // Compact numeric pattern (no decimal points) common in Sri Lankan produce lines:
      //   0598 31000 18538  => qty=0.598 unit=310.00 total=185.38
      if (rawNumTokens.length >= 3 && rawNumTokens.every(t => !/[.,]/.test(t))) {
        const compactQty = parseCompactQty(rawNumTokens[0]);
        const compactUnit = parseCompactMoney(rawNumTokens[1]);
        const compactTotal = parseCompactMoney(rawNumTokens[2]);
        if (compactQty && compactUnit && compactTotal && compactQty > 0 && compactUnit > 0) {
          qty = compactQty;
          unitPrice = compactUnit;
          totalPrice = compactTotal;
          if (!approxEq(qty * unitPrice, totalPrice)) {
            totalPrice = parseFloat((qty * unitPrice).toFixed(2));
          }
        }
      }

      // Detect weight-format qty: exactly 3 decimal places (1.000, 2.500, 0.598)
      const weightMatch = withoutCode.match(/\b(\d{1,4}\.\d{3})\b/);
      if (!unitPrice && weightMatch) {
        qty = parseFloat(weightMatch[1]);
        const priceNums = nums.filter(n => Math.abs(n - qty) > 0.001);

        if (priceNums.length >= 2) {
          // Try every pair: find unit × qty ≈ total
          const sorted = [...priceNums].sort((a, b) => a - b);
          let found = false;
          outer:
          for (let u = 0; u < sorted.length; u++) {
            for (let t = u + 1; t < sorted.length; t++) {
              if (approxEq(qty * sorted[u], sorted[t])) {
                unitPrice = sorted[u];
                totalPrice = sorted[t];
                found = true;
                break outer;
              }
            }
          }
          if (!found) {
            // Total garbled — use the largest remaining price as unit and compute
            unitPrice = Math.max(...priceNums);
            totalPrice = parseFloat((qty * unitPrice).toFixed(2));
          }
        } else if (priceNums.length === 1) {
          unitPrice = priceNums[0];
          totalPrice = parseFloat((qty * unitPrice).toFixed(2));
        }
      } else if (!unitPrice) {
        // No weight-format qty — use resolvePriceSet
        const priceSet = resolvePriceSet(nums);
        if (priceSet) {
          ({ quantity: qty, unitPrice, totalPrice } = priceSet);
        } else {
          unitPrice = nums[nums.length - 1];
          totalPrice = unitPrice;
        }
      }

      if (!unitPrice || unitPrice <= 0) { pendingName = null; continue; }
      if (!totalPrice || totalPrice <= 0) totalPrice = parseFloat((qty * unitPrice).toFixed(2));

      // Check if the barcode line itself contains an embedded product description.
      // This handles Format B: "DY40928  NEWDALE YOGHURT  1.000  560.00  560.00"
      // where the description lives on the same line as the barcode code.
      const descFragment = withoutCode
        .replace(weightMatch ? weightMatch[1] : /(?!x)x/, '') // remove qty
        .replace(/[\d,]+(?:\.\d{1,3})?/g, ' ')               // remove all numbers
        .replace(/\s{2,}/g, ' ')
        .trim();
      const hasEmbeddedDesc = /[a-zA-Z\u0D80-\u0DFF]{3,}/.test(descFragment) &&
        descFragment.replace(/\s/g, '').length >= 4;

      // Name priority: embedded description > pendingName > code token
      let name;
      if (hasEmbeddedDesc) {
        const embeddedName = cleanName(descFragment);
        name = embeddedName.length >= 2 ? embeddedName : null;
      }
      if (!name && pendingName) {
        const cleaned = cleanName(pendingName);
        name = (cleaned.length >= 2 && !isCodeOnly(cleaned)) ? cleaned : null;
      }
      if (!name) name = codeToken;

      if (name && name.length >= 2) {
        items.push({ name, quantity: qty, unitPrice, totalPrice });
      }
      pendingName = null;

    } else if (/[a-zA-Z\u0D80-\u0DFF]{3,}/.test(line) && !isLikelyHeaderLine(line)) {
      // ── Name line ─────────────────────────────────────────────────────────
      pendingName = line;

    } else if (pendingName && /\d+\.\d{2}/.test(line)) {
      // ── Fallback: no code token but line has a decimal price ───────────────
      // This catches severely garbled barcode lines like "i AA ge RK 190.00"
      // where the code is unrecognizable but the price survived.
      const nums = extractAllNumbers(line).filter(n => n > 0);
      if (nums.length >= 1) {
        const priceSet = resolvePriceSet(nums);
        if (priceSet && priceSet.unitPrice > 0) {
          const name = cleanName(pendingName);
          if (name.length >= 2 && !isCodeOnly(name)) {
            items.push({
              name,
              quantity: priceSet.quantity,
              unitPrice: priceSet.unitPrice,
              totalPrice: priceSet.totalPrice,
            });
          }
          pendingName = null;
        }
      }
    }
  }

  return items;
}

/**
 * Strategy B — Single-line with inline barcode/code prefix.
 *
 *   DY40928  NEWDALE YOGHURT  1.000  560.00  560.00
 *   VG01088  ASP OYSTER MUSHROOMS  1.000  200.00  200.00
 *   0234567  Milk Powder 400g  2  650.00  1300.00
 *
 * Detection: line starts with a CODE_TOKEN, followed by description text, then ≥ 2 numbers.
 */
function strategyB_CodePrefix(lines) {
  const items = [];
  // code token at start, then at least 2 letter words (description), then numbers
  const re = /^([A-Z]{1,5}\d{3,10}|\d{6,13})\s+(.{3,40}?)\s{1,}((?:[\d,]+\.?\d*\s+){1,4}[\d,]+\.\d{2})\s*$/i;

  for (const line of lines) {
    if (isSkippable(line) || isLikelyHeaderLine(line)) continue;

    const m = line.match(re);
    if (!m) continue;

    const descPart = m[2].trim();
    // Description must have real letters (Latin or Sinhala)
    if (!/[a-zA-Z\u0D80-\u0DFF]{2,}/.test(descPart)) continue;

    const numPart = m[3];
    const nums = extractAllNumbers(numPart);
    if (nums.length < 2) continue;

    const name = cleanName(descPart);
    if (name.length < 2) continue;

    const priceSet = resolvePriceSet(nums);
    if (!priceSet) continue;

    items.push({
      name,
      quantity: priceSet.quantity,
      unitPrice: priceSet.unitPrice,
      totalPrice: priceSet.totalPrice,
    });
  }

  return items;
}

/**
 * Strategy C — Columnar format (QTY first, name on preceding line).
 *
 * Used in some Sri Lankan supermarkets where OCR produces:
 *   ANCHOR UHT MILK 1L
 *   2  350.00  700.00
 *
 * Or sometimes:
 *   [noise prefix]  QTY  UNIT  [DISC]  TOTAL
 *   Name on the line above
 *
 * Works on already-grouped lines (after groupLines()).
 */
function strategyC_Columnar(lines) {
  const items = [];
  // Qty can be integer or decimal (e.g. 2.000, 0.598)
  // Pattern: optional garbage (≤8 chars), then qty (1-4 digits, optional .ddd), unitPrice, optional disc, total
  const numericRowRe = /^.{0,8}\b(\d{1,4}(?:\.\d{1,3})?)\s+([\d,]+\.\d{2})\s+(?:[\d,]+\.\d{2}\s+)?([\d,]+\.\d{2})/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isSkippable(line) || isLikelyHeaderLine(line)) continue;

    const m = line.match(numericRowRe);
    if (!m) continue;

    const qty = parseNum(m[1]);
    const unitPrice = parsePrice(m[2]);
    const totalPrice = parsePrice(m[3]);

    if (!qty || qty <= 0 || qty > 9999) continue;
    if (!unitPrice || !totalPrice) continue;
    // Basic math validation
    if (!approxEq(qty * unitPrice, totalPrice)) continue;

    // Look back for the name (up to 3 lines)
    let name = null;
    for (let back = 1; back <= 3 && i - back >= 0; back++) {
      const prev = lines[i - back];
      if (!prev || isSkippable(prev) || isLikelyHeaderLine(prev)) continue;
      if (!/[a-zA-Z\u0D80-\u0DFF]{2,}/.test(prev)) continue;
      const candidate = cleanName(prev);
      if (candidate.length >= 2 && !isCodeOnly(candidate)) {
        name = candidate;
        break;
      }
    }

    if (!name) name = `Item Rs.${unitPrice.toFixed(2)}`;

    items.push({ name, quantity: qty, unitPrice, totalPrice });
  }

  return items;
}

/** Tolerance helper shared by strategyC */
function approxEq(a, b) {
  return Math.abs(a - b) <= Math.max(1, b * 0.05);
}

/**
 * Strategy D — Generic single-line multi-number format.
 *
 * Works on any line that has both letters (description) and ≥ 2 numbers.
 * Strips codes, row numbers, then resolves numbers via resolvePriceSet().
 *
 * Covers:
 *   1  RICE 5KG  1  2500.00  2500.00        (row num + name + qty + price + total)
 *   AMOXICILLIN 500MG  10  45.00  450.00    (name + qty + unitPrice + total)
 *   BREAD  1 X  120.00  120.00              (name + qty × + price + total)
 */
function strategyD_SingleLine(lines) {
  const items = [];

  for (const line of lines) {
    if (isSkippable(line) || isLikelyHeaderLine(line)) continue;

    // Must have at least 2 real letters (description) — Latin or Sinhala
    if (!/[a-zA-Z\u0D80-\u0DFF]{2,}/.test(line)) continue;

    const nums = extractAllNumbers(line);
    if (nums.length < 2) continue;

    // Extract description: remove leading code/row-num and all numbers
    const textOnly = line
      .replace(/^[*\s\d]{0,5}/, '')              // leading noise/row numbers
      .replace(/\b[A-Z]{1,5}\d{3,10}\b/gi, '')   // code tokens
      .replace(/[\d,]+(?:\.\d{1,3})?/g, ' ')     // all numbers
      .replace(/\s[xX@]\s/g, ' ')                // qty markers
      .replace(/[|\\*#@$%^&\[\](){}]/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();

    const name = cleanName(textOnly);
    if (!name || name.length < 2 || !/[a-zA-Z\u0D80-\u0DFF]{2,}/.test(name)) continue;

    const priceSet = resolvePriceSet(nums);
    if (!priceSet) continue;

    items.push({
      name,
      quantity: priceSet.quantity,
      unitPrice: priceSet.unitPrice,
      totalPrice: priceSet.totalPrice,
    });
  }

  return items;
}

/**
 * Strategy E — Two-line split (explicit lookahead).
 *
 * Unlike groupLines() which pre-merges, this scans pairs explicitly for cases
 * where the name line contains numbers too (so groupLines won't merge them).
 *
 *   GARLIC 1KG
 *     4  820.00  820.00
 *
 *   PARACETAMOL 500MG TABS
 *     10  22.50  225.00
 */
function strategyE_TwoLineSplit(lines) {
  const items = [];
  const consumed = new Set();

  for (let i = 0; i < lines.length - 1; i++) {
    if (consumed.has(i)) continue;

    const nameLine = lines[i];
    if (isSkippable(nameLine) || isLikelyHeaderLine(nameLine)) continue;
    if (!/[a-zA-Z\u0D80-\u0DFF]{3,}/.test(nameLine)) continue;

    const numLine = lines[i + 1];
    if (!numLine || isSkippable(numLine)) continue;

    // Number line should be mostly numeric
    const numLineLetters = (numLine.match(/[a-zA-Z]/g) || []).length;
    const numLineDigits = (numLine.match(/\d/g) || []).length;
    if (numLineDigits < 2 || numLineLetters > 4) continue;

    const nums = extractAllNumbers(numLine);
    if (nums.length < 1) continue;

    const name = cleanName(nameLine.replace(/^\d+\s+/, ''));
    if (!name || name.length < 2) continue;

    const priceSet = resolvePriceSet(nums);
    if (!priceSet) continue;

    items.push({
      name,
      quantity: priceSet.quantity,
      unitPrice: priceSet.unitPrice,
      totalPrice: priceSet.totalPrice,
    });

    consumed.add(i);
    consumed.add(i + 1);
    i++; // skip number line
  }

  return items;
}

/**
 * Strategy F — Simple trailing price (pharmacy / hardware / small shops).
 *
 *   BREAD                     120.00
 *   BUTTER UNSALTED           350.00
 *   PANADOL EXTRA TABS X10     89.00
 *
 * Also handles "Rs.120.00" and "LKR 350.00" suffix.
 */
function strategyF_TrailingPrice(lines) {
  const items = [];

  for (const line of lines) {
    if (isSkippable(line) || isLikelyHeaderLine(line)) continue;
    if (line.length < 5) continue;

    // Line must end with a decimal price (with or without Rs. prefix)
    const m = line.match(/^(.+?)\s+(?:rs\.?|lkr\.?)?\s*([\d,]+\.\d{2})\s*$/i);
    if (!m) continue;

    const rawName = m[1]
      .replace(/^\d+\s*[xX@]\s*/, '')  // strip leading "2 x " or "3@ " qty prefix
      .replace(/^\d+\s+/, '');          // strip leading row number
    const price = parsePrice(m[2]);
    if (!price) continue;

    const name = cleanName(rawName);
    if (!name || name.length < 2 || !/[a-zA-Z\u0D80-\u0DFF]{2,}/.test(name)) continue;
    // Reject if the "name" part is itself just a code or number
    if (isCodeOnly(name)) continue;

    items.push({ name, quantity: 1, unitPrice: price, totalPrice: price });
  }

  return items;
}

/**
 * Strategy G — "QTY × NAME  PRICE" format (common in some retail bills).
 *
 *   2 x Coconut Oil 500ml  1,200.00
 *   1 x Bread               120.00
 */
function strategyG_QtyXName(lines) {
  const items = [];

  for (const line of lines) {
    if (isSkippable(line) || isLikelyHeaderLine(line)) continue;

    const m = line.match(/^(\d+)\s*[xX@]\s*(.+?)\s+([\d,]+\.\d{2})\s*$/);
    if (!m) continue;

    const qty = parseInt(m[1], 10);
    const name = cleanName(m[2]);
    const total = parsePrice(m[3]);

    if (!total || qty < 1 || qty > 9999) continue;
    if (!name || name.length < 2 || !/[a-zA-Z\u0D80-\u0DFF]{2,}/.test(name)) continue;

    const unitPrice = parsePrice((total / qty).toFixed(2));
    items.push({ name, quantity: qty, unitPrice: unitPrice || total, totalPrice: total });
  }

  return items;
}

// ─────────────────────────────────────────────────────────────────────────────
// SCORE & SELECT BEST RESULT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Score a candidate items array.
 *
 * Key principle: math-validated items (qty × unitPrice ≈ totalPrice) score much
 * higher than unvalidated items. Sets where fewer than 50% of items pass math
 * validation are penalised to prevent garbled multi-item results from beating
 * smaller but correct results.
 */
function scoreItems(items, invoiceTotal) {
  if (!items || items.length === 0) return 0;
  let score = 0;
  let mathValidCount = 0;

  for (const item of items) {
    score += 5; // base per item
    if (item.name && item.name.length >= 3 && /[a-zA-Z\u0D80-\u0DFF]{2,}/.test(item.name)) score += 2;
    score += nameConfidence(item.name || '');
    if (item.quantity > 0) score += 1;
    if (item.unitPrice > 0) score += 1;
    if (item.totalPrice > 0) score += 1;
    if (approxEq(item.quantity * item.unitPrice, item.totalPrice)) {
      score += 10; // heavily reward mathematically correct items
      mathValidCount++;
    }
  }

  // Penalise result sets where more than half the items fail math validation.
  // This prevents "5 garbled items" from beating "3 correct items".
  if (items.length > 0 && mathValidCount / items.length < 0.5) {
    score = Math.floor(score * 0.5);
  }

  if (invoiceTotal) {
    const sumTotal = items.reduce((s, i) => s + (i.totalPrice || 0), 0);
    if (approxEq(sumTotal, invoiceTotal)) score += 20;
  }
  return score;
}

function normalizeNameForCompare(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9\u0D80-\u0DFF\s]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function nameConfidence(name) {
  const n = String(name || '').trim();
  if (!n) return 0;
  if (isCodeOnly(n)) return 0;

  const alphaCount = (n.match(/[a-zA-Z\u0D80-\u0DFF]/g) || []).length;
  const digitCount = (n.match(/\d/g) || []).length;
  const words = n.split(/\s+/).filter(Boolean);
  const longWords = words.filter(w => /[a-zA-Z\u0D80-\u0DFF]{3,}/.test(w)).length;
  const singleCharWords = words.filter(w => w.length === 1).length;
  const numericTokens = n.match(/\b\d+(?:[.,]\d+)?\b/g) || [];

  let score = 0;
  if (alphaCount >= 4) score += 2;
  if (longWords >= 1) score += 2;
  if (longWords >= 2) score += 2;
  if (digitCount > alphaCount) score -= 2;
  if (singleCharWords >= 3) score -= 2;
  if (/[a-zA-Z\u0D80-\u0DFF]{2,}\s+[a-zA-Z\u0D80-\u0DFF]{2,}/.test(n)) score += 1;
  if (/\b\d+[.,]\d{2}\b/.test(n)) score -= 4; // item names should not contain prices
  if (numericTokens.length >= 3) score -= 3;      // likely full OCR line, not a name
  if (n.length > 45 && numericTokens.length >= 1) score -= 2;

  return Math.max(0, Math.min(6, score));
}

function areNumbersEquivalent(a, b) {
  if (!a || !b) return false;
  const aq = Number(a.quantity || 0);
  const au = Number(a.unitPrice || 0);
  const at = Number(a.totalPrice || 0);
  const bq = Number(b.quantity || 0);
  const bu = Number(b.unitPrice || 0);
  const bt = Number(b.totalPrice || 0);

  const qtyOk = Math.abs(aq - bq) <= 0.02;
  const unitOk = Math.abs(au - bu) <= 0.5;
  const totalOk = Math.abs(at - bt) <= 0.5;

  // Strict match to avoid accidental row crossing:
  // require total match + one of qty/unit match.
  return totalOk && (qtyOk || unitOk);
}

function refineItemNames(bestItems, allStrategyItems) {
  if (!Array.isArray(bestItems) || bestItems.length === 0) return bestItems;
  const pools = (allStrategyItems || []).flatMap(s => s.items || []);

  return bestItems.map(item => {
    const currentConfidence = nameConfidence(item.name || '');
    let bestName = item.name;
    let bestConfidence = currentConfidence;

    for (const alt of pools) {
      if (!areNumbersEquivalent(item, alt)) continue;
      const altName = String(alt.name || '');
      if (/\b\d+[.,]\d{2}\b/.test(altName)) continue; // reject line-like names with prices
      const altConfidence = nameConfidence(altName);
      if (altConfidence >= bestConfidence + 2) {
        bestConfidence = altConfidence;
        bestName = altName;
      }
    }

    if (bestName !== item.name) {
      return { ...item, name: bestName };
    }
    return item;
  });
}

function scoreParsedCandidate(parsed) {
  if (!parsed) return 0;
  let score = 0;
  const items = Array.isArray(parsed.items) ? parsed.items : [];
  score += items.length * 20;
  if (parsed.total) score += 8;
  if (parsed.subtotal) score += 4;
  if (parsed.date) score += 3;
  if (parsed.storeName) score += 3;

  let mathValid = 0;
  for (const item of items) {
    if (item && item.quantity > 0 && item.unitPrice > 0 && item.totalPrice > 0 && approxEq(item.quantity * item.unitPrice, item.totalPrice)) {
      mathValid++;
    }
  }
  score += mathValid * 10;
  if (items.length > 0 && mathValid / items.length < 0.4) {
    score = Math.floor(score * 0.6);
  }

  return score;
}

/**
 * Deduplicate items: if two items have the same name+price, keep the first.
 * Also remove items where name is too short or has no real letters.
 * Apply postProcessProductName for cleaner display names.
 */
function deduplicateItems(items) {
  const seen = new Set();
  return items
    .filter(item => {
      if (!item.name || item.name.length < 2 || !/[a-zA-Z]{2,}/.test(item.name)) return false;
      const key = `${normalizeNameForCompare(item.name)}|${item.totalPrice}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map(item => ({
      ...item,
      name: postProcessProductName(item.name) || item.name,
    }));
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PARSER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse raw OCR text into structured receipt data.
 *
 * Runs all strategies, scores each result, and returns the highest-scoring one.
 * This avoids the "early return on first match" bug that caused missing items.
 */
function parseReceiptText(text) {
  if (!text || text.trim().length < 5) {
    return { storeName: null, date: null, items: [], subtotal: null, tax: null, total: null };
  }

  // ── Pre-process OCR text to reduce noise ────────────────────────────────────
  const cleanedText = cleanOcrText(text);
  const rawLines = cleanedText.split('\n').map(l => l.trim()).filter(Boolean);

  const result = {
    storeName: null,
    date: null,
    items: [],
    subtotal: null,
    tax: null,
    total: null,
  };

  // ── Store name: first meaningful line in top 6 ──────────────────────────────
  for (const line of rawLines.slice(0, 6)) {
    if (
      line.length >= 3 &&
      line.length <= 60 &&
      /[a-zA-Z]{3,}/.test(line) &&
      !SUMMARY_RE.test(line) &&
      !isLikelyHeaderLine(line) &&
      !SEPARATOR_RE.test(line)
    ) {
      result.storeName = line;
      break;
    }
  }

  // ── Date detection ──────────────────────────────────────────────────────────
  const datePatterns = [
    /\b(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})\b/,
    /\b(\d{4}[\/\-.]\d{1,2}[\/\-.]\d{1,2})\b/,
    /\b((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4})\b/i,
  ];
  for (const line of rawLines) {
    for (const pat of datePatterns) {
      const m = line.match(pat);
      if (m) {
        const d = new Date(m[1].replace(/\./g, '/'));
        if (!isNaN(d.getTime())) { result.date = d.toISOString().split('T')[0]; break; }
      }
    }
    if (result.date) break;
  }

  // ── Summary totals ──────────────────────────────────────────────────────────
  const TOTAL_LINE_RE    = /(?:grand\s*)?total\b.*?([\d,]+\.\d{2})/i;
  const SUBTOTAL_LINE_RE = /sub[\s-]?total.*?([\d,]+\.\d{2})/i;
  const TAX_LINE_RE      = /(?:tax|gst|vat|cess|nbt)\b.*?([\d,]+\.\d{2})/i;

  for (const line of rawLines) {
    if (!result.total && TOTAL_LINE_RE.test(line)) {
      const m = line.match(TOTAL_LINE_RE);
      result.total = parsePrice(m[1]);
    }
    if (!result.subtotal && SUBTOTAL_LINE_RE.test(line)) {
      const m = line.match(SUBTOTAL_LINE_RE);
      result.subtotal = parsePrice(m[1]);
    }
    if (!result.tax && TAX_LINE_RE.test(line)) {
      const m = line.match(TAX_LINE_RE);
      result.tax = parsePrice(m[1]);
    }
  }

  // ── Determine item region (between header/preamble and totals) ──────────────
  let itemStart = 0;
  let itemEnd = rawLines.length;

  // Find header row
  for (let i = 0; i < Math.min(rawLines.length, 15); i++) {
    if (isLikelyHeaderLine(rawLines[i])) {
      itemStart = i + 1;
      break;
    }
  }

  // Find where totals start
  for (let i = itemStart; i < rawLines.length; i++) {
    if (SUMMARY_RE.test(rawLines[i])) {
      itemEnd = i;
      break;
    }
  }

  const itemLines = rawLines.slice(itemStart, itemEnd).filter(l => !SEPARATOR_RE.test(l));

  // Pre-group lines for strategies that benefit from it
  const groupedLines = groupLines(itemLines).map(g => g.text);

  // ── Run all strategies ──────────────────────────────────────────────────────
  logger.debug(`OCR: item region has ${itemLines.length} lines (${groupedLines.length} grouped)`);

  const rawCandidates = [
    { name: 'Cargills',    items: strategyA_Cargills(itemLines) },
    { name: 'CodePrefix',  items: strategyB_CodePrefix(itemLines) },
    { name: 'Columnar',    items: strategyC_Columnar(itemLines) },
    { name: 'SingleLine',  items: strategyD_SingleLine(groupedLines) },
    { name: 'TwoLineSplit',items: strategyE_TwoLineSplit(itemLines) },
    { name: 'Trailing',    items: strategyF_TrailingPrice(groupedLines) },
    { name: 'QtyXName',    items: strategyG_QtyXName(groupedLines) },
  ];

  const candidates = rawCandidates.map(c => ({
    name: c.name,
    items: deduplicateItems(c.items),
  }));

  // Score each candidate set and pick the winner
  let bestScore = -1;
  let bestItems = [];
  let bestStrategy = 'none';

  for (const candidate of candidates) {
    const score = scoreItems(candidate.items, result.total);
    logger.debug(`OCR strategy ${candidate.name}: ${candidate.items.length} items, score ${score}`);
    if (score > bestScore) {
      bestScore = score;
      bestItems = candidate.items;
      bestStrategy = candidate.name;
    }
  }

  logger.info(`OCR: best strategy = ${bestStrategy} with ${bestItems.length} items (score ${bestScore})`);

  result.items = deduplicateItems(refineItemNames(bestItems, candidates));

  // ── Fallback: if still no items, try the full raw lines with strategyD ──────
  if (result.items.length === 0) {
    const fallback = deduplicateItems(strategyD_SingleLine(rawLines));
    if (fallback.length > 0) {
      logger.info(`OCR: fallback single-line strategy found ${fallback.length} items`);
      result.items = fallback;
    }
  }

  // ── Compute total from items if not found in summary ───────────────────────
  if (!result.total && result.items.length > 0) {
    result.total = parseFloat(
      result.items.reduce((s, i) => s + (i.totalPrice || 0), 0).toFixed(2)
    );
  }

  return result;
}

/**
 * Parse raw OCR text (extracted on the mobile device) into structured invoice data.
 * Uses Gemini to normalise the text rather than relying on fragile regex.
 * Falls back to the regex parser if Gemini is unavailable or fails.
 *
 * @param {string} rawText - Plain receipt text extracted on the mobile device.
 * @returns {{ storeName, date, items, subtotal, tax, total }}
 */
async function extractItemsFromText(rawText) {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const timeoutMs = parseInt(process.env.GEMINI_TIMEOUT_MS || '45000', 10);

  if (apiKey) {
    try {
      const prompt = `You are an expert parser for Sri Lankan bills, invoices and receipts of ANY format — thermal receipts, A4/B5 printed invoices, handwritten bills, supermarket printouts, pharmacy bills, hardware store receipts, restaurant bills, utility bills, or any other purchase document.
The following is raw OCR text that may contain errors, garbled characters, missing spaces, or Sinhala/Tamil transliterations due to image quality issues.
Use your knowledge of Sri Lankan products, services, brands, and pricing to correct obvious OCR errors and parse into structured data.

Return ONLY valid JSON in this exact format (no markdown, no code fences):
{
  "storeName": "shop/company name or null",
  "date": "YYYY-MM-DD or null",
  "items": [
    { "name": "product or service name", "quantity": 1, "unitPrice": 0.00, "totalPrice": 0.00, "unit": "unit or null" }
  ],
  "subtotal": 0.00,
  "tax": 0.00,
  "total": 0.00
}

Rules:
- Include EVERY purchased item or service line, even if the name looks garbled — make your best guess at the name.
- Skip non-item lines only: grand total, subtotal, VAT/NBT/tax summary, discount summary, cash tendered, change, rounding, loyalty points, page numbers.
- NEVER use null for numeric fields — always use 0 if unknown.
- quantity defaults to 1 if not shown.
- unitPrice: price per single unit. totalPrice: quantity × unitPrice. If only one price shown, use it for both.
- All prices in LKR as plain numbers (no currency symbol).
- Item/product names in English; transliterate or translate Sinhala/Tamil names.
- If a line looks like a purchased item but prices are missing or unclear, still include it with price 0.
- For service invoices (e.g. repairs, medical), treat each service line as an item.

Raw OCR text:
---
${rawText}
---`;

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await axios.post(
        url,
        {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0, topP: 1 },
        },
        { timeout: Number.isFinite(timeoutMs) ? timeoutMs : 45000, headers: { 'Content-Type': 'application/json' } }
      );

      const geminiText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const jsonStr = geminiText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
      const structured = JSON.parse(jsonStr);

      if (Array.isArray(structured.items)) {
        logger.info(`extractItemsFromText: Gemini parsed ${structured.items.length} items`);
        return {
          storeName: structured.storeName || null,
          date: structured.date || null,
          items: structured.items.map(item => ({
            name: String(item.name || '').trim(),
            quantity: Number(item.quantity) || 1,
            unitPrice: Number(item.unitPrice) || 0,
            totalPrice: Number(item.totalPrice) || Number(item.unitPrice) || 0,
            unit: item.unit || null,
          })).filter(item => item.name.length >= 2),
          subtotal: Number(structured.subtotal) || null,
          tax: Number(structured.tax) || null,
          total: Number(structured.total) || null,
        };
      }
    } catch (err) {
      logger.warn('extractItemsFromText: Gemini failed, falling back to regex:', err.message);
    }
  }

  // Fallback: use the existing regex parser on the raw text
  logger.info('extractItemsFromText: using regex parser');
  return parseReceiptText(rawText);
}

module.exports = {
  extractInvoiceData,
  extractItemsFromText,
  _internals: {
    cleanOcrText,
    parseReceiptText,
    scoreParsedCandidate,
  },
};
