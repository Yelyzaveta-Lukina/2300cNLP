// End-to-end check for the landing page link and the Word2Vec Lab page.
// Usage: node word2vec/tests/e2e.js   (SHOT_DIR=/some/dir to choose where screenshots go)
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const net = require('net');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const SHOT_DIR = process.env.SHOT_DIR || '/tmp';
const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};

function freePort() {
  return new Promise((res) => {
    const s = net.createServer();
    s.listen(0, () => { const p = s.address().port; s.close(() => res(p)); });
  });
}
async function waitForServer(url, ms = 10000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try { const r = await fetch(url); if (r.ok) return; } catch (_) {}
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error('server did not start');
}

// Selectors (kept in one place so they are easy to adjust to the page).
const SEL = {
  wordInput: '#word-input, input[type=search], input[type=text]',
  results: '#results li, #neighbors li, [data-neighbor]',
  plot2d: '#plot-2d, #plot2d',
  plot3d: '#plot-3d, #plot3d',
};

async function submitWord(page, word) {
  const input = page.locator(SEL.wordInput).first();
  await input.fill('');
  await input.fill(word);
  await input.press('Enter');
  await page.waitForTimeout(800);
}

(async () => {
  const port = await freePort();
  const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
  const base = `http://127.0.0.1:${port}`;
  let browser;
  const errors = [];
  try {
    await waitForServer(base + '/index.html');
    browser = await chromium.launch();
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`[console] ${page.url()} ${m.text()}`); });
    page.on('pageerror', (e) => errors.push(`[pageerror] ${page.url()} ${e.message}`));

    // 1. Landing page link
    await page.goto(base + '/index.html');
    const link = page.locator('a', { hasText: 'Word2Vec Lab' }).first();
    await link.waitFor({ timeout: 20000 }).catch(() => {});
    const href = (await link.count()) ? await link.getAttribute('href') : null;
    check('landing page has "Word2Vec Lab" link to word2vec.html', !!href && /word2vec\.html$/.test(href), `href=${href}`);
    await page.screenshot({ path: path.join(SHOT_DIR, 'e2e-landing.png') });
    if (href) {
      await Promise.all([page.waitForURL(/word2vec\.html/, { timeout: 10000 }).catch(() => {}), link.click()]);
    }
    check('clicking link opens word2vec.html', /word2vec\.html/.test(page.url()), page.url());
    if (!/word2vec\.html/.test(page.url())) await page.goto(base + '/word2vec.html');

    // 2. Model load
    const input = page.locator(SEL.wordInput).first();
    let loaded = false;
    try { await page.waitForFunction((s) => { const el = document.querySelector(s); return el && !el.disabled; }, SEL.wordInput, { timeout: 30000 }); loaded = true; } catch (_) {}
    check('model loads and word input becomes enabled', loaded);

    // 3. Nearest neighbours for "king"
    await submitWord(page, 'king');
    await page.waitForFunction((s) => document.querySelectorAll(s).length > 0, SEL.results, { timeout: 10000 }).catch(() => {});
    const words = await page.$$eval(SEL.results, (els) => els.map((e) => (e.getAttribute('data-neighbor') || e.querySelector('[data-word], .word')?.textContent || e.textContent).trim().toLowerCase()));
    check('exactly 10 neighbours for "king"', words.length === 10, `got ${words.length}: ${words.map((w) => w.split(/\s+/)[0]).join(', ')}`);
    check('"king" is not among its own neighbours', words.length > 0 && !words.some((w) => w.split(/\s+/)[0] === 'king'));

    // 4. Plots
    await page.waitForTimeout(1500);
    const has2d = await page.locator(`${SEL.plot2d} .scatterlayer, .js-plotly-plot .cartesianlayer .scatterlayer`).count();
    const has3d = await page.locator(`${SEL.plot3d} .gl-container, .js-plotly-plot .gl-container, .js-plotly-plot [id^=scene]`).count();
    const plotCount = await page.locator('.js-plotly-plot').count();
    check('2D Plotly scatter is rendered', has2d > 0);
    check('3D Plotly scene is rendered', has3d > 0);
    check('at least two Plotly plots on the page', plotCount >= 2, `found ${plotCount}`);
    await page.screenshot({ path: path.join(SHOT_DIR, 'e2e-word2vec-king.png'), fullPage: true });

    // 5. Unknown word
    await submitWord(page, 'qwzxv');
    const body = (await page.locator('body').innerText()).toLowerCase();
    check('unknown word shows a not-found message', /not in (the )?vocab|not found|isn.t in|unknown word|no such word|not in the model/.test(body));

    // 6. Analogy
    const analogyInputs = page.locator('#analogy input, form[data-analogy] input, [id*=analogy] input');
    const n = await analogyInputs.count();
    let analogyOk = false, analogyDetail = `found ${n} analogy inputs`;
    if (n >= 3) {
      await analogyInputs.nth(0).fill('king');
      await analogyInputs.nth(1).fill('man');
      await analogyInputs.nth(2).fill('woman');
      await analogyInputs.nth(2).press('Enter');
      await page.waitForTimeout(800);
      const txt = (await page.locator('#analogy-results, #analogy-result, [id*=analogy] ol, [id*=analogy] ul').first().innerText().catch(() => '')).trim();
      analogyOk = txt.length > 0;
      analogyDetail = txt.replace(/\s+/g, ' ').slice(0, 120);
    }
    check('analogy king − man + woman returns results', analogyOk, analogyDetail);

    // 7. Phone width
    const phone = await browser.newContext({ viewport: { width: 375, height: 800 }, deviceScaleFactor: 1 });
    const p2 = await phone.newPage();
    p2.on('pageerror', (e) => errors.push(`[pageerror 375] ${e.message}`));
    p2.on('console', (m) => { if (m.type() === 'error') errors.push(`[console 375] ${m.text()}`); });
    await p2.goto(base + '/word2vec.html');
    await p2.waitForFunction((s) => { const el = document.querySelector(s); return el && !el.disabled; }, SEL.wordInput, { timeout: 30000 }).catch(() => {});
    await submitWord(p2, 'king');
    await p2.waitForTimeout(1500);
    const sw = await p2.evaluate(() => document.documentElement.scrollWidth);
    check('no horizontal scroll at 375px', sw <= 375, `scrollWidth=${sw}`);
    await p2.screenshot({ path: path.join(SHOT_DIR, 'e2e-word2vec-375.png'), fullPage: true });

    check('no console errors or page errors', errors.length === 0, errors.slice(0, 5).join(' | '));
  } catch (e) {
    check('test run completed without exception', false, e.message);
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
  const failed = results.filter((r) => !r).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
})();
