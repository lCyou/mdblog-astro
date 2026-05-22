import Parser from 'rss-parser';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { BskyClient } from './BskyClient.js';
import { OGPFetcher } from './OGPFetcher.js';
import { CacheManager } from './CacheManager.js';
import type { RSSItem } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * 環境変数の設定
 */
const config = {
  rssFeedUrl: process.env.RSS_FEED_URL || 'https://blog.lcyou.me/rss.xml',
  blueskyHandle: process.env.BLUESKY_HANDLE,
  blueskyPassword: process.env.BLUESKY_PASSWORD,
  cacheFile: process.env.CACHE_FILE || resolve(__dirname, '../../blueskyfeedbot/cache.json'),
  initialPostLimit: parseInt(process.env.INITIAL_POST_LIMIT || '5', 10),
};

/**
 * 環境変数の検証
 */
function validateConfig(): void {
  if (!config.blueskyHandle || !config.blueskyPassword) {
    console.error('✗ Error: BLUESKY_HANDLE and BLUESKY_PASSWORD environment variables are required');
    process.exit(1);
  }
}

/**
 * RSSフィードを取得する
 */
async function fetchRSSFeed(url: string): Promise<RSSItem[]> {
  try {
    console.log(`\nFetching RSS feed: ${url}`);
    const parser = new Parser();
    const feed = await parser.parseURL(url);
    console.log(`✓ Found ${feed.items.length} items in feed`);
    return feed.items as RSSItem[];
  } catch (error) {
    console.error('✗ Failed to fetch RSS feed:', error);
    throw new Error(`Failed to fetch RSS feed: ${error}`);
  }
}

/**
 * RSSアイテムを公開日時の降順（新しい順）にソートする
 */
function sortByDateDesc(items: RSSItem[]): RSSItem[] {
  return [...items].sort((a, b) => {
    const dateA = a.pubDate ? new Date(a.pubDate).getTime() : 0;
    const dateB = b.pubDate ? new Date(b.pubDate).getTime() : 0;
    return dateB - dateA;
  });
}

/**
 * 未投稿の記事をフィルタリングする
 */
function filterNewItems(
  items: RSSItem[],
  cacheManager: CacheManager
): RSSItem[] {
  const newItems = items.filter(item => {
    if (!item.link) return false;
    return !cacheManager.isPosted(item.link);
  });

  console.log(`✓ Found ${newItems.length} new items to post`);
  return newItems;
}

/**
 * 初回実行時に既存記事をキャッシュに登録してスパムを防ぐ
 * 最新N件のみ投稿対象として返し、残りは投稿済みとしてマークする
 */
function handleFirstRun(
  allItems: RSSItem[],
  limit: number,
  cacheManager: CacheManager
): RSSItem[] {
  if (allItems.length <= limit) {
    return allItems;
  }
  console.log(`⚠ First run: posting ${limit} most recent articles, marking rest as already posted`);
  const toPost = allItems.slice(0, limit);
  const toSkip = allItems.slice(limit);
  for (const item of toSkip) {
    if (item.link) cacheManager.addPostedUrl(item.link);
  }
  return toPost;
}

/**
 * 1つの記事を投稿する
 */
async function postItem(
  item: RSSItem,
  bskyClient: BskyClient,
  ogpFetcher: OGPFetcher,
  cacheManager: CacheManager
): Promise<void> {
  const title = item.title || 'Untitled';
  const link = item.link;
  
  if (!link) {
    throw new Error('Item has no link');
  }
  
  console.log(`\n📝 Processing: ${title}`);
  console.log(`   URL: ${link}`);
  
  // OGP情報を取得
  const ogpInfo = await ogpFetcher.fetchOGP(link);
  
  // 画像がある場合はダウンロードしてアップロード
  let blobRef = undefined;
  if (ogpInfo.imageUrl) {
    const imageResult = await ogpFetcher.downloadImage(ogpInfo.imageUrl);
    if (imageResult) {
      blobRef = await bskyClient.uploadImage(
        imageResult.data,
        imageResult.mimeType
      );
    }
  }
  
  // 投稿テキストを作成
  const postText = `📝 ${title}`;
  
  // リンクカード付きで投稿
  await bskyClient.postWithEmbed(postText, ogpInfo, blobRef);
  
  // キャッシュに追加
  cacheManager.addPostedUrl(link);
  
  console.log(`✓ Successfully posted: ${title}`);
}

/**
 * メイン処理
 */
async function main(): Promise<void> {
  console.log('='.repeat(60));
  console.log('🚀 Bluesky RSS Feed Bot');
  console.log('='.repeat(60));

  let cacheManager: CacheManager | undefined;

  try {
    // 環境変数の検証
    validateConfig();

    // 各クラスの初期化
    cacheManager = new CacheManager(config.cacheFile);
    const ogpFetcher = new OGPFetcher();
    const bskyClient = await BskyClient.create(
      config.blueskyHandle!,
      config.blueskyPassword!
    );

    // RSSフィードを取得して新しい順にソート
    const feedItems = await fetchRSSFeed(config.rssFeedUrl);
    const sortedItems = sortByDateDesc(feedItems);

    // 初回実行時は既存記事をキャッシュに登録し、最新N件のみ投稿対象にする
    const isFirstRun = cacheManager.isFirstRun();
    const itemsToConsider = isFirstRun
      ? handleFirstRun(sortedItems, config.initialPostLimit, cacheManager)
      : sortedItems;

    // 未投稿の記事をフィルタリング
    const newItems = filterNewItems(itemsToConsider, cacheManager);

    if (newItems.length === 0) {
      console.log('\n✓ No new items to post. Exiting.');
      return;
    }

    console.log(`\n📮 Posting ${newItems.length} items...`);

    // 各記事を投稿
    for (let i = 0; i < newItems.length; i++) {
      const item = newItems[i];

      console.log(`\n[${i + 1}/${newItems.length}]`);

      await postItem(item, bskyClient, ogpFetcher, cacheManager);

      // レート制限対策: 2秒待機（最後の投稿以外）
      if (i < newItems.length - 1) {
        console.log('  Waiting 2 seconds to avoid rate limiting...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ All posts completed successfully!');
    console.log('='.repeat(60));

  } finally {
    // エラー発生時も含め、必ずキャッシュを保存する
    if (cacheManager) {
      try {
        console.log('\n💾 Saving cache...');
        cacheManager.saveCache();
      } catch (e) {
        console.error('Failed to save cache:', e);
      }
    }
  }
}

// メイン処理を実行
main().catch(error => {
  console.error('\n' + '='.repeat(60));
  console.error('❌ Error occurred:');
  console.error(error);
  console.error('='.repeat(60));
  process.exit(1);
});
