// Run with the local Python server listening; all Jev calls are intercepted.
// Optional PLAYWRIGHT_MODULE points to an existing Playwright installation.
const assert = require('node:assert/strict');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.ARENA_URL || 'http://127.0.0.1:8787';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [], payloads = [];
  let reply = null, delay = 0;
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/config', route => route.fulfill({ json: { hasEnvKey: true, modelDefault: 'jev-test' } }));
  await page.route('**/v1/systemone', async route => {
    const request = route.request().postDataJSON();
    payloads.push(request);
    const lan = reply || Object.keys(request.questions.move.criteria)[0];
    if (delay) await new Promise(resolve => setTimeout(resolve, delay));
    await route.fulfill({ json: { answers: { move: { choice: lan, confidence: 0.75, probabilities: { [lan]: 1 } } }, usage: { input_tokens: 100 }, model: 'jev-test' } }).catch(() => {});
  });
  const text = id => page.locator('#' + id).textContent();
  const waitRated = async () => page.waitForFunction(() => document.getElementById('reviewStatus').textContent.startsWith('Depth'), { timeout: 30000 });
  const humanMove = async (from, to) => page.locator('#board').evaluate((board, move) => {
    board.dispatchEvent(new CustomEvent('moveend', { detail: move, cancelable: true }));
  }, { from, to });
  const start = async (fen = '', side = 'white') => {
    await page.locator(`[data-side="${side}"]`).click();
    await page.locator('#fenIn').fill(fen);
    await page.locator('#startBtn').click();
  };
  try {
    await page.goto(base + '/arena/');
    await waitRated();
    const layout = await page.evaluate(() => {
      const board = document.getElementById('board').getBoundingClientRect();
      const review = document.getElementById('reviewPanel').getBoundingClientRect();
      return { bw: board.width, bh: board.height, br: board.right, rl: review.left };
    });
    assert.ok(layout.bw >= 480 && Math.abs(layout.bw - layout.bh) < 2, JSON.stringify(layout));
    assert.ok(layout.rl >= layout.br - 8, JSON.stringify(layout));
    await page.locator('#resetScore').click();
    assert.equal(await text('jevWdl'), '0-0-0');
    assert.equal(await text('colorWins'), '0 / 0');
    assert.match(await text('evalValue'), /^[+−-]?\d/);
    assert.equal(await text('whiteMaterial'), 'even');
    assert.equal(await page.locator('#operatorReview').isChecked(), true);
    console.log('ok real Stockfish WASM depth-10 startup');

    // Human and Jev plies both receive evaluation and contribute to their sides.
    reply = 'd7d5';
    await start();
    await humanMove('e2', 'e4');
    await page.waitForFunction(() => document.querySelectorAll('#history .ply').length === 2);
    await page.locator('#pauseBtn').click();
    await humanMove('e4', 'd5');
    await waitRated();
    assert.equal(await text('whiteMaterial'), '+1');
    assert.equal(await text('blackMaterial'), '-1');
    assert.equal(await text('bottomMaterial'), '+1');
    assert.equal(await text('bottomCaptures'), '♟');
    assert.equal(await text('whiteReviewCount'), '2 / 2 plies rated');
    assert.equal(await text('blackReviewCount'), '1 / 1 plies rated');
    assert.equal(await page.locator('#history .ply-quality').count(), 3);
    assert.equal(await page.locator('#evalGraph .eval-point').count(), 4);
    assert.equal(await text('whiteLast'), 'exd5  e4d5');
    for (const payload of payloads) {
      assert.deepEqual(Object.keys(payload.state).sort(), ['ending', 'fen', 'last', 'phase', 'stm']);
      assert.doesNotMatch(JSON.stringify(payload), /"(?:cp|best|pv|class|accuracy|captures|net)"\s*:/);
    }
    console.log('ok human/Jev review, capture math, history glyphs and payload firewall');

    await page.locator('#history [data-ply="1"]').click();
    assert.equal(await text('whiteMaterial'), 'even');
    assert.equal(await text('reviewPly'), 'Ply 1 / 3');
    assert.equal(await text('ltSan'), 'e4');
    assert.equal(await page.locator('#evalGraph').getAttribute('aria-valuenow'), '1');
    await page.locator('#evalGraph').focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(await text('reviewPly'), 'Ply 2 / 3');
    await page.keyboard.press('Home');
    assert.equal(await text('reviewPly'), 'Ply 0 / 3');
    await page.locator('#livePly').click();
    console.log('ok tape/graph replay and keyboard cursor');

    await page.locator('#operatorReview').uncheck();
    assert.equal(await page.locator('#reviewHud').isVisible(), false);
    assert.equal(await page.locator('#evalBar').isVisible(), false);
    assert.equal(await page.locator('#history').isVisible(), true);
    assert.equal(await page.locator('#history .ply-quality').count(), 0);
    assert.equal(await text('whiteMaterial'), '+1');
    await page.locator('#operatorReview').check();
    await waitRated();
    assert.equal(await page.locator('#history .ply-quality').count(), 3);
    console.log('ok review toggle preserves material and restores ratings');

    await page.locator('#operatorReview').uncheck();
    await start();
    await humanMove('e2', 'e4');
    await page.waitForFunction(() => document.querySelectorAll('#history .ply').length === 2);
    assert.equal(await page.locator('#history .ply-quality').count(), 0);
    await page.locator('#operatorReview').check();
    await waitRated();
    assert.equal(await text('whiteReviewCount'), '1 / 1 plies rated');
    assert.equal(await text('blackReviewCount'), '1 / 1 plies rated');
    console.log('ok backfill for moves played while review was off');

    // Reset while analysis is pending, then finish a human mate from custom FEN.
    await start();
    const mateFen = '7k/5K2/6Q1/8/8/8/8/8 w - - 0 1';
    await start(mateFen);
    await humanMove('g6', 'g7');
    await waitRated();
    assert.match(await text('statusText'), /Checkmate.*White wins/);
    assert.equal(await page.locator('#endOverlay').evaluate(el => el.classList.contains('show')), true);
    assert.match(await page.locator('#endResult').textContent(), /Checkmate.*White wins/);
    await page.locator('#endClose').click();
    assert.equal(await page.locator('#endOverlay').evaluate(el => el.classList.contains('show')), false);
    assert.equal(await text('whiteScoreLabel'), 'Game scorecard');
    assert.equal(await text('whiteReviewCount'), '1 / 1 plies rated');
    assert.equal(await text('blackReviewCount'), '0 / 0 plies rated');
    assert.equal(await text('evalValue'), '+M0');
    assert.equal(await page.locator('#evalFill').evaluate(el => el.style.height), '100%');
    assert.equal(await text('colorWins'), '1 / 0');
    assert.equal(await text('jevWdl'), '0-0-1');
    assert.equal(await text('jevGames'), '1');
    await page.locator('#prevPly').click();
    assert.equal(await text('colorWins'), '1 / 0');
    assert.equal((await page.locator('#board').evaluate(el => el.fen)).split(' ')[0], mateFen.split(' ')[0]);
    assert.equal(await text('whiteReviewCount'), '0 / 0 plies rated');
    console.log('ok pending reset, terminal mate, scorecard and custom-FEN ply zero');

    const blackMate = '8/8/8/8/8/6q1/5k2/7K b - - 0 1';
    await start(blackMate, 'black');
    await humanMove('g3', 'g2');
    await waitRated();
    assert.equal(await text('evalValue'), '−M0');
    assert.equal(await page.locator('#evalFill').evaluate(el => el.style.height), '0%');
    assert.equal(await text('bottomCaptureSide'), 'Black');
    assert.equal(await text('blackReviewCount'), '1 / 1 plies rated');
    assert.equal(await text('colorWins'), '1 / 1');
    assert.equal(await text('jevWdl'), '0-0-2');
    console.log('ok Black POV, negative-zero mate and orientation');

    // Resume/step cannot duplicate a pending request; old-match finally cannot
    // unlock the human board while a replacement match is still thinking.
    reply = 'e2e4'; delay = 800;
    const requestsBefore = payloads.length;
    await start('', 'black');
    await page.waitForFunction(() => document.getElementById('statusText').textContent === 'Jev on program…');
    await page.locator('#pauseBtn').click();
    await page.locator('#pauseBtn').click();
    await page.locator('#stepBtn').click();
    await page.waitForTimeout(100);
    assert.equal(payloads.length, requestsBefore + 1);
    await start('', 'black');
    await page.waitForTimeout(100);
    assert.equal(await text('statusText'), 'Jev on program…');
    assert.equal(await page.locator('#board').getAttribute('interactive'), null);
    await page.waitForFunction(() => document.querySelectorAll('#history .ply').length === 1);
    delay = 0;
    await waitRated();
    assert.equal(await text('whiteReviewCount'), '1 / 1 plies rated');
    console.log('ok duplicate-request guard and stale-match isolation');

    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: join(tmpdir(), 'jev-arena-mobile.png'), fullPage: true });
    const mobile = await page.evaluate(() => {
      const board = document.getElementById('board').getBoundingClientRect();
      return { width: board.width, height: board.height, right: board.right, viewport: innerWidth, documentWidth: document.documentElement.scrollWidth };
    });
    assert.ok(mobile.width > 250 && Math.abs(mobile.width - mobile.height) < 1, JSON.stringify(mobile));
    assert.ok(mobile.right <= mobile.viewport && mobile.documentWidth <= mobile.viewport, JSON.stringify(mobile));
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({ path: join(tmpdir(), 'jev-arena-reviewed.png'), fullPage: true });
    assert.deepEqual(errors, []);
    console.log('ok mobile square board/no overflow and no browser errors');

    const unavailable = await browser.newPage();
    await unavailable.route('**/config', route => route.fulfill({ json: { hasEnvKey: false } }));
    await unavailable.route('**/vendor/stockfish/**', route => route.abort());
    await unavailable.goto(base + '/arena/');
    await unavailable.waitForFunction(() => document.getElementById('reviewStatus').textContent.includes('unavailable'));
    await unavailable.locator('#startBtn').click();
    await unavailable.locator('#pauseBtn').click();
    await unavailable.locator('#board').evaluate(board => board.dispatchEvent(new CustomEvent('moveend', { detail: { from: 'e2', to: 'e4' }, cancelable: true })));
    assert.equal(await unavailable.locator('#history .ply').count(), 1);
    assert.equal(await unavailable.locator('#whiteMaterial').textContent(), 'even');
    await unavailable.close();
    console.log('ok engine load failure leaves chess playable');
  } catch (error) {
    console.error('Browser errors:', errors);
    console.error('Status:', await text('statusText'), 'Review:', await text('reviewStatus'));
    throw error;
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
