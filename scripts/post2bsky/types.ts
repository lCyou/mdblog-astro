/**
 * OGP情報の型定義
 */
export interface OGPInfo {
  /** ページのURL */
  uri: string;
  /** ページのタイトル */
  title: string;
  /** ページの説明 */
  description: string;
  /** OG画像のURL（存在する場合） */
  imageUrl?: string;
}

/**
 * キャッシュデータの型定義
 */
export interface CacheData {
  /** 投稿済みのURL一覧 */
  postedUrls: string[];
}

/**
 * RSSフィードアイテムの型定義
 */
export interface RSSItem {
  /** 記事のタイトル */
  title?: string;
  /** 記事のURL */
  link?: string;
  /** 記事の公開日時 */
  pubDate?: string;
  /** 記事の説明 */
  description?: string;
}

/**
 * Blueskyのblob参照の型定義
 */
export interface BlobRef {
  $type: 'blob';
  ref: {
    $link: string;
  };
  mimeType: string;
  size: number;
}
