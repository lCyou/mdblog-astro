import rss from '@astrojs/rss';
import { getPosts } from '@/utils/posts';
import { siteConfig } from '@/data/seo';

export async function GET(context) {
  const posts = getPosts().filter((post) => !post.noindex);
  return rss({
    title: siteConfig.title,
    description: siteConfig.description,
    site: context.site ?? siteConfig.url,
    items: posts.map((post) => ({
      title: post.title,
      link: post.url,
      pubDate: new Date(post.date),
      description: post.description,
      categories: post.tags,
      author: siteConfig.author,
    })),
    customData: '<language>ja-jp</language>',
  });
}
