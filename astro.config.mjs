import { defineConfig } from 'astro/config';
import { remarkReadingTime } from './src/scripts/remark-reading-time.mjs';

import icon from 'astro-icon';

export default defineConfig({
  markdown: {
    remarkPlugins: [remarkReadingTime],
  },

  site: "https://lcyou.netlify.app",
  integrations: [icon()],

  vite: {
    resolve: {
      alias: {
        '@': '/src'
      }
    }
  }
});