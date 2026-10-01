// data/posts.json の各投稿を posts/<id>/1〜4.png に描画する（画像が揃っている投稿はスキップ。--force で全再描画）
// Chrome は環境変数 CHROME、なければ Playwright のキャッシュから探す
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const posts = JSON.parse(fs.readFileSync(path.join(root, 'data/posts.json'), 'utf8'));
const force = process.argv.includes('--force');
const htmlDir = fs.mkdtempSync(path.join(os.tmpdir(), 'threads-html-'));

const findChrome = () => {
  if (process.env.CHROME) return process.env.CHROME;
  const base = path.join(os.homedir(), '.cache/ms-playwright');
  for (const d of fs.existsSync(base) ? fs.readdirSync(base).sort().reverse() : []) {
    for (const rel of ['chrome-headless-shell-linux64/chrome-headless-shell', 'chrome-linux64/chrome', 'chrome-linux/chrome']) {
      const p = path.join(base, d, rel);
      if (fs.existsSync(p)) return p;
    }
  }
  throw new Error('Chrome が見つかりません。npx playwright install chromium を実行するか CHROME を指定してください');
};
const chrome = findChrome();

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const check = (size) => `<span class="chk" style="width:${size}px;height:${size}px"><svg viewBox="0 0 24 24" width="${size * 0.7}" height="${size * 0.7}"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`;

const css = `
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700;900&display=block');
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1080px;height:1350px;background:#fff;font-family:'Noto Sans JP',sans-serif;color:#1c1c1c}
.panel{position:absolute;inset:48px;background:#f7f7f5;border-radius:36px;padding:84px 80px;display:flex;flex-direction:column}
.fit{white-space:nowrap}
.ttl,.h,.lead,.maxim,.it .f,.pts{font-feature-settings:"palt"}
.page{position:absolute;right:92px;bottom:84px;font-size:28px;color:#c4c4c4;font-weight:400;letter-spacing:.05em}
.chk{display:inline-flex;align-items:center;justify-content:center;background:#2e7d32;border-radius:8px;flex:none}
.gray{color:#6e6e6e}
/* cover */
.tag{color:#2e7d32;font-weight:700;font-size:30px;letter-spacing:.04em}
.ttl{margin-top:200px;font-weight:900;font-size:92px;line-height:1.32;letter-spacing:.01em}
.bar{width:96px;height:8px;background:#1c1c1c;margin:56px 0 52px}
.sub{font-size:34px;line-height:1.75}
.note{position:absolute;left:80px;bottom:84px;font-size:24px;color:#6e6e6e}
/* list */
.h{font-weight:900;font-size:62px;margin-bottom:26px}
.items{flex:1;display:flex;flex-direction:column;justify-content:space-evenly;padding-bottom:40px}
.it .f{display:flex;align-items:center;gap:22px;font-weight:700;font-size:42px}
.it .r{margin:12px 0 0 66px;font-size:29px;line-height:1.55;word-break:auto-phrase;text-wrap:pretty;color:#6e6e6e}
/* summary */
.lead{font-weight:900;font-size:66px;line-height:1.4;margin-top:20px}
.lead .kw{color:#2e7d32}
.msub{margin-top:40px;font-size:31px;line-height:1.7}
.pts{margin-top:34px;display:flex;flex-direction:column;gap:22px}
.pts div{display:flex;align-items:center;gap:20px;font-size:38px;font-weight:700}
.maxim{margin-top:52px;font-weight:900;font-size:54px;line-height:1.45}
.cta{position:absolute;left:80px;right:80px;bottom:84px;font-size:25px;color:#6e6e6e}
`;

// 1行に収まるよう文字サイズを縮める
const fitJs = `<script>
document.fonts.ready.then(()=>{document.querySelectorAll('.fit').forEach(el=>{
 const max=el.parentElement.clientWidth;let s=parseFloat(getComputedStyle(el).fontSize);
 el.style.display='inline-block';
 while(el.scrollWidth>max-(el.dataset.off|0)&&s>16){s-=1;el.style.fontSize=s+'px'}
 el.style.display='block'});
 // 同じブロック内の行は小さい方の文字サイズに揃える
 document.querySelectorAll('.ttl,.sub,.lead,.msub,.maxim').forEach(g=>{
  const fs=[...g.querySelectorAll(':scope>.fit')];const m=Math.min(...fs.map(e=>parseFloat(getComputedStyle(e).fontSize)));
  fs.forEach(e=>e.style.fontSize=m+'px')})});
</script>`;

const page = (body, n) => `<!doctype html><html lang="ja"><head><meta charset="utf-8"><style>${css}</style></head>
<body><div class="panel">${body}</div><div class="page">${n}/4</div>${fitJs}</body></html>`;

const items = (list) => list.map(([f, r]) => `<div class="it"><div class="f">${check(44)}<span class="fit" data-off="66">${esc(f)}</span></div><div class="r">${esc(r)}</div></div>`).join('');

let rendered = 0;
for (const p of posts) {
  const outDir = path.join(root, 'posts', p.id);
  if (!force && [1, 2, 3, 4].every((n) => fs.existsSync(path.join(outDir, `${n}.png`)))) continue;
  fs.mkdirSync(outDir, { recursive: true });
  const slides = [
    `<div class="tag">保存推奨 ／ 4枚で読めます</div>
     <div class="ttl">${p.title.map((l) => `<span class="fit">${esc(l)}</span>`).join('')}</div>
     <div class="bar"></div>
     <div class="sub gray">${p.sub.map((l) => `<span class="fit">${esc(l)}</span>`).join('')}</div>
     <div class="note">※あくまで個人の見解ですが、参考までに。</div>`,
    `<div class="h">まず前半5つ</div><div class="items">${items(p.a)}</div>`,
    `<div class="h">後半5つ</div><div class="items">${items(p.b)}</div>`,
    `<div class="lead"><span class="fit">${esc(p.lead)}</span><span class="fit"><span class="kw">“${esc(p.kw)}”</span>だけじゃない。</span></div>
     <div class="msub gray"><span class="fit">${esc(p.msub[0])}</span><span class="fit">${esc(p.msub[1])}</span></div>
     <div class="pts">${p.points.map((t) => `<div>${check(40)}<span>${esc(t)}</span></div>`).join('')}</div>
     <div class="maxim"><span class="fit">${esc(p.maxim[0])}</span><span class="fit">${esc(p.maxim[1])}</span></div>
     <div class="cta"><span class="fit">${esc(p.cta)}</span></div>`,
  ];
  slides.forEach((b, i) => {
    const html = path.join(htmlDir, `${p.id}_${i + 1}.html`);
    fs.writeFileSync(html, page(b, i + 1));
    execFileSync(chrome, ['--no-sandbox', '--hide-scrollbars', '--window-size=1080,1350', '--virtual-time-budget=10000',
      `--screenshot=${path.join(outDir, `${i + 1}.png`)}`, `file://${html}`], { stdio: 'ignore' });
  });
  rendered++;
}
fs.rmSync(htmlDir, { recursive: true, force: true });
console.log(`rendered: ${rendered} posts`);
