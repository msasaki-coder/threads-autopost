// data/posts.json のうち未投稿の先頭1件を Threads にカルーセル投稿し、data/posted.json に記録する
// 必要な環境変数: THREADS_ACCESS_TOKEN, THREADS_USER_ID, IMAGE_BASE_URL（例: https://raw.githubusercontent.com/<owner>/<repo>/main/posts）
// --dry-run で投稿せずに内容だけ表示する
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const postsFile = path.join(root, 'data/posts.json');
const postedFile = path.join(root, 'data/posted.json');
const dryRun = process.argv.includes('--dry-run');
const API = 'https://graph.threads.net/v1.0';

const posts = JSON.parse(fs.readFileSync(postsFile, 'utf8'));
const posted = fs.existsSync(postedFile) ? JSON.parse(fs.readFileSync(postedFile, 'utf8')) : [];
const done = new Set(posted.map((x) => x.id));
const next = posts.find((p) => !done.has(p.id) && [1, 2, 3, 4].every((n) => fs.existsSync(path.join(root, 'posts', p.id, `${n}.png`))));

if (!next) {
  console.error('投稿できる未投稿の原稿がありません（原稿切れ）');
  process.exit(2);
}

const caption = [
  next.title.join(''),
  '',
  next.sub.join(''),
  '',
  `結局、${next.lead.replace(/^結局、/, '')}“${next.kw}”だけじゃない。`,
  `${next.maxim[0]}${next.maxim[1]}`,
  '',
  '保存して、転職活動中に見返してください。',
  '※あくまで個人の見解です。',
].join('\n');

const { THREADS_ACCESS_TOKEN: token, THREADS_USER_ID: userId, IMAGE_BASE_URL: base } = process.env;
const imageUrls = [1, 2, 3, 4].map((n) => `${(base || '<IMAGE_BASE_URL>').replace(/\/$/, '')}/${next.id}/${n}.png`);

if (dryRun) {
  console.log(`[dry-run] ${next.id}\n${imageUrls.join('\n')}\n---\n${caption}`);
  process.exit(0);
}
if (!token || !userId || !base) throw new Error('THREADS_ACCESS_TOKEN / THREADS_USER_ID / IMAGE_BASE_URL を設定してください');

const call = async (method, endpoint, params) => {
  const url = new URL(`${API}/${endpoint}`);
  for (const [k, v] of Object.entries({ ...params, access_token: token })) url.searchParams.set(k, v);
  const res = await fetch(url, { method });
  const json = await res.json();
  if (!res.ok || json.error) throw new Error(`${endpoint}: ${JSON.stringify(json.error || json)}`);
  return json;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// コンテナの処理完了を待つ
const waitReady = async (id) => {
  for (let i = 0; i < 30; i++) {
    const { status, error_message } = await call('GET', id, { fields: 'status,error_message' });
    if (status === 'FINISHED') return;
    if (status === 'ERROR' || status === 'EXPIRED') throw new Error(`container ${id}: ${status} ${error_message || ''}`);
    await sleep(5000);
  }
  throw new Error(`container ${id}: タイムアウト`);
};

const children = [];
for (const image_url of imageUrls) {
  const { id } = await call('POST', `${userId}/threads`, { media_type: 'IMAGE', image_url, is_carousel_item: 'true' });
  children.push(id);
}
for (const id of children) await waitReady(id);

const carousel = await call('POST', `${userId}/threads`, { media_type: 'CAROUSEL', children: children.join(','), text: caption });
await waitReady(carousel.id);
const { id: mediaId } = await call('POST', `${userId}/threads_publish`, { creation_id: carousel.id });

posted.push({ id: next.id, title: next.title.join(''), mediaId, postedAt: new Date().toISOString() });
fs.writeFileSync(postedFile, JSON.stringify(posted, null, 1) + '\n');
console.log(`posted: ${next.id} ${next.title.join('')} (media ${mediaId})`);
console.log(`remaining: ${posts.filter((p) => !done.has(p.id)).length - 1}`);
