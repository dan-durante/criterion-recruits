import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import { ATTRIBUTION_KEYS, readAttribution } from './attribution.js';
import { normalizeHeaders, isSendableEndpoint, submitInterest } from './submit.js';
import { buildPayload, validateInterest } from './validate.js';

const valid = {
  name: 'Avery Cole',
  email: 'avery@example.com',
  phone: '(203) 555-0100',
  license_status: 'Licensed',
  years_licensed: '<1',
  message: 'Looking in Fairfield County.',
  consent: true,
};

test('accepts a complete interest form', () => {
  assert.deepEqual(validateInterest(valid), {});
});

test('reports each missing or invalid field', () => {
  const errors = validateInterest({
    name: ' ',
    email: 'not-an-email',
    phone: '555',
    license_status: '',
    years_licensed: '10+',
    message: 'x'.repeat(2001),
    consent: false,
  });
  assert.equal(errors.name, 'Enter your name.');
  assert.equal(errors.email, 'Enter a valid email address.');
  assert.equal(errors.phone, 'Enter a phone number with at least 10 digits.');
  assert.equal(errors.license_status, 'Select your license status.');
  assert.equal(errors.years_licensed, 'Select how long you have been licensed.');
  assert.match(errors.message, /2,000/);
  assert.match(errors.consent, /Agree to be contacted/);
});

test('accepts every license status and years option', () => {
  for (const license_status of [
    'Licensed',
    'In pre-licensing course',
    'Not yet started',
  ]) {
    for (const years_licensed of ['Not yet', '<1', '1-2', '3-5', '5+']) {
      const errors = validateInterest({ ...valid, license_status, years_licensed });
      assert.deepEqual(errors, {});
    }
  }
});

test('builds a payload with trimmed fields and attribution', () => {
  const payload = buildPayload(
    { ...valid, name: '  Avery Cole  ', message: '  Hello  ' },
    readAttribution('?utm_source=spring&utm_medium=email&src=brochure&ignored=1'),
  );
  assert.equal(payload.name, 'Avery Cole');
  assert.equal(payload.message, 'Hello');
  assert.equal(payload.consent, true);
  assert.equal(payload.utm_source, 'spring');
  assert.equal(payload.utm_medium, 'email');
  assert.equal(payload.utm_campaign, '');
  assert.equal(payload.src, 'brochure');
  assert.equal(payload.ignored, undefined);
  for (const key of ATTRIBUTION_KEYS) {
    assert.equal(typeof payload[key], 'string');
  }
});

test('caps long attribution values', () => {
  const attribution = readAttribution(`?src=${'a'.repeat(500)}`);
  assert.equal(attribution.src.length, 200);
});

test('rejects endpoints that are not http(s) or relative', () => {
  assert.equal(isSendableEndpoint(''), false);
  assert.equal(isSendableEndpoint('   '), false);
  assert.equal(isSendableEndpoint('javascript:alert(1)'), false);
  assert.equal(isSendableEndpoint('//evil.example/collect'), false);
  assert.equal(isSendableEndpoint('https://example.com/leads'), true);
  assert.equal(isSendableEndpoint('http://127.0.0.1:9/leads'), true);
  assert.equal(isSendableEndpoint('/api/interest'), true);
});

test('keeps only non-empty string headers', () => {
  assert.deepEqual(
    normalizeHeaders({ apikey: 'abc', Authorization: 'Bearer abc', empty: '', n: 1 }),
    { apikey: 'abc', Authorization: 'Bearer abc' },
  );
});

test('empty endpoint does not call fetch', async () => {
  const original = globalThis.fetch;
  let called = false;
  globalThis.fetch = () => {
    called = true;
    throw new Error('should not fetch');
  };
  try {
    const result = await submitInterest('  ', {}, { name: 'Avery' });
    assert.deepEqual(result, { mode: 'local' });
    assert.equal(called, false);
  } finally {
    globalThis.fetch = original;
  }
});

test('posts JSON to a configured endpoint', async () => {
  let body = '';
  let contentType = '';
  let testHeader = '';
  const server = createServer((req, res) => {
    contentType = req.headers['content-type'] ?? '';
    testHeader = req.headers['x-test'] ?? '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      res.writeHead(201, { 'content-type': 'application/json' });
      res.end('{}');
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  try {
    const result = await submitInterest(
      `http://127.0.0.1:${port}/lead`,
      { 'X-Test': 'yes' },
      { name: 'Avery', consent: true },
    );
    assert.equal(result.mode, 'remote');
    assert.equal(result.status, 201);
    assert.equal(JSON.parse(body).name, 'Avery');
    assert.match(contentType, /application\/json/);
    assert.equal(testHeader, 'yes');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('rejects a non-ok response', async () => {
  const server = createServer((_req, res) => {
    res.writeHead(422);
    res.end('no');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  try {
    await assert.rejects(
      () => submitInterest(`http://127.0.0.1:${port}/lead`, {}, { name: 'Avery' }),
      /rejected/,
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
