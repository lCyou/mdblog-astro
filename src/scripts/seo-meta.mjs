// sitemap 生成用に、記事ファイルから SEO まわりの情報を集める（astro.config.mjs から使う）
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const POSTS_DIR = 'src/pages/posts';

/** 記事が何本以上あればタグページをインデックスさせるか */
export const MIN_POSTS_FOR_TAG_INDEX = 2;

const frontmatterOf = (source) => source.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '';

const parseTags = (fm) => {
  const raw = fm.match(/^tags:\s*(\[.*\])\s*$/m)?.[1];
  if (!raw) return [];
  try {
    return JSON.parse(raw.replace(/'/g, '"'));
  } catch {
    return [];
  }
};

const gitLastModified = (file) => {
  try {
    const out = execSync(`git log -1 --pretty=format:%cI -- "${file}"`, { encoding: 'utf8' }).trim();
    return out || undefined;
  } catch {
    return undefined;
  }
};

export function collectSeoMeta() {
  const posts = readdirSync(POSTS_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const file = join(POSTS_DIR, f);
      const fm = frontmatterOf(readFileSync(file, 'utf8'));
      return {
        path: `/posts/${f.replace(/\.md$/, '')}/`,
        noindex: /^noindex:\s*true\s*$/m.test(fm),
        tags: parseTags(fm),
        lastmod: gitLastModified(file),
      };
    });

  const indexed = posts.filter((p) => !p.noindex);
  const tagCounts = new Map();
  for (const post of indexed) {
    for (const tag of post.tags) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
  }

  return {
    /** sitemap に載せないパス */
    excluded: new Set([
      ...posts.filter((p) => p.noindex).map((p) => p.path),
      ...[...tagCounts.keys()]
        .filter((tag) => tagCounts.get(tag) < MIN_POSTS_FOR_TAG_INDEX)
        .map((tag) => `/tags/${tag}/`),
    ]),
    /** パス → 最終更新日 */
    lastmod: new Map(posts.filter((p) => p.lastmod).map((p) => [p.path, p.lastmod])),
  };
}
