// ブラウザで最初から結末まで自動で遊び、エラーとスクリーンショットを確かめる。
// 使い方: node tools/smoke.js [出力フォルダ]   （playwright と Chromium が必要）
const { chromium } = require('playwright'), fs = require('fs'), path = require('path');
const out = process.argv[2] || path.join(require('os').tmpdir(), 'kenkoku-smoke');
(async () => {
  fs.mkdirSync(out, { recursive: true });
  // 公開時に付く外枠の代わり
  const page = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>[hidden]{display:none!important}</style></head><body>'
    + fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8') + '</body></html>';
  fs.writeFileSync(path.join(out, 'page.html'), page);
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 400, height: 860 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(out, 'page.html'));
  const click = s => p.click(s, { timeout: 4000 });
  await click('[data-act=start]');
  for (let i = 0; i < 8; i++) await click(`[data-act=answer][data-i="${i % 3}"]`);
  await click('[data-act=crown]');
  for (let step = 0; step < 200; step++) {
    const scr = await p.evaluate(() => APP.screen);
    if (scr === 'ending') break;
    if (await p.$('[data-act=card]')) { if (await p.evaluate(() => APP.g.turn === 6)) await p.screenshot({ path: path.join(out, 'reign.png'), fullPage: true }); await click('[data-act=card][data-i="0"]'); continue; }
    if (await p.$('[data-act=choose]')) { await p.screenshot({ path: path.join(out, 'event.png'), fullPage: true }); await click('[data-act=choose][data-i="0"]'); continue; }
    if (await p.$('[data-act=prep]')) { await click('[data-act=prep]'); continue; }
    if (scr === 'campaign') { await click('[data-act=fight]'); continue; }
    if (scr === 'battle') { await p.waitForTimeout(1200); await p.screenshot({ path: path.join(out, 'battle.png') }); await click('[data-act=skip]'); await p.waitForSelector('[data-act=back-reign]'); await click('[data-act=back-reign]'); continue; }
    if (await p.$('[data-act=next]')) { await click('[data-act=next]'); continue; }
    errs.push('進めなくなった: ' + scr); break;
  }
  await p.screenshot({ path: path.join(out, 'ending.png'), fullPage: true });
  console.log('最後の画面:', await p.evaluate(() => APP.screen), '/ 横幅:', await p.evaluate(() => document.documentElement.scrollWidth));
  console.log('エラー:', errs.length ? errs : 'なし', '/ スクリーンショット:', out);
  await b.close();
})();
