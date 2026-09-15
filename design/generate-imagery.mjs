// 아트보드를 받치는 분위기 이미지를 만든다.
//   node design/generate-imagery.mjs     (design/ 에서 실행)
// 실제 사진(직접 찍은 것이든 Unsplash 든)이 같은 자리에 그대로 들어간다.
// 이건 레이아웃이 비어 보이지 않게 하는 자리지기다.
import { chromium } from 'playwright';

// 매거진 레이아웃을 받치는 분위기 이미지.
// 컨테이너에서 Unsplash 에 못 나가므로 직접 렌더한다.
// 실제 사진(본인 사진이든 Unsplash 든)이 같은 자리에 그대로 들어간다.
const SETS = [
  { n:'daejeon',  w:1200, h:800,  a:'#3A1D12', b:'#B8642E', c:'#E8B072', ang:200, glow:'70% 25%' },
  { n:'interior', w:900,  h:1200, a:'#2B241C', b:'#8A7357', c:'#D9C8AE', ang:160, glow:'30% 20%' },
  { n:'golf',     w:1200, h:800,  a:'#0E2018', b:'#2F6B4A', c:'#8FBE92', ang:210, glow:'60% 30%' },
  { n:'books',    w:900,  h:1200, a:'#14162B', b:'#3A3F73', c:'#9AA0D0', ang:170, glow:'35% 25%' },
  { n:'travel',   w:1200, h:800,  a:'#1B2340', b:'#6B4A6E', c:'#E2896F', ang:190, glow:'75% 35%' },
  { n:'music',    w:900,  h:900,  a:'#1A1020', b:'#4A2747', c:'#C08BA8', ang:150, glow:'40% 30%' },
  { n:'film',     w:1200, h:800,  a:'#0B0A09', b:'#2A211A', c:'#C99B5E', ang:180, glow:'82% 45%' },
  { n:'career',   w:900,  h:600,  a:'#16181C', b:'#33393F', c:'#8E969E', ang:200, glow:'25% 20%' },
  { n:'cover',    w:1400, h:900,  a:'#2A1410', b:'#7A2C36', c:'#D9A06B', ang:195, glow:'68% 28%' },
];

const html = (s) => `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;padding:0}
.f{position:relative;width:${s.w}px;height:${s.h}px;overflow:hidden;background:${s.a}}
.g1{position:absolute;inset:0;background:
  radial-gradient(120% 90% at ${s.glow}, ${s.c} 0%, transparent 58%),
  radial-gradient(90% 70% at 12% 88%, ${s.b} 0%, transparent 62%),
  linear-gradient(${s.ang}deg, ${s.a} 12%, ${s.b} 62%, ${s.a} 100%);}
.g2{position:absolute;inset:0;mix-blend-mode:soft-light;opacity:.55;background:
  conic-gradient(from ${s.ang}deg at 45% 40%, ${s.c}55, transparent 28%, ${s.b}66 55%, transparent 78%, ${s.c}44);}
.blur{position:absolute;inset:-12%;filter:blur(46px);opacity:.9;background:
  radial-gradient(38% 30% at 22% 30%, ${s.c}88, transparent 70%),
  radial-gradient(45% 34% at 78% 68%, ${s.b}99, transparent 72%);}
.vig{position:absolute;inset:0;background:radial-gradient(130% 100% at 50% 42%, transparent 42%, #000 128%);opacity:.6}
.grain{position:absolute;inset:0;opacity:.16;mix-blend-mode:overlay}
</style></head><body>
<div class="f"><div class="g1"></div><div class="blur"></div><div class="g2"></div><div class="vig"></div>
<canvas class="grain" id="n" width="${s.w}" height="${s.h}"></canvas></div>
<script>
// 필름 그레인 — 매끈한 그라디언트를 인화물처럼 보이게 한다
const cv=document.getElementById('n'),cx=cv.getContext('2d');
const d=cx.createImageData(cv.width,cv.height);
for(let i=0;i<d.data.length;i+=4){const v=200+Math.random()*55|0;
  d.data[i]=d.data[i+1]=d.data[i+2]=v;d.data[i+3]=Math.random()*120|0;}
cx.putImageData(d,0,0);
</script></body></html>`;

const b = await chromium.launch();
for (const s of SETS) {
  const p = await b.newPage({ viewport:{width:s.w,height:s.h}, deviceScaleFactor:1 });
  await p.setContent(html(s));
  await p.waitForTimeout(250);
  await p.screenshot({ path:`${s.n}.jpg`, type:'jpeg', quality:62 });
  await p.close();
}
await b.close();
console.log('done');
