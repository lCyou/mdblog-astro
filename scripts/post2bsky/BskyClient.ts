import { BskyAgent, RichText } from '@atproto/api';
import type { OGPInfo, BlobRef } from './types.js';

/**
 * Blueskyとの通信を担当するクライアントクラス
 */
export class BskyClient {
  private agent: BskyAgent;

  private constructor(agent: BskyAgent) {
    this.agent = agent;
  }

  /**
   * Blueskyクライアントを作成してログインする
   */
  static async create(
    identifier: string,
    password: string,
    service: string = 'https://bsky.social'
  ): Promise<BskyClient> {
    console.log(`Logging in to ${service} as ${identifier}...`);
    
    const agent = new BskyAgent({ service });
    
    try {
      await agent.login({ identifier, password });
      console.log('✓ Login successful');
      return new BskyClient(agent);
    } catch (error) {
      console.error('✗ Login failed:', error);
      throw new Error(`Failed to login: ${error}`);
    }
  }

  /**
   * 画像をBlueskyにアップロードする
   */
  async uploadImage(
    imageData: Uint8Array,
    mimeType: string
  ): Promise<BlobRef> {
    try {
      console.log(`  Uploading image to Bluesky (${imageData.length} bytes)...`);
      
      const response = await this.agent.uploadBlob(imageData, {
        encoding: mimeType,
      });
      
      const blobRef: BlobRef = {
        $type: 'blob',
        ref: {
          $link: response.data.blob.ref.toString(),
        },
        mimeType: response.data.blob.mimeType,
        size: response.data.blob.size,
      };
      
      console.log('  ✓ Image uploaded successfully');
      return blobRef;
      
    } catch (error) {
      console.error('  ✗ Failed to upload image:', error);
      throw new Error(`Failed to upload image: ${error}`);
    }
  }

  /**
   * リンクカード付きの投稿を作成する
   */
  async postWithEmbed(
    text: string,
    ogpInfo: OGPInfo,
    blobRef?: BlobRef
  ): Promise<void> {
    try {
      console.log(`  Creating post: "${text}"`);
      
      // RichTextでfacetsを検出（メンションやリンクを自動検出）
      const rt = new RichText({ text });
      await rt.detectFacets(this.agent);
      
      // 投稿の基本構造
      const postRecord: any = {
        $type: 'app.bsky.feed.post',
        text: rt.text,
        facets: rt.facets,
        createdAt: new Date().toISOString(),
      };
      
      // External embed（リンクカード）を追加
      const external: any = {
        uri: ogpInfo.uri,
        title: ogpInfo.title.substring(0, 300), // タイトルの長さ制限
        description: ogpInfo.description.substring(0, 1000), // 説明の長さ制限
      };
      
      // 画像がアップロードされている場合は追加
      if (blobRef) {
        external.thumb = blobRef;
      }
      
      postRecord.embed = {
        $type: 'app.bsky.embed.external',
        external,
      };
      
      // 投稿を実行
      const response = await this.agent.post(postRecord);
      
      console.log(`  ✓ Post created successfully: ${response.uri}`);
      
    } catch (error) {
      console.error('  ✗ Failed to create post:', error);
      throw new Error(`Failed to create post: ${error}`);
    }
  }
}
