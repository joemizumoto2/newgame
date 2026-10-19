// 問題データの点検。使い方: node games/nengo/tools/check.js [回数]
// ・年号の重複、札の空欄 ・ダミーに正解と同じ札や同じ人物が混ざらないか ・トロフィーの年号が実在するか
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const src = html.split('<script>')[1].split('</script>')[0];
const m = { exports: {} }; new Function('module', src)(m);
const G = m.exports, N = +process.argv[2] || 500, errs = [];
const ys = G.EVENTS.map(e => e.y);
if (new Set(ys).size !== ys.length) errs.push('年号が重複している');
ys.forEach((y, i) => { if (i && ys[i - 1] >= y) errs.push('年の順が崩れている: ' + y); });
for (const e of G.EVENTS) if (e.parts.some(p => !p) || !e.text || !e.name) errs.push('空欄: ' + e.y);
for (const t of G.TROPHIES) for (const y of t.ys || []) if (!G.EV[y]) errs.push(`トロフィー ${t.id} に無い年号 ${y}`);
const uses = {};
for (const e of G.EVENTS) for (let k = 0; k < N; k++) {
  const q = G.makeQuiz(e.y);
  q.opts.forEach((o, s) => {
    if (o.length !== 3 || new Set(o).size !== 3) errs.push(`${e.y} ${s + 1}枚目の選択肢が3つ揃わない`);
    if (o.filter(t => t === e.parts[s]).length !== 1) errs.push(`${e.y} ${s + 1}枚目に正解が1つない`);
    for (const t of o) if (t !== e.parts[s]) { (uses[t] = uses[t] || 0); uses[t]++; if (G.nameSet(t).some(n => G.nameSet(e.parts[s]).includes(n))) errs.push(`${e.y} に同じ人物の札: ${t}`); }
  });
  // 正解の手順を通す
  q.opts.forEach((o, s) => G.pick(q, s, o.indexOf(e.parts[s])));
  if (G.check(q) !== 0 || !q.done) errs.push('正解で開かない: ' + e.y);
}
// 何も考えずに選んだときに一発で当たる率（27通り中1通りなら約4%）
let hit = 0; for (let k = 0; k < 20000; k++) { const e = G.EVENTS[k % G.EVENTS.length], q = G.makeQuiz(e.y); q.opts.forEach((o, s) => G.pick(q, s, Math.floor(Math.random() * 3))); if (G.check(q) === 0) hit++; }
// 全部開けたときのトロフィー
const st = G.newState(); for (const e of G.EVENTS) G.record(st, { y: e.y, misses: 0 });
console.log('出来事', G.EVENTS.length, '件 / トロフィー', G.TROPHIES.length, '個（全部一発正解なら', G.earned(st).length, '個）');
console.log('でたらめに選んで一発正解:', (hit / 200).toFixed(1) + '%');
console.log('時代ごと:', G.ERAS.map((n, i) => n + G.EVENTS.filter(e => e.era === i).length).join(' '));
console.log(errs.length ? [...new Set(errs)].slice(0, 30).join('\n') : 'エラーなし');
