import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { mkdir } from 'node:fs/promises';
import puppeteer from 'puppeteer-core';

const root = new URL('..', import.meta.url).pathname;
const dist = join(root, 'dist');
const shots = join(root, 'docs', 'screenshots');
const prefix = '/criterion-recruits';

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

function startStatic() {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      const url = new URL(req.url, 'http://127.0.0.1');
      if (!url.pathname.startsWith(prefix)) {
        res.writeHead(404);
        res.end('not found');
        return;
      }
      let rel = decodeURIComponent(url.pathname.slice(prefix.length)).replace(/^\/+/, '');
      if (rel === '' || rel.endsWith('/')) rel += 'index.html';
      const file = normalize(join(dist, rel));
      if (!file.startsWith(normalize(dist))) {
        res.writeHead(403);
        res.end('forbidden');
        return;
      }
      try {
        const data = await readFile(file);
        res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream' });
        res.end(data);
      } catch {
        res.writeHead(404);
        res.end('missing');
      }
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function settle(page) {
  await page.waitForSelector('.brand img');
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
    const img = document.querySelector('.brand img');
    if (img && !img.complete) {
      await new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = resolve;
      });
    }
  });
}

async function fillValid(page) {
  await page.$eval('#interest-form', (form) => form.reset());
  await page.type('#name', 'Avery Cole');
  await page.type('#email', 'avery@example.com');
  await page.type('#phone', '(203) 555-0199');
  await page.select('#license-status', 'In pre-licensing course');
  await page.select('#years-licensed', 'Not yet');
  await page.type('#message', 'Interested in learning how the team supports newer agents.');
  await page.click('#consent');
}

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars'],
});

const server = await startStatic();
const { port } = server.address();
const pageUrl = `http://127.0.0.1:${port}${prefix}/?utm_source=instagram&utm_medium=bio&utm_campaign=spring&utm_term=newer&utm_content=hero&src=story`;
const external = [];
const pageErrors = [];

try {
  const page = await browser.newPage();
  page.on('request', (req) => {
    const url = req.url();
    if (!url.startsWith(`http://127.0.0.1:${port}/`) && !url.startsWith('data:')) {
      external.push(url);
    }
  });
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (text.includes('could not be sent')) return;
    if (text.includes('Failed to load resource') || text.includes('net::')) return;
    pageErrors.push(text);
  });

  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.goto(pageUrl, { waitUntil: 'load' });
  await settle(page);

  const logo = await page.$eval('.brand img', (img) => ({
    width: img.naturalWidth,
    complete: img.complete,
    alt: img.alt,
  }));
  assert(logo.complete && logo.width === 1200, 'logo did not load');
  assert(logo.alt === 'Criterion', 'logo alt text missing');

  const footer = await page.$eval('.site-footer', (node) => node.innerText);
  assert(footer.includes('Equal Housing Opportunity'), 'missing equal housing line');
  assert(footer.includes('Criterion Real Estate LLC, licensed in CT & NY.'), 'missing legal line');

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  assert(!overflow, 'desktop page overflows horizontally');
  assert(external.length === 0, `third-party requests: ${external.join(', ')}`);
  assert(pageErrors.length === 0, `page errors: ${pageErrors.join(' | ')}`);

  await mkdir(shots, { recursive: true });
  await page.screenshot({ path: join(shots, 'desktop.png'), fullPage: true });

  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.reload({ waitUntil: 'load' });
  await settle(page);
  const mobileOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  assert(!mobileOverflow, 'mobile page overflows horizontally');
  await page.screenshot({ path: join(shots, 'mobile.png'), fullPage: true });

  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1, isMobile: false, hasTouch: false });
  await page.reload({ waitUntil: 'load' });
  await settle(page);

  await page.click('#submit-interest');
  await page.waitForSelector('#form-alert:not([hidden])');
  const nameError = await page.$eval('#name-error', (node) => node.textContent);
  assert(nameError.includes('Enter your name'), 'validation error missing');

  const posts = [];
  page.on('request', (req) => {
    if (req.method() === 'POST') posts.push(req.url());
  });

  const loggedPayload = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timed out waiting for payload log')), 8000);
    const onConsole = async (msg) => {
      if (msg.type() !== 'log') return;
      const values = [];
      for (const arg of msg.args()) values.push(await arg.jsonValue());
      const note = values.find((value) => typeof value === 'string' && value.includes('FORM_ENDPOINT is empty'));
      if (!note) return;
      clearTimeout(timer);
      page.off('console', onConsole);
      resolve(values);
    };
    page.on('console', onConsole);
  });

  await fillValid(page);
  await page.click('#submit-interest');
  await page.waitForSelector('#form-success:not([hidden])');
  const logged = await loggedPayload;
  const localCopy = await page.$eval('#form-success [data-for="local"]', (node) => ({
    hidden: node.hidden,
    text: node.textContent,
  }));
  assert(localCopy.hidden === false, 'local success copy hidden');
  assert(/not sent|not connected/i.test(localCopy.text), 'local success copy is misleading');
  const payload = logged.find((value) => value && typeof value === 'object');
  assert(payload?.utm_source === 'instagram', `utm_source missing: ${JSON.stringify(logged)}`);
  assert(payload?.utm_medium === 'bio', 'utm_medium missing');
  assert(payload?.utm_campaign === 'spring', 'utm_campaign missing');
  assert(payload?.utm_term === 'newer', 'utm_term missing');
  assert(payload?.utm_content === 'hero', 'utm_content missing');
  assert(payload?.src === 'story', 'src missing');
  assert(payload?.license_status === 'In pre-licensing course', 'license status missing from payload');
  assert(payload?.consent === true, 'consent missing from payload');
  assert(posts.length === 0, `unexpected posts: ${posts.join(', ')}`);

  await page.reload({ waitUntil: 'load' });
  await settle(page);
  await page.evaluate(() => {
    window.CRITERION_CONFIG.FORM_ENDPOINT = 'http://127.0.0.1:9/leads';
  });
  await fillValid(page);
  await page.click('#submit-interest');
  await page.waitForFunction(() => {
    const alert = document.querySelector('#form-alert');
    return alert && !alert.hidden && /could not send/i.test(alert.textContent);
  });
  const formStillThere = await page.$eval('#interest-form', (node) => node.hidden === false);
  assert(formStillThere, 'failed submit hid the form');
  assert(pageErrors.length === 0, `page errors: ${pageErrors.join(' | ')}`);

  console.log('Verified subpath build, screenshots, validation, local success, and error state.');
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
