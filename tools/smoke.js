// ブラウザで最初から結末まで自動で遊び、エラーとスクリーンショットを確かめる。
// 使い方: node tools/smoke.js [std|slow] [出力フォルダ]   （playwright と Chromium が必要）
const { chromium } = require('playwright'), fs = require('fs'), path = require('path');
const mode = process.argv[2] === 'slow' ? 'slow' : 'std';
const out = process.argv[3] || path.join(require('os').tmpdir(), 'kenkoku-smoke-' + mode);
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
  const shot = (name, full = true) => p.screenshot({ path: path.join(out, name + '.png'), fullPage: full });
  await shot('title');
  await click(`[data-act=start][data-mode=${mode}]`);
  for (let i = 0; i < (mode === 'slow' ? 12 : 8); i++) { if (i === 3) await shot('question'); await click(`.opt >> nth=${i % 4}`); }
  await click('[data-act=crown]');
  let wide = 0;
  for (let step = 0; step < 400; step++) {
    const scr = await p.evaluate(() => APP.screen);
    wide = Math.max(wide, await p.evaluate(() => document.documentElement.scrollWidth));
    if (scr === 'ending') break;
    if (await p.$('[data-act=card]')) { if (await p.evaluate(() => APP.g.turn === 6)) await shot('reign'); await click('[data-act=card][data-i="0"]'); continue; }
    if (await p.$('button.btn[data-act=rv-next]')) {
      const st = await p.evaluate(() => APP.rv && APP.rv.shown);
      if (st === 2 && !fs.existsSync(path.join(out, 'reveal.png'))) await shot('reveal');
      if (await p.evaluate(() => APP.g.turn === 15 && !APP.auto)) await click('[data-act=rv-auto][data-v="2"]'); // 2倍速も一度通す
      await click('button.btn[data-act=rv-next]'); continue;
    }
    if (await p.$('[data-act=policy]')) {
      const y = await p.evaluate(() => APP.g.turn);
      if (y === 8) await p.evaluate(() => { APP.g.war = 99; }); // 予告と侵攻の画面を必ず通す
      if (y === 5 && await p.$('[data-act=borrow]:not([disabled])')) await click('[data-act=borrow]');
      if (y === 6 && await p.$('[data-act=immig]:not([disabled])')) { await click('[data-act=immig]'); await shot('quick'); }
      const b1 = await p.$('[data-act=build]:not([disabled])'); if (b1) await b1.click();
      const h = await p.$('[data-act=hurry]:not([disabled]) >> nth=0'); if (h && y % 4 === 0) await h.click();
      if (y === 12 || (y > 12 && await p.$('.alarm') && !fs.existsSync(path.join(out, 'alarm.png')))) await shot(y === 12 ? 'plan' : 'alarm');
      await click('[data-act=policy]:not([disabled])'); continue;
    }
    if (await p.$('[data-act=choose]')) { await shot(await p.evaluate(() => APP.ev === 'debt_collect') ? 'debt' : 'event'); await click('[data-act=choose]:not([disabled]) >> nth=0'); continue; }
    if (await p.$('[data-act=prep]')) { await click('[data-act=prep]'); continue; }
    if (scr === 'campaign') { if (!fs.existsSync(path.join(out, 'campaign.png'))) await shot('campaign'); await click('[data-act=fight]'); continue; }
    if (scr === 'battle') { await p.waitForTimeout(1200); await shot('battle', false); if (await p.isVisible('[data-act=skip]')) await click('[data-act=skip]').catch(() => {}); await p.waitForSelector('[data-act=back-reign]'); await click('[data-act=back-reign]'); continue; }
    if (await p.$('[data-act=next]')) { await click('[data-act=next]'); continue; }
    errs.push('進めなくなった: ' + scr); break;
  }
  await shot('ending');
  if (await p.$('[data-act=keep]:not([disabled])')) {
    await click('[data-act=keep]'); await click('[data-act=archive]'); await shot('archive');
    await click('[data-act=open-rec]'); await shot('record');
    await click('[data-act=home]').catch(() => click('[data-act=archive]'));
  }
  await p.evaluate(() => show('trophies')); await shot('trophies');
  console.log('最後の画面:', await p.evaluate(() => APP.screen), '/ 年:', await p.evaluate(() => APP.g && APP.g.turn), '/ 最大横幅:', wide);
  console.log('エラー:', errs.length ? errs : 'なし', '/ スクリーンショット:', out);
  await b.close();
})();
