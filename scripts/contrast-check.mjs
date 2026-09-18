/* 글자 대비 검사 — 노랑을 종이 위 글자로 쓰면 1.3:1 이라 안 읽힌다.
   사람 눈으로 다 보기 전에 기계가 먼저 찾아낸다. */
import pw from "/home/user/my-identity/node_modules/playwright-core/index.js";
const { chromium } = pw;
const port = process.argv[2];
const ROUTES = ["/", "/calendar", "/tasks", "/goals", "/collections", "/identity",
                "/collections/countries", "/collections/bucket"];

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
let bad = 0;
for (const scheme of ["light", "dark"]) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: scheme, locale: "ko-KR", timezoneId: "Asia/Seoul" });
  const p = await ctx.newPage();
  for (const path of ROUTES) {
    await p.goto(`http://localhost:${port}${path}`, { waitUntil: "networkidle" });
    await p.evaluate(() => document.fonts.ready);
    const found = await p.evaluate(() => {
      const lum = (c) => {
        const [r, g, bl] = c;
        const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(bl);
      };
      const rgb = (s) => (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
      const alpha = (s) => { const m = s.match(/[\d.]+/g); return m && m.length > 3 ? Number(m[3]) : 1; };
      // 조상으로 올라가며 실제로 칠해진 배경을 찾는다
      const bgOf = (el) => {
        for (let n = el; n; n = n.parentElement) {
          const c = getComputedStyle(n).backgroundColor;
          if (alpha(c) > 0.85) return rgb(c);
        }
        return [255, 255, 255];
      };
      const out = [];
      for (const el of document.querySelectorAll("body *")) {
        // 잎 노드 + '자식이 있어도 자기 글자를 가진' 노드. 후자를 빼면
        // <span>0<small>/5</small></span> 의 0 이 검사에서 통째로 빠진다.
        const own = [...el.childNodes]
          .filter((n) => n.nodeType === 3).map((n) => n.textContent).join("").trim();
        const t = el.children.length ? own : (el.textContent || "").trim();
        if (!t) continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === "hidden" || cs.display === "none" || Number(cs.opacity) < 0.3) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) continue;
        // oklab/color() 등 rgb 가 아닌 표기는 여기서 못 읽는다 — 건너뛴다
        if (!cs.color.startsWith("rgb")) continue;
        const a = alpha(cs.color);
        if (a < 0.25) continue;                           // 속 빈 활자(투명 채움)
        const g = bgOf(el);
        // 반투명 글자는 배경과 합성한 색으로 잰다
        const f = rgb(cs.color).map((v, i) => Math.round(v * a + g[i] * (1 - a)));
        const L1 = lum(f), L2 = lum(g);
        const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
        const size = parseFloat(cs.fontSize);
        const bold = Number(cs.fontWeight) >= 700;
        const need = size >= 24 || (size >= 18.66 && bold) ? 3 : 4.5;
        if (ratio < need) out.push({ t: t.slice(0, 24), ratio: +ratio.toFixed(2), need, size,
                                     fg: cs.color, bg: `rgb(${g.join(",")})` });
      }
      return out;
    });
    if (found.length) {
      bad += found.length;
      console.log(`\n${scheme} ${path} — ${found.length}건`);
      for (const f of found.slice(0, 6)) console.log("   ", JSON.stringify(f));
    }
  }
  await ctx.close();
}
await b.close();
console.log(bad ? `\n대비 미달 ${bad}건` : "\n대비 전부 통과");
