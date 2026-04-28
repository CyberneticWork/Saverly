/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const { _internals } = require('../src/services/ocr.service');

function loadCases(filePath) {
  const abs = path.resolve(filePath);
  const raw = fs.readFileSync(abs, 'utf8');
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) {
    throw new Error('Sample file must contain an array of test cases');
  }
  return data;
}

function approxEq(a, b) {
  return Math.abs(a - b) <= Math.max(1, b * 0.05);
}

function runCase(testCase) {
  const cleaned = _internals.cleanOcrText(testCase.text || '');
  const parsed = _internals.parseReceiptText(cleaned);

  const minItems = testCase.expect?.minItems ?? 1;
  const expectedNames = testCase.expect?.mustContainNames || [];
  const mustHaveTotal = Boolean(testCase.expect?.mustHaveTotal);
  const expectedTotal = testCase.expect?.total;

  const foundNames = parsed.items.map(i => String(i.name || '').toLowerCase());
  const matchedNames = expectedNames.filter(name =>
    foundNames.some(found => found.includes(String(name).toLowerCase()))
  );

  const mathInvalid = parsed.items.filter(i => {
    if (!i || !i.quantity || !i.unitPrice || !i.totalPrice) return false;
    return !approxEq(i.quantity * i.unitPrice, i.totalPrice);
  });

  let pass = true;
  const reasons = [];

  if (parsed.items.length < minItems) {
    pass = false;
    reasons.push(`items ${parsed.items.length} < minItems ${minItems}`);
  }
  if (expectedNames.length > 0 && matchedNames.length < expectedNames.length) {
    pass = false;
    reasons.push(`name match ${matchedNames.length}/${expectedNames.length}`);
  }
  if (mustHaveTotal && !parsed.total) {
    pass = false;
    reasons.push('total missing');
  }
  if (expectedTotal && (!parsed.total || !approxEq(parsed.total, expectedTotal))) {
    pass = false;
    reasons.push(`total mismatch expected ${expectedTotal}, got ${parsed.total || 'null'}`);
  }

  return {
    name: testCase.name,
    pass,
    reasons,
    parsed,
    metrics: {
      items: parsed.items.length,
      matchedNames: matchedNames.length,
      expectedNames: expectedNames.length,
      mathInvalid: mathInvalid.length,
      total: parsed.total || null,
    },
  };
}

function main() {
  const samplePath = process.argv[2] || path.join(__dirname, 'ocr_samples.json');
  const testCases = loadCases(samplePath);

  const started = Date.now();
  const results = testCases.map(runCase);
  const passed = results.filter(r => r.pass).length;

  console.log('OCR benchmark');
  console.log(`Sample file: ${samplePath}`);
  console.log(`Cases: ${results.length}`);
  console.log('-------------------------------------------');

  for (const result of results) {
    const marker = result.pass ? 'PASS' : 'FAIL';
    console.log(`${marker} | ${result.name}`);
    console.log(`  items=${result.metrics.items} matchedNames=${result.metrics.matchedNames}/${result.metrics.expectedNames} mathInvalid=${result.metrics.mathInvalid} total=${result.metrics.total}`);
    if (!result.pass) {
      console.log(`  reasons: ${result.reasons.join('; ')}`);
    }
  }

  console.log('-------------------------------------------');
  console.log(`Passed: ${passed}/${results.length}`);
  console.log(`Duration: ${Date.now() - started} ms`);

  if (passed !== results.length) {
    process.exitCode = 1;
  }
}

main();
