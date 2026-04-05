import { load } from 'cheerio';
import type { OGPInfo } from './types.js';

/**
 * URLからOGP情報を取得するクラス
 */
export class OGPFetcher {
  /**
   * URLからOGP情報を取得する
   */
  async fetchOGP(url: string): Promise<OGPInfo> {
    try {
      console.log(`  Fetching OGP metadata from: ${url}`);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const html = await response.text();
      const $ = load(html);
      
      // OGPメタタグを取得
      const ogTitle = $('meta[property="og:title"]').attr('content');
      const ogDescription = $('meta[property="og:description"]').attr('content');
      const ogImage = $('meta[property="og:image"]').attr('content');
      
      // タイトルと説明を取得（OGPがない場合はフォールバック）
      const title = ogTitle || $('title').text() || url;
      const description = 
        ogDescription || 
        $('meta[name="description"]').attr('content') || 
        '';
      
      const ogpInfo: OGPInfo = {
        uri: url,
        title,
        description,
      };
      
      // OG画像がある場合は絶対URLに変換
      if (ogImage) {
        const imageUrl = this.resolveAbsoluteUrl(url, ogImage);
        ogpInfo.imageUrl = imageUrl;
        console.log(`  ✓ Found OG image: ${imageUrl}`);
      } else {
        console.log(`  ⚠ No OG image found`);
      }
      
      console.log(`  ✓ OGP fetched: ${title}`);
      return ogpInfo;
      
    } catch (error) {
      console.error(`  ✗ Failed to fetch OGP from ${url}:`, error);
      throw new Error(`Failed to fetch OGP metadata: ${error}`);
    }
  }

  /**
   * 画像をダウンロードしてUint8Arrayとして返す
   */
  async downloadImage(imageUrl: string): Promise<{
    data: Uint8Array;
    mimeType: string;
  } | null> {
    try {
      console.log(`  Downloading image: ${imageUrl}`);
      
      const response = await fetch(imageUrl);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // 1MBのサイズ制限をチェック（Blueskyの仕様）
      if (uint8Array.length > 1000000) {
        console.warn(
          `  ⚠ Image too large (${uint8Array.length} bytes), skipping upload`
        );
        return null;
      }
      
      // Content-Typeを取得
      const mimeType = response.headers.get('content-type') || 'image/jpeg';
      
      console.log(
        `  ✓ Image downloaded: ${uint8Array.length} bytes (${mimeType})`
      );
      
      return {
        data: uint8Array,
        mimeType,
      };
      
    } catch (error) {
      console.error(`  ✗ Failed to download image:`, error);
      throw new Error(`Failed to download image: ${error}`);
    }
  }

  /**
   * 相対URLを絶対URLに変換する
   */
  private resolveAbsoluteUrl(baseUrl: string, relativeUrl: string): string {
    // 既に絶対URLの場合はそのまま返す
    if (relativeUrl.startsWith('http://') || relativeUrl.startsWith('https://')) {
      return relativeUrl;
    }
    
    try {
      const base = new URL(baseUrl);
      const absolute = new URL(relativeUrl, base.origin);
      return absolute.href;
    } catch (error) {
      console.warn(`Failed to resolve absolute URL: ${relativeUrl}`);
      return relativeUrl;
    }
  }
}
