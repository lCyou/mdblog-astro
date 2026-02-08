import readline from 'readline';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ランダムなUID生成（8文字の16進数）
function generateUID() {
  return crypto.randomBytes(4).toString('hex');
}

// 日付フォーマット: YYMMDD
function formatDateYYMMDD(date) {
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}${month}${day}`;
}

// 日付フォーマット: YYYY-MM-DD
function formatDateYYYYMMDD(date) {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// プロンプト関数
function question(rl, query) {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
}

// メイン関数
async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log('📝 新しいブログ記事を作成します\n');

  try {
    // タイトル入力
    let title = '';
    while (!title.trim()) {
      title = await question(rl, 'タイトルを入力してください (例: Astroで始めるブログ開発): ');
      if (!title.trim()) {
        console.log('❌ タイトルは必須です。もう一度入力してください。\n');
      }
    }

    // 説明入力
    let description = '';
    while (!description.trim()) {
      description = await question(rl, '説明を入力してください (例: Astroを使ったブログ開発の始め方): ');
      if (!description.trim()) {
        console.log('❌ 説明は必須です。もう一度入力してください。\n');
      }
    }

    // タグ入力
    let tags = [];
    while (tags.length === 0) {
      const tagsInput = await question(rl, 'タグを入力してください（カンマ区切り、例: tech,astro,blog）: ');
      tags = tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag);
      if (tags.length === 0) {
        console.log('❌ 最低1つのタグが必要です。もう一度入力してください。\n');
      }
    }

    // ファイル名生成（UIDを含める）
    const now = new Date();
    const datePrefix = formatDateYYMMDD(now);
    const uid = generateUID();
    const filename = `${datePrefix}-${uid}.md`;
    const pubDate = formatDateYYYYMMDD(now);
    const postsDir = path.join(__dirname, '..', 'src', 'pages', 'posts');
    const filepath = path.join(postsDir, filename);

    // ファイルが既に存在する場合の確認（念のため）
    if (fs.existsSync(filepath)) {
      console.log(`\n⚠️  ファイル ${filename} は既に存在します。`);
      const overwrite = await question(rl, '上書きしますか？ (y/N): ');
      if (overwrite.toLowerCase() !== 'y') {
        console.log('❌ 処理をキャンセルしました。');
        rl.close();
        return;
      }
    }

    // タグをJSON配列形式に変換
    const tagsJson = JSON.stringify(tags);

    // Markdownテンプレート生成
    const template = `---
layout: ../../layouts/MarkdownPostLayout.astro
title: '${title}'
pubDate: ${pubDate}
description: '${description}'
author: 'lcyou'
image:
    url: 'https://docs.astro.build/assets/rose.webp'
    alt: 'ピンク色に輝く暗い背景に浮かぶAstroのロゴ。'
tags: ${tagsJson}
---

`;

    // ファイル書き込み
    try {
      fs.writeFileSync(filepath, template, 'utf8');
      console.log(`\n✅ ブログ記事を作成しました: src/pages/posts/${filename}`);
    } catch (error) {
      console.error(`❌ ファイルの書き込みに失敗しました: ${error.message}`);
      process.exit(1);
    }

  } catch (error) {
    console.error(`❌ エラーが発生しました: ${error.message}`);
    process.exit(1);
  } finally {
    rl.close();
  }
}

main();
