/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

function getByPath(obj, dotPath) {
  if (!obj || !dotPath) return null;
  return dotPath.split('.').reduce((acc, part) => {
    if (acc && Object.prototype.hasOwnProperty.call(acc, part)) return acc[part];
    return null;
  }, obj);
}

function findStringCandidates(value, currentPath = 'data', out = []) {
  if (value == null) return out;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length > 0) out.push({ path: currentPath, value: trimmed });
    return out;
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => findStringCandidates(v, `${currentPath}.${i}`, out));
    return out;
  }
  if (typeof value === 'object') {
    Object.keys(value).forEach((key) => {
      findStringCandidates(value[key], `${currentPath}.${key}`, out);
    });
  }
  return out;
}

async function main() {
  const imagePathArg = process.argv[2];
  if (!imagePathArg) {
    console.error('Usage: node scripts/check-external-ocr.js <path-to-image>');
    process.exit(1);
  }

  const endpoint = process.env.CROMP_OCR_API_URL;
  if (!endpoint) {
    console.error('Missing CROMP_OCR_API_URL in backend/.env');
    process.exit(1);
  }

  const imagePath = path.resolve(imagePathArg);
  if (!fs.existsSync(imagePath)) {
    console.error(`Image not found: ${imagePath}`);
    process.exit(1);
  }

  const timeoutMs = parseInt(process.env.CROMP_OCR_TIMEOUT_MS || '30000', 10);
  const imageField = process.env.CROMP_OCR_IMAGE_FIELD || 'imageBase64';
  const textPath = process.env.CROMP_OCR_TEXT_PATH || '';

  const imageBase64 = fs.readFileSync(imagePath).toString('base64');
  const body = {
    fileName: path.basename(imagePath),
    mimeType: 'image/jpeg',
    [imageField]: imageBase64,
  };

  const headers = { 'Content-Type': 'application/json' };
  if (process.env.CROMP_OCR_API_KEY) headers['x-api-key'] = process.env.CROMP_OCR_API_KEY;
  if (process.env.CROMP_OCR_BEARER_TOKEN) {
    headers.Authorization = `Bearer ${process.env.CROMP_OCR_BEARER_TOKEN}`;
  }

  console.log('External OCR health check');
  console.log(`Endpoint: ${endpoint}`);
  console.log(`Image: ${imagePath}`);

  const response = await axios.post(endpoint, body, {
    headers,
    timeout: Number.isFinite(timeoutMs) ? timeoutMs : 30000,
  });

  const payload = response.data;
  const known = {
    rawText: payload?.rawText,
    text: payload?.text,
    ocrText: payload?.ocrText,
  };

  const configuredPathText = textPath ? getByPath(payload, textPath) : null;

  console.log(`HTTP status: ${response.status}`);
  console.log(`Top-level response keys: ${Object.keys(payload || {}).join(', ') || '(none)'}`);

  if (configuredPathText) {
    const str = String(configuredPathText).trim();
    console.log(`Configured CROMP_OCR_TEXT_PATH matched: ${textPath}`);
    console.log(`Extracted text length: ${str.length}`);
    console.log(`Text preview: ${str.slice(0, 300).replace(/\s+/g, ' ')}`);
    return;
  }

  const knownHit = Object.entries(known).find(([, v]) => typeof v === 'string' && v.trim());
  if (knownHit) {
    const [key, value] = knownHit;
    const str = String(value).trim();
    console.log(`Detected OCR text in key: ${key}`);
    console.log(`Extracted text length: ${str.length}`);
    console.log(`Suggested CROMP_OCR_TEXT_PATH: ${key}`);
    console.log(`Text preview: ${str.slice(0, 300).replace(/\s+/g, ' ')}`);
    return;
  }

  const allStrings = findStringCandidates(payload)
    .filter(entry => entry.value.length >= 30)
    .sort((a, b) => b.value.length - a.value.length)
    .slice(0, 5);

  if (allStrings.length > 0) {
    console.log('Could not detect standard OCR keys; candidate string paths:');
    allStrings.forEach((entry, idx) => {
      console.log(`${idx + 1}. ${entry.path} (len ${entry.value.length})`);
      console.log(`   preview: ${entry.value.slice(0, 200).replace(/\s+/g, ' ')}`);
    });
    console.log('Set CROMP_OCR_TEXT_PATH to the correct path and test again.');
    return;
  }

  console.log('No OCR-like text found in response payload.');
  console.log('Sample payload preview:');
  console.log(JSON.stringify(payload, null, 2).slice(0, 1000));
}

main().catch((err) => {
  const status = err.response?.status;
  const data = err.response?.data;
  console.error('Health check failed.');
  if (status) console.error(`HTTP status: ${status}`);
  if (data) console.error(`Response body: ${JSON.stringify(data, null, 2).slice(0, 1500)}`);
  else console.error(err.message);
  process.exit(1);
});
