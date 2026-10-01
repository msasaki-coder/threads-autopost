// data/posts.json のうち未送信の先頭1件を、Slack DM に「見出し → スレッドに本文と画像4枚」で送り、data/sent.json に記録する
// 必要な環境変数: SLACK_BOT_TOKEN, SLACK_USER_ID
// --dry-run で送信せずに内容だけ表示する
import fs from 'node:fs';
import path from 'node:path';
import { buildCaption } from './caption.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const postsFile = path.join(root, 'data/posts.json');
const sentFile = path.join(root, 'data/sent.json');
const dryRun = process.argv.includes('--dry-run');

const posts = JSON.parse(fs.readFileSync(postsFile, 'utf8'));
const sent = fs.existsSync(sentFile) ? JSON.parse(fs.readFileSync(sentFile, 'utf8')) : [];
const done = new Set(sent.map((x) => x.id));
const imagesOf = (p) => [1, 2, 3, 4].map((n) => path.join(root, 'posts', p.id, `${n}.png`));
const next = posts.find((p) => !done.has(p.id) && imagesOf(p).every((f) => fs.existsSync(f)));
const remaining = posts.filter((p) => !done.has(p.id)).length - 1;

// 次の投稿枠（JST 8/12/17/20時）を見出しに表示する
const SLOTS = [8, 12, 17, 20];
const jst = new Date(Date.now() + 9 * 3600e3);
let hour = SLOTS.find((h) => h > jst.getUTCHours() || (h === jst.getUTCHours() && jst.getUTCMinutes() < 30));
if (hour === undefined) { hour = SLOTS[0]; jst.setUTCDate(jst.getUTCDate() + 1); }
const slot = `${jst.getUTCMonth() + 1}/${jst.getUTCDate()} ${hour}:00`;

const { SLACK_BOT_TOKEN: token, SLACK_USER_ID: userId } = process.env;

// data/config.json の startAt より前は送らない（手動で予約済みの枠を飛ばすため）
const configFile = path.join(root, 'data/config.json');
const { startAt } = fs.existsSync(configFile) ? JSON.parse(fs.readFileSync(configFile, 'utf8')) : {};
if (startAt && Date.now() < Date.parse(startAt)) {
  console.log(`startAt (${startAt}) より前のため送信しません`);
  process.exit(0);
}

const slack = async (method, body, form = false) => {
  const res = await fetch(`https://slack.com/api/${method}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, ...(form ? {} : { 'Content-Type': 'application/json; charset=utf-8' }) },
    body: form ? body : JSON.stringify(body),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(`${method}: ${json.error}`);
  return json;
};

if (!next) {
  const text = '⚠️ Threads用の原稿がなくなりました。原稿の補充が必要です。';
  if (dryRun) console.log(text);
  else {
    const { channel } = await slack('conversations.open', { users: userId });
    await slack('chat.postMessage', { channel: channel.id, text });
  }
  process.exit(2);
}

const caption = buildCaption(next);
const header = `【${slot} 投稿分】${next.title.join('')}（${next.id}）\n本文と画像4枚はスレッドに入っています。残り${remaining}本${remaining < 8 ? '　⚠️ 原稿が残りわずかです' : ''}`;

if (dryRun) {
  console.log(`${header}\n---\n${caption}\n---\n${imagesOf(next).join('\n')}`);
  process.exit(0);
}
if (!token || !userId) throw new Error('SLACK_BOT_TOKEN / SLACK_USER_ID を設定してください');

const { channel } = await slack('conversations.open', { users: userId });
const { ts } = await slack('chat.postMessage', { channel: channel.id, text: header });
await slack('chat.postMessage', { channel: channel.id, thread_ts: ts, text: caption });

// files.uploadV2 と同じ手順：URL取得 → アップロード → 4枚まとめて完了
const files = [];
for (const [i, file] of imagesOf(next).entries()) {
  const buf = fs.readFileSync(file);
  const name = `${next.id}_${i + 1}.png`;
  const form = new URLSearchParams({ filename: name, length: String(buf.length) });
  const { upload_url, file_id } = await slack('files.getUploadURLExternal', form, true);
  const up = await fetch(upload_url, { method: 'POST', body: buf });
  if (!up.ok) throw new Error(`upload ${name}: ${up.status}`);
  files.push({ id: file_id, title: `${i + 1}/4` });
}
await slack('files.completeUploadExternal', { files, channel_id: channel.id, thread_ts: ts });

sent.push({ id: next.id, title: next.title.join(''), slot, sentAt: new Date().toISOString() });
fs.writeFileSync(sentFile, JSON.stringify(sent, null, 1) + '\n');
console.log(`sent: ${next.id} ${next.title.join('')} / remaining ${remaining}`);
