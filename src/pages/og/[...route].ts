import { OGImageRoute } from 'astro-og-canvas';

// Load all markdown posts
const posts = await import.meta.glob('/src/pages/posts/*.md', { eager: true });

// Create pages object from posts
const pages = Object.fromEntries(
  Object.entries(posts).map(([path, post]) => {
    // Extract slug from path (e.g., /src/pages/posts/260217-b39b4fa2.md -> 260217-b39b4fa2)
    const slug = path.split('/').pop()?.replace('.md', '') || '';
    return [slug, post];
  })
);

export const { getStaticPaths, GET } = await OGImageRoute({
  // Tell the route which parameter to use for the slug
  param: 'route',
  
  // Pass all blog posts
  pages,
  
  // Configure your canvas
  getImageOptions: (_path, page) => {
    return {
      title: page.frontmatter?.title || 'Blog Post',
      description: page.frontmatter?.description || '',
      bgGradient: [[24, 24, 27]],
      border: { color: [63, 63, 70], width: 20 },
      padding: 120,
      // Use Noto Sans CJK fonts which support Japanese characters
      // Note: These fonts must be installed in the build environment
      // For Ubuntu/Debian: sudo apt-get install fonts-noto-cjk
      fonts: [
        '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc',
        '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
      ],
      font: {
        title: {
          families: ['Noto Sans CJK JP'],
          weight: 'Bold',
          size: 70,
          color: [255, 255, 255],
        },
        description: {
          families: ['Noto Sans CJK JP'],
          weight: 'Normal',
          size: 40,
          color: [200, 200, 200],
        },
      },
    };
  },
});
