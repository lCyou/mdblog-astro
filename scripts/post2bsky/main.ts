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
 * 初回実行時の投稿数制限を適用する
 */
function limitItemsForFirstRun(
  items: RSSItem[],
  isFirstRun: boolean,
  limit: number
): RSSItem[] {
  if (isFirstRun && items.length > limit) {
    console.log(`⚠ First run: limiting to ${limit} posts`);
    return items.slice(0, limit);
  }
  return items;
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
  
  try {
    // 環境変数の検証
    validateConfig();
    
    // 各クラスの初期化
    const cacheManager = new CacheManager(config.cacheFile);
    const ogpFetcher = new OGPFetcher();
    const bskyClient = await BskyClient.create(
      config.blueskyHandle!,
      config.blueskyPassword!
    );
    
    // RSSフィードを取得
    const feedItems = await fetchRSSFeed(config.rssFeedUrl);
    
    // 未投稿の記事をフィルタリング
    let newItems = filterNewItems(feedItems, cacheManager);
    
    if (newItems.length === 0) {
      console.log('\n✓ No new items to post. Exiting.');
      return;
    }
    
    // 初回実行時は投稿数を制限
    const isFirstRun = cacheManager.isFirstRun();
    newItems = limitItemsForFirstRun(
      newItems,
      isFirstRun,
      config.initialPostLimit
    );
    
    console.log(`\n📮 Posting ${newItems.length} items...`);
    
    // 各記事を投稿（エラーが発生したら即座に中断）
    for (let i = 0; i < newItems.length; i++) {
      const item = newItems[i];
      
      console.log(`\n[${i + 1}/${newItems.length}]`);
      
      // 投稿処理（エラーが発生したらthrowされる）
      await postItem(item, bskyClient, ogpFetcher, cacheManager);
      
      // レート制限対策: 2秒待機（最後の投稿以外）
      if (i < newItems.length - 1) {
        console.log('  Waiting 2 seconds to avoid rate limiting...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // キャッシュを保存
    console.log('\n💾 Saving cache...');
    cacheManager.saveCache();
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ All posts completed successfully!');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('\n' + '='.repeat(60));
    console.error('❌ Error occurred:');
    console.error(error);
    console.error('='.repeat(60));
    process.exit(1);
  }
}

// メイン処理を実行
main();
