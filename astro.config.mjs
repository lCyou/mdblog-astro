import { defineConfig } from 'astro/config';
import { remarkReadingTime } from './src/scripts/remark-reading-time.mjs';

import icon from 'astro-icon';

import preact from '@astrojs/preact';

export default defineConfig({
  markdown: {
    remarkPlugins: [remarkReadingTime],
  },

  site: "https://lcyou.netlify.app",
  integrations: [icon(), preact()],

  vite: {
    resolve: {
      alias: {
        '@': '/src'
      }
    }
  }
});