import { defineConfig } from 'astro/config';
import { remarkReadingTime } from './remark-reading-time.mjs';

export default defineConfig({
  markdown: {
    remarkPlugins: [remarkReadingTime],
  },
});