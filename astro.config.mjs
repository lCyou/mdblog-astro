import { defineConfig } from 'astro/config';
import { remarkReadingTime } from './src/scripts/remark-reading-time.mjs';
import { remarkModifiedTime } from './src/scripts/remark-modified-time.mjs';

import icon from 'astro-icon';
import preact from '@astrojs/preact';
import cloudflare from '@astrojs/cloudflare';
import sitemap from '@astrojs/sitemap';
import { collectSeoMeta } from './src/scripts/seo-meta.mjs';

const seoMeta = collectSeoMeta();

export default defineConfig({
  markdown: {
    remarkPlugins: [remarkReadingTime, remarkModifiedTime],
    shikiConfig: {
      themes: {
        light: 'everforest-dark',
        dark: 'gruvbox-dark-medium',
      },
    },
  },

  site: "https://blog.lcyou.me",
  trailingSlash: "always",
  integrations: [
    icon(),
    preact(),
    sitemap({
      // 検索エンジンに載せる必要のないページ（noindex の記事・記事が少ないタグを含む）
      filter: (page) => {
        const { pathname } = new URL(page);
        return !/\/(terminal|search|404|500)\/?$/.test(pathname) && !seoMeta.excluded.has(decodeURI(pathname));
      },
      serialize: (item) => {
        const lastmod = seoMeta.lastmod.get(decodeURI(new URL(item.url).pathname));
        return lastmod ? { ...item, lastmod } : item;
      },
    }),
  ],

  vite: {
    resolve: {
      alias: {
        '@': '/src'
      }
    }
  },

  adapter: cloudflare()
});
