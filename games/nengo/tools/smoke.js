// ブラウザで「1問まちがえて解く → 正解 → 何問か開く → トロフィー」と遊び、エラーとスクリーンショットを確かめる。
// 使い方: node games/nengo/tools/smoke.js [出力フォルダ]   （playwright と Chromium が必要）
const { chromium } = require('playwright'), fs = require('fs'), path = require('path');
const out = process.argv[2] || path.join(require('os').tmpdir(), 'nengo-smoke');
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const page = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>[hidden]{display:none!important}</style></head><body>'
    + fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8') + '</body></html>';
  fs.writeFileSync(path.join(out, 'page.html'), page);
  const b = await chromium.launch(), errs = [], shots = {};
  for (const scheme of ['light', 'dark']) {
    const p = await b.newPage({ viewport: { width: 400, height: 860 }, colorScheme: scheme });
    p.on('pageerror', e => errs.push(e.message));
    await p.goto('file://' + path.join(out, 'page.html'));
    await p.waitForTimeout(400);
    const shot = async n => { await p.screenshot({ path: path.join(out, `${scheme}-${n}.png`), fullPage: n !== 'home' }); };
    // 1問目：わざと1枚まちがえる
    await p.click('[data-act=quiz][data-y="1582"]');
    const right = await p.evaluate(() => APP.q.opts.map((o, s) => o.indexOf(EV[APP.q.y].parts[s])));
    await p.click(`[data-act=pick][data-s="0"][data-i="${(right[0] + 1) % 3}"]`);
    await p.click(`[data-act=pick][data-s="1"][data-i="${right[1]}"]`);
    await p.click(`[data-act=pick][data-s="2"][data-i="${right[2]}"]`);
    await p.click('[data-act=check]');
    await shot('wrong');
    await p.click(`[data-act=pick][data-s="0"][data-i="${right[0]}"]`);
    await p.click('[data-act=check]');
    if (await p.evaluate(() => APP.screen) !== 'reveal') errs.push('正解で開かない');
    // 太子の3問を一発正解で開いてトロフィー
    for (const y of [593, 604, 607]) {
      await p.click('[data-act=home]'); await p.click(`[data-act=quiz][data-y="${y}"]`);
      const r = await p.evaluate(() => APP.q.opts.map((o, s) => o.indexOf(EV[APP.q.y].parts[s])));
      for (let s = 0; s < 3; s++) await p.click(`[data-act=pick][data-s="${s}"][data-i="${r[s]}"]`);
      await p.click('[data-act=check]');
    }
    await shot('reveal');
    await p.click('[data-act=home]'); await shot('home');
    await p.click('[data-act=trophies]'); await shot('trophies');
    shots[scheme] = await p.evaluate(() => ({ w: document.documentElement.scrollWidth, open: Object.keys(APP.st.open).length, tro: earned(APP.st) }));
    await p.close();
  }
  console.log(shots);
  console.log('エラー:', errs.length ? errs : 'なし', '/ スクリーンショット:', out);
  await b.close();
})();
