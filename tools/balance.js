// 自動プレイで数値の釣り合いを確かめる。使い方: node tools/balance.js [回数] [std|slow]
// index.html の1つ目の <script>（ゲームの中身）だけを取り出して動かす。
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const logic = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const N = +process.argv[2] || 2000, MODE = process.argv[3] === 'slow' ? 'slow' : 'std';
const ctx = vm.createContext({ console, Math });
vm.runInContext(logic + `
function fight(g,kind){
  g.type=computeType(g.s);const b=battleSetup(g,kind),m=battleMods(g,kind);
  const r=simulate(g,b.opp,b.field,pick(Object.keys(TACTICS)),pick(Object.keys(TACTICS)),(Math.random()*1e9)|0,m);
  if(r.ticks.some(t=>!isFinite(t.f)))throw new Error('NaN in battle');
  playOutcome(g,kind,r.end.winner==='p',b.opp,m);
}
function newNation(slow){
  const g=buildFromAnswers(QUESTIONS.slice(0,qCount(slow)).map(q=>offerOpts(q)[Math.floor(Math.random()*4)]));
  g.name=genName(g);g.flag=genFlag(g);g.type=computeType(g.s);return g;
}
function playReign(){
  const g=newNation(false);
  for(g.turn=1;g.turn<=10;g.turn++){
    const cards=drawCards(g);let id=pick(cards);if(g.morale<35&&cards.includes('fest'))id='fest';
    playCard(g,id);
    const e=nextEvent(g);if(e)playEvent(g,e,Math.floor(Math.random()*getEvent(e).choices.length));
    const kind=battleKindAt(g);if(kind)fight(g,kind);
  }
  g.turn=10;finalize(g);return g;
}
const ST={builds:0,minor:0,events:0,invade:0,gold:0,hands:0};
function playSlow(){
  const g=newNation(true);startSlow(g);
  for(g.turn=1;g.turn<=SLOW.years;g.turn++){
    beginYear(g);
    let offers=drawCards(g);
    if(g.morale<35&&offers.includes('fest')&&!whyNot(g,'fest')){startProject(g,'fest');offers=offers.filter(x=>x!=='fest')}
    for(const id of offers.sort(()=>Math.random()-.5)) if(!whyNot(g,id)&&roll(.85)){startProject(g,id);ST.builds++}
    g.proj.forEach((p,i)=>{if(roll(.3))hurry(g,i)});
    endYear(g);
    const ev=slowEvent(g);
    if(ev.minor){playMinor(g,ev.minor);ST.minor++}
    if(ev.id){playEvent(g,ev.id,Math.floor(Math.random()*getEvent(ev.id).choices.length));ST.events++}
    const kind=decideWar(g);if(kind){if(kind==='invade')ST.invade++;fight(g,kind)}
  }
  g.turn=SLOW.years;finalize(g);ST.gold+=g.gold;ST.hands+=g.hands;return g;
}
const W={bandit:[0,0],invade:[0,0],final:[0,0]},titles={},ranks={},tro={};
for(let i=0;i<${N};i++){const g=${MODE === 'slow' ? 'playSlow' : 'playReign'}();g.battles.forEach(b=>{W[b.kind][0]++;if(b.win)W[b.kind][1]++});
  const e=endingOf(g);titles[e.title]=(titles[e.title]||0)+1;ranks[g.rank]=(ranks[g.rank]||0)+1;
  trophiesOf(g,e).forEach(t=>tro[t]=(tro[t]||0)+1)}
console.log('モード','${MODE}');
console.log('勝率',Object.entries(W).map(([k,[n,w]])=>k+' '+(n?(w/n*100).toFixed(0):'-')+'%').join(' / '));
console.log('結末',JSON.stringify(titles));
console.log('国家ランク',JSON.stringify(ranks));
console.log('トロフィー(%)',JSON.stringify(Object.fromEntries(TROPHIES.map(t=>[t.name,+((tro[t.id]||0)/${N}*100).toFixed(1)]))));
if('${MODE}'==='slow')console.log('1国あたり: 着工',(ST.builds/${N}).toFixed(1),'/ 選択の出来事',(ST.events/${N}).toFixed(1),'/ 小さな出来事',(ST.minor/${N}).toFixed(1),'/ 侵攻',(ST.invade/${N}).toFixed(2),'/ 残った金貨',(ST.gold/${N}).toFixed(1),'人手',(ST.hands/${N}).toFixed(1));
`, ctx);
