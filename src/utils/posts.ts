import type { MarkdownInstance } from 'astro';

export interface PostFrontmatter {
  title: string;
  pubDate: string | Date;
  description?: string;
  author?: string;
  tags: string[];
  minutesRead?: string;
  lastModified?: string;
}

export interface Post {
  url: string;
  slug: string;
  /** ファイル名の後半（例: 260614-cd9f2539 → cd9f2539）。無い記事は "(root)" */
  hash: string;
  title: string;
  description: string;
  date: string; // YYYY-MM-DD
  tags: string[];
  minutesRead?: string;
}

const modules = import.meta.glob<MarkdownInstance<PostFrontmatter>>('../pages/posts/*.md', { eager: true });

export const slugToHash = (slug: string) => (slug.includes('-') ? slug.split('-').slice(1).join('-') : '(root)');

export const toDateString = (value: string | Date) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value).slice(0, 10) : d.toISOString().slice(0, 10);
};

/** 全記事を新しい順に返す */
export function getPosts(): Post[] {
  return Object.entries(modules)
    .map(([path, mod]) => {
      const slug = path.split('/').pop()!.replace(/\.md$/, '');
      const fm = mod.frontmatter;
      return {
        url: mod.url ? `${mod.url.replace(/\/$/, '')}/` : `/posts/${slug}/`,
        slug,
        hash: slugToHash(slug),
        title: fm.title,
        description: fm.description ?? '',
        date: toDateString(fm.pubDate),
        tags: fm.tags ?? [],
        minutesRead: fm.minutesRead,
      };
    })
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

/** タグごとの記事数（多い順、同数は名前順） */
export function getTagCounts(posts: Post[] = getPosts()) {
  const counts = new Map<string, number>();
  for (const post of posts) {
    for (const tag of post.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

/** 年月ごとにまとめる（YYYY-MM） */
export function groupByMonth(posts: Post[]) {
  const groups: { label: string; posts: Post[] }[] = [];
  for (const post of posts) {
    const label = post.date.slice(0, 7);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.posts.push(post);
    else groups.push({ label, posts: [post] });
  }
  return groups;
}

/** 前（古い）・次（新しい）の記事 */
export function getNeighbors(slug: string) {
  const posts = getPosts();
  const i = posts.findIndex((p) => p.slug === slug);
  if (i === -1) return { prev: undefined, next: undefined };
  return { prev: posts[i + 1], next: posts[i - 1] };
}

/** カテゴリー（tech / poem / essay）として扱うタグ */
export const CATEGORY_TAGS = ['tech', 'poem', 'essay'];
