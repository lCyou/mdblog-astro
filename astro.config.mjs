import { defineConfig } from 'astro/config';
import { remarkReadingTime } from './src/scripts/remark-reading-time.mjs';

import icon from 'astro-icon';

import preact from '@astrojs/preact';

import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  markdown: {
    markdown:{
      remarkPlugins: [remarkModifiedTime],
    },
    remarkPlugins: [remarkReadingTime],
    shikiConfig: {
      themes: {
        light: 'rose-pine-dawn',
        dark: 'gruvbox-dark-medium',
      },
    },
  },

  site: "https://blog.lcyou.me",
  integrations: [icon(), preact()],

  vite: {
    resolve: {
      alias: {
        '@': '/src'
      }
    }
  },

  adapter: cloudflare()
});