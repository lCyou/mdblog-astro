import { defineConfig } from 'astro/config';
import { remarkReadingTime } from './src/scripts/remark-reading-time.mjs';
import { remarkModifiedTime } from './src/scripts/remark-modified-time.mjs';

import icon from 'astro-icon';
import preact from '@astrojs/preact';
import cloudflare from '@astrojs/cloudflare';
import sitemap from '@astrojs/sitemap';

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
      // 検索エンジンに載せる必要のないページ
      filter: (page) => !/\/(terminal|404|500)\/?$/.test(new URL(page).pathname),
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
