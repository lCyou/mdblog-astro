import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import type { CacheData } from './types.js';

/**
 * キャッシュファイルの読み書きを管理するクラス
 */
export class CacheManager {
  private cacheFilePath: string;
  private cache: CacheData;

  constructor(cacheFilePath: string) {
    this.cacheFilePath = cacheFilePath;
    this.cache = this.loadCache();
  }

  /**
   * キャッシュファイルを読み込む
   */
  private loadCache(): CacheData {
    try {
      if (existsSync(this.cacheFilePath)) {
        const data = readFileSync(this.cacheFilePath, 'utf-8');
        const parsed = JSON.parse(data);
        console.log(`✓ Cache loaded: ${parsed.postedUrls.length} URLs found`);
        return parsed;
      }
    } catch (error) {
      console.warn('Failed to load cache, starting fresh:', error);
    }
    
    console.log('✓ Starting with empty cache');
    return { postedUrls: [] };
  }

  /**
   * キャッシュファイルに保存する
   */
  saveCache(): void {
    try {
      const dir = dirname(this.cacheFilePath);
      
      // ディレクトリが存在しない場合は作成
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      
      writeFileSync(
        this.cacheFilePath,
        JSON.stringify(this.cache, null, 2),
        'utf-8'
      );
      
      console.log(`✓ Cache saved: ${this.cache.postedUrls.length} URLs`);
    } catch (error) {
      console.error('Failed to save cache:', error);
      throw error;
    }
  }

  /**
   * URLが既に投稿済みかチェックする
   */
  isPosted(url: string): boolean {
    return this.cache.postedUrls.includes(url);
  }

  /**
   * 投稿済みURLをキャッシュに追加する
   */
  addPostedUrl(url: string): void {
    if (!this.cache.postedUrls.includes(url)) {
      this.cache.postedUrls.push(url);
    }
  }

  /**
   * キャッシュに含まれるURL数を取得する
   */
  getPostedCount(): number {
    return this.cache.postedUrls.length;
  }

  /**
   * 初回実行かどうかを判定する
   */
  isFirstRun(): boolean {
    return this.cache.postedUrls.length === 0;
  }
}
