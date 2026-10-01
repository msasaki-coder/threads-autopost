// 投稿本文（Threads のテキスト欄）を原稿データから組み立てる
export const buildCaption = (p) => [
  p.title.join(''),
  '',
  p.sub.join(''),
  '',
  `${p.lead}“${p.kw}”だけじゃない。`,
  `${p.maxim[0]}${p.maxim[1]}`,
  '',
  '保存して、転職活動中に見返してください。',
  '※あくまで個人の見解です。',
].join('\n');
