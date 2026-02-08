import rss, { pagesGlobToRssItems } from '@astrojs/rss';

export async function GET(context) {
  return rss({
	title: "lCyou's Blog",
    	description: 'lcyouがなんでも記事に書き起こす場所',
    	site: 'https://blog.lcyou.me',
    	items: await pagesGlobToRssItems(import.meta.glob('./**/*.md')),
    	customData: `<language>ja-jp</language>`,
  });
}
