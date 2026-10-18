// 自動プレイで数値の釣り合いを確かめる。使い方: node tools/balance.js [回数]
// index.html の1つ目の <script>（ゲームの中身）だけを取り出して動かす。
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const logic = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const N = +process.argv[2] || 2000;
const ctx = vm.createContext({ console, Math });
vm.runInContext(logic + `
function playReign(){
  const g=buildFromAnswers(QUESTIONS.map(q=>Math.floor(Math.random()*q.opts.length)));
  g.name=genName(g);g.flag=genFlag(g);g.type=computeType(g.s);
  for(g.turn=1;g.turn<=10;g.turn++){
    const cards=drawCards(g);let id=pick(cards);if(g.morale<35&&cards.includes('fest'))id='fest';
    playCard(g,id);
    const e=nextEvent(g);if(e)playEvent(g,e,Math.floor(Math.random()*getEvent(e).choices.length));
    const kind=battleKindAt(g);
    if(kind){g.type=computeType(g.s);const b=battleSetup(g,kind),m=battleMods(g,kind);
      const r=simulate(g,b.opp,b.field,pick(Object.keys(TACTICS)),pick(Object.keys(TACTICS)),(Math.random()*1e9)|0,m);
      if(r.ticks.some(t=>!isFinite(t.f)))throw new Error('NaN in battle');
      playOutcome(g,kind,r.end.winner==='p',b.opp,m)}
  }
  g.turn=10;finalize(g);return g;
}
const W={bandit:[0,0],invade:[0,0],final:[0,0]},titles={},ranks={};
for(let i=0;i<${N};i++){const g=playReign();g.battles.forEach(b=>{W[b.kind][0]++;if(b.win)W[b.kind][1]++});
  const e=endingOf(g);titles[e.title]=(titles[e.title]||0)+1;ranks[g.rank]=(ranks[g.rank]||0)+1}
console.log('勝率',Object.entries(W).map(([k,[n,w]])=>k+' '+(w/n*100).toFixed(0)+'%').join(' / '));
console.log('結末',JSON.stringify(titles));
console.log('国家ランク',JSON.stringify(ranks));
`, ctx);
