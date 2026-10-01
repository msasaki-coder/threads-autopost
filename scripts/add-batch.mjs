// data/new_batch.json の原稿を検証し、連番の id を付けて data/posts.json の末尾に追加する
// 使い方: node scripts/add-batch.mjs [--check]（--check は検証だけ行い、追加しない）
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const postsFile = path.join(root, 'data/posts.json');
const batchFile = path.join(root, 'data/new_batch.json');
const posts = JSON.parse(fs.readFileSync(postsFile, 'utf8'));
const batch = JSON.parse(fs.readFileSync(batchFile, 'utf8'));

const used = new Set([
  ...fs.readFileSync(path.join(root, 'data/used_themes_before.txt'), 'utf8').split('\n').filter(Boolean),
  ...posts.map((p) => p.title.join('')),
]);
const errors = [];
batch.forEach((p, i) => {
  const t = p.title.join('');
  if (used.has(t)) errors.push(`#${i} テーマ重複: ${t}`);
  used.add(t);
  if (p.a?.length !== 5 || p.b?.length !== 5 || p.points?.length !== 5) errors.push(`#${i} 項目数が5ではない`);
  for (const [f, r] of [...(p.a || []), ...(p.b || [])]) {
    if (f.length > 20) errors.push(`#${i} 特徴が長い(${f.length}): ${f}`);
    if (r.length > 38) errors.push(`#${i} 理由が長い(${r.length}): ${r}`);
    if (!r.startsWith('→ ')) errors.push(`#${i} 理由が「→ 」で始まらない: ${r}`);
  }
});

console.log(`batch: ${batch.length}本`);
if (errors.length) {
  console.log(errors.join('\n'));
  process.exit(1);
}
if (process.argv.includes('--check')) process.exit(0);

let n = Math.max(...posts.map((p) => Number(p.id.slice(1))));
for (const p of batch) posts.push({ id: `p${String(++n).padStart(3, '0')}`, ...p });
fs.writeFileSync(postsFile, JSON.stringify(posts, null, 1));
fs.unlinkSync(batchFile);
console.log(`added. total: ${posts.length}本（最終 id p${String(n).padStart(3, '0')}）`);
